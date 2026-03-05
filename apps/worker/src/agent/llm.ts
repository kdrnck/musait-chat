import type { ConvexHttpClient } from "convex/browser";
import type { AgentJob, LLMMessage } from "@musait/shared";
import { api } from "../lib/convex-api.js";
import { executeToolCall, getToolDefinitions } from "./tools/index.js";
import {
  resolveTenantAiSettings,
  type TenantAiSettings,
} from "./tenant-ai-settings.js";
import { ADMIN_MODE } from "./prompts/admin-mode.js";
import { askHuman } from "./tools/ask-human.js";
import { listServices, listStaff, getBusinessInfo } from "./tools/list-business-data.js";
import { listCustomerAppointments } from "./tools/list-customer-appointments.js";
import { SUPABASE_CONFIG } from "../config.js";
import type { PerfTimer } from "../lib/perf-timer.js";

// New modular imports
import { callOpenRouter, type OpenRouterResponse } from "./openrouter-client.js";
import {
  fetchTenantContext,
  fetchActiveTenants,
  fetchGlobalSettings,
} from "./context-builder.js";
import { getCurrentDateInfo, resolvePlaceholders } from "./prompt-resolver.js";
import { detectBookingSuccessHallucination } from "./hallucination-guard.js";

// Re-export types and modules for backward compatibility
export type { OpenRouterResponse } from "./openrouter-client.js";
export { callOpenRouter } from "./openrouter-client.js";
export { fetchTenantContext, fetchActiveTenants, fetchGlobalSettings } from "./context-builder.js";
export { getCurrentDateInfo, resolvePlaceholders } from "./prompt-resolver.js";
export { detectBookingSuccessHallucination } from "./hallucination-guard.js";

// ===== CONVERSATION-LEVEL CONTEXT CACHE =====
// Caches services/staff/businessInfo per conversation for 10 minutes.
// Only fields that were actually fetched (lazy placeholder check) are populated.
interface ContextCacheEntry {
  services: string;
  staff: string;
  businessInfo: string;
  /** Which fields were actually fetched — others may be "" due to lazy skip */
  fetchedFields: { services: boolean; staff: boolean; businessInfo: boolean };
  builtAt: number;
}
const CONTEXT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const contextCache = new Map<string, ContextCacheEntry>();

function getCachedContext(conversationId: string): ContextCacheEntry | null {
  const entry = contextCache.get(conversationId);
  if (!entry) return null;
  if (Date.now() - entry.builtAt > CONTEXT_CACHE_TTL) {
    contextCache.delete(conversationId);
    return null;
  }
  return entry;
}

function setCachedContext(
  conversationId: string,
  entry: ContextCacheEntry
): void {
  contextCache.set(conversationId, entry);
}

interface Conversation {
  _id: any;
  tenantId: string | null;
  rollingSummary: string;
  personNotes: string;
  adminMode?: boolean;
  [key: string]: any;
}

export interface AgentDebugInfo {
  responseTimeMs: number;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** Tokens served from prompt cache (provider-reported) */
  cacheReadTokens?: number;
  /** Tokens written to prompt cache this request */
  cacheCreationTokens?: number;
  thinkingContent?: string;
  toolCallTrace?: string;
  /** Step-level timing breakdown for performance analysis */
  timingBreakdown?: import("../lib/perf-timer.js").TimingBreakdown;
  /** Correlation ID for cross-referencing logs */
  correlationId?: string;
}

export interface AgentLoopResult {
  response: string;
  debugInfo?: AgentDebugInfo;
}

/**
 * Runs the agent loop:
 * 1. Build context (system prompt + summary + recent messages + current message)
 * 2. Call LLM via OpenRouter
 * 3. If tool_calls → execute tools → feed results back → call LLM again
 * 4. Return final text response
 *
 * Max iterations: 5 (safety limit for tool call loops)
 */
export async function runAgentLoop(
  convex: ConvexHttpClient,
  job: AgentJob,
  conversation: Conversation,
  opts?: { timer?: PerfTimer; customerProfile?: any }
): Promise<AgentLoopResult> {
  const timer = opts?.timer;

  // Check for admin mode activation
  const messageNormalized = (job.messageContent || "").trim().toLowerCase();
  const isAdminModeActivation = messageNormalized === ADMIN_MODE.secretCode;
  const isSuperUltraThink = messageNormalized.includes(ADMIN_MODE.superThinkCommand.toLowerCase());

  // If activating admin mode, return activation message
  if (isAdminModeActivation && !conversation.adminMode) {
    return { response: `__ADMIN_MODE_ACTIVATE__` };
  }

  // Determine reasoning mode — only via admin command, never auto-triggered
  const useReasoning = !!(conversation.adminMode && isSuperUltraThink);

  // 1. Build context
  timer?.start("contextBuild");
  const context = await buildContext(convex, job, conversation, opts?.customerProfile);
  timer?.end("contextBuild");

  const messages = context.messages;
  let tenantAiSettings = context.tenantAiSettings;
  const MAX_ITERATIONS = tenantAiSettings.maxIterations || 5;

  if (context.promptMissingForBoundTenant && conversation.tenantId && !conversation.adminMode) {
    const reason = "Prompt missing for bound tenant (Tenant > Global > Fail Closed)";
    try {
      await askHuman(convex, { reason }, {
        tenantId: conversation.tenantId,
        conversationId: conversation._id,
        customerPhone: job.customerPhone,
      });
    } catch (err) {
      console.error("❌ Failed to trigger handoff on prompt-missing fail-closed:", err);
    }
    return {
      response:
        "Sistem tarafında bu işletme için AI prompt yapılandırması eksik görünüyor. Sizi hemen bir yetkiliye bağlıyorum.",
    };
  }

  // Context-aware tool filtering: unbound conversations only need routing tools
  let toolDefs = !conversation.tenantId && !conversation.adminMode
    ? getToolDefinitions().filter((t) => {
      const name = t.function.name;
      return name === "list_businesses" || name === "bind_tenant" || name === "ask_human";
    })
    : getToolDefinitions();

  const loopStartTime = Date.now();
  let lastResponse: OpenRouterResponse | null = null;
  let strongFallbackUsed = false;

  // Accumulators for debug info across all iterations
  let accPromptTokens = 0;
  let accCompletionTokens = 0;
  let accTotalTokens = 0;
  let accCacheReadTokens = 0;
  let accCacheCreationTokens = 0;
  const thinkingParts: string[] = [];
  const toolTraceLines: string[] = [];
  const toolCallsExecuted = new Set<string>();
  // Set after a successful bind_tenant — used to enrich the tool result with the tenant name
  let tenantSwitchName: string | null = null;

  const buildStrongFallbackSettings = (): TenantAiSettings | null => {
    if (!tenantAiSettings.fallbackModel || strongFallbackUsed) {
      return null;
    }
    return {
      ...tenantAiSettings,
      model: tenantAiSettings.fallbackModel,
      providerConfig: tenantAiSettings.fallbackProviderConfig,
      providerPriority: [],
      allowFallbacks: true,
    };
  };

  const runSingleStrongFallback = async (
    reason: string,
    includeTools: boolean
  ): Promise<OpenRouterResponse | null> => {
    const fallbackSettings = buildStrongFallbackSettings();
    if (!fallbackSettings) return null;
    strongFallbackUsed = true;
    console.warn(
      `⚠️ Strong fallback engaged (reason=${reason}) model=${fallbackSettings.model}`
    );
    toolTraceLines.push(
      `⚠️ strong_fallback(reason=${reason}, model=${fallbackSettings.model})`
    );
    const fallbackMessages: LLMMessage[] = includeTools
      ? messages
      : [
        ...messages,
        {
          role: "system",
          content:
            "[FALLBACK MODE] Tool çağırmadan tek mesajda Türkçe net yanıt ver. Gerekirse kullanıcıdan tek bir kısa adım iste.",
        },
      ];

    return await callOpenRouter(fallbackMessages, {
      useReasoning: false,
      tenantAiSettings: fallbackSettings,
      isAdminMode: conversation.adminMode,
      isSuperThink: false,
      toolDefinitions: includeTools ? toolDefs : null,
    });
  };

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // 2. Call LLM
    timer?.start("llmCall");
    let response: OpenRouterResponse;
    try {
      response = await callOpenRouter(messages, {
        useReasoning: i === 0 && useReasoning,
        tenantAiSettings,
        isAdminMode: conversation.adminMode,
        isSuperThink: isSuperUltraThink,
        toolDefinitions: toolDefs,
      });
    } catch (llmErr) {
      const fallbackResponse = await runSingleStrongFallback(
        `llm_error_iteration_${i + 1}`,
        true
      );
      if (!fallbackResponse) {
        throw llmErr;
      }
      response = fallbackResponse;
    }
    timer?.end("llmCall");
    lastResponse = response;

    // Accumulate token counts across all iterations
    accPromptTokens += response.usage?.prompt_tokens ?? 0;
    accCompletionTokens += response.usage?.completion_tokens ?? 0;
    accTotalTokens += response.usage?.total_tokens ?? 0;
    accCacheReadTokens += response.usage?.cache_read_tokens ?? response.usage?.prompt_tokens_cached ?? 0;
    accCacheCreationTokens += response.usage?.cache_creation_tokens ?? 0;

    // Capture reasoning/thinking content
    if (response.thinking) {
      thinkingParts.push(i > 0 ? `[İterasyon ${i + 1}]\n${response.thinking}` : response.thinking);
    }

    // 3. Check for tool calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Add assistant response to context
      messages.push({
        role: "assistant",
        content: response.content,
        tool_calls: response.tool_calls,
      });

      // Execute all tool calls in parallel for speed
      console.log(`🔧 Executing ${response.tool_calls.length} tool call(s) in parallel`);

      timer?.start("toolExecution");
      const toolResults = await Promise.all(
        response.tool_calls.map(async (toolCall) => {
          // If tool arguments failed to parse, return error to LLM instead of executing with empty args
          if (toolCall._parseError) {
            console.warn(`⚠️ Skipping tool ${toolCall.name} due to parse error`);
            return {
              toolCall,
              result: {
                toolCallId: toolCall.id,
                name: toolCall.name,
                result: null,
                error: `Argüman ayrıştırma hatası: ${toolCall._parseError}. Lütfen argümanları düzelt ve tekrar dene.`,
              },
            };
          }
          console.log(`🔧 Tool call: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
          const result = await executeToolCall(convex, toolCall, {
            tenantId: conversation.tenantId,
            conversationId: conversation._id,
            customerPhone: job.customerPhone,
            customerName: job.customerName,
            inboundPhoneNumberId: conversation.inboundPhoneNumberId || job.phoneNumberId,
          });
          return { toolCall, result };
        })
      );
      timer?.end("toolExecution");

      // Propagate bind_tenant side-effect: full context isolation
      for (const { toolCall, result } of toolResults) {
        if (
          toolCall.name === "bind_tenant" &&
          !result.error &&
          (result.result as any)?.success === true &&
          typeof (toolCall.arguments as any)?.tenant_id === "string"
        ) {
          const oldConvId = String(conversation._id);
          const newConvId = (result.result as any).newConversationId;

          // 1. Update in-memory conversation state
          conversation.tenantId = (toolCall.arguments as any).tenant_id as string;
          // Keep job payload in sync so downstream saves use the new conversation
          (job as any).tenantId = conversation.tenantId;
          if (newConvId) {
            conversation._id = newConvId;
            (job as any).conversationId = newConvId;
          }
          conversation.rollingSummary = "";

          // 2. Invalidate context cache for the old conversation
          contextCache.delete(oldConvId);

          // 3. Rebuild messages array with new tenant context (clean slate)
          //    The new conversation has no messages, no rolling summary.
          //    This eliminates old tenant data from the LLM context entirely.
          const newContext = await buildContext(convex, job, conversation);
          messages.length = 0;
          messages.push(...newContext.messages);

          // Update tenantAiSettings for the new tenant
          tenantAiSettings = newContext.tenantAiSettings;

          // 4. Re-add the assistant tool_call message so tool results can follow
          //    (OpenAI format requires assistant message before tool results)
          messages.push({
            role: "assistant",
            content: response.content,
            tool_calls: response.tool_calls,
          });

          // 5. Unlock all tools now that we have a tenant
          toolDefs = getToolDefinitions();

          // 6. Fetch tenant name for welcome message instruction (hits cache from buildContext)
          const switchedTenantCtx = await fetchTenantContext(conversation.tenantId as string);
          tenantSwitchName = switchedTenantCtx?.name || null;

          console.log(
            `🔗 bind_tenant: full context rebuild — old=${oldConvId} new=${newConvId || oldConvId} tenant=${conversation.tenantId} name=${tenantSwitchName}`
          );
        }
      }

      // Add results to context in original order
      let forcedInteractiveMessage: string | null = null;
      for (const { toolCall, result } of toolResults) {
        toolCallsExecuted.add(toolCall.name);
        const resultStr = JSON.stringify(result.result ?? result.error);
        toolTraceLines.push(
          `→ ${toolCall.name}(${JSON.stringify(toolCall.arguments)})\n` +
          `  ${result.error ? `❌ HATA: ${result.error}` : `✅ ${resultStr.slice(0, 300)}${resultStr.length > 300 ? "..." : ""}`}`
        );

        if (
          toolCall.name === "compose_interactive_message" &&
          !result.error &&
          typeof (result.result as Record<string, unknown> | null)?.renderedMessage === "string"
        ) {
          forcedInteractiveMessage = (
            result.result as Record<string, unknown>
          ).renderedMessage as string;
        }

        // For bind_tenant success: enrich the tool result so the LLM generates a proper welcome message
        let enrichedResultStr = resultStr;
        if (toolCall.name === "bind_tenant" && tenantSwitchName && !result.error) {
          const enriched = {
            ...(result.result as any),
            tenantName: tenantSwitchName,
            instruction: `Müşteriyi "${tenantSwitchName}" işletmesine başarıyla bağladın. Müşteriye "${tenantSwitchName}" işletmesine bağlandığını kısa ve samimi bir şekilde bildir. Geçmiş konuşma kaydı temizlendi bu yüzden ne istediğini tekrar sor.`,
          };
          enrichedResultStr = JSON.stringify(enriched);
        }
        messages.push({
          role: "tool",
          content: enrichedResultStr,
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
      }

      if (forcedInteractiveMessage) {
        const responseTimeMs = Date.now() - loopStartTime;
        const debugInfo: AgentDebugInfo = {
          responseTimeMs,
          model: lastResponse?.model || tenantAiSettings.model,
          promptTokens: accPromptTokens || undefined,
          completionTokens: accCompletionTokens || undefined,
          totalTokens: accTotalTokens || undefined,
          cacheReadTokens: accCacheReadTokens || undefined,
          cacheCreationTokens: accCacheCreationTokens || undefined,
          thinkingContent:
            thinkingParts.length > 0 ? thinkingParts.join("\n\n---\n\n") : undefined,
          toolCallTrace:
            toolTraceLines.length > 0 ? toolTraceLines.join("\n\n") : undefined,
        };
        return {
          response: forcedInteractiveMessage,
          debugInfo,
        };
      }

      // Continue loop — LLM will process tool results
      continue;
    }

    // 4a. Hallucination guard: detect booking-success language without create_appointment call
    if (
      !conversation.adminMode &&
      !toolCallsExecuted.has("create_appointment") &&
      !toolCallsExecuted.has("create_appointments_batch") &&
      response.content &&
      detectBookingSuccessHallucination(response.content)
    ) {
      console.warn(`⚠️ HALLUCINATION GUARD: LLM claimed booking success without calling create_appointment`);
      messages.push({
        role: "assistant",
        content: response.content,
      });
      messages.push({
        role: "user",
        content:
          "[SYSTEM] HATA: Randevu henüz oluşturulmadı! create_appointment tool'unu çağırmadan randevu oluşturulamazsın. " +
          "Lütfen create_appointment tool'unu çağırarak randevuyu gerçekten oluştur. " +
          "Tool çağırmadan randevu oluşturulduğunu iddia etme.",
      });
      continue;
    }

    // 4. No tool calls — return text response with debug info
    const responseTimeMs = Date.now() - loopStartTime;
    const debugInfo: AgentDebugInfo = {
      responseTimeMs,
      model: lastResponse?.model || tenantAiSettings.model,
      promptTokens: accPromptTokens || undefined,
      completionTokens: accCompletionTokens || undefined,
      totalTokens: accTotalTokens || undefined,
      cacheReadTokens: accCacheReadTokens || undefined,
      cacheCreationTokens: accCacheCreationTokens || undefined,
      thinkingContent: thinkingParts.length > 0 ? thinkingParts.join("\n\n---\n\n") : undefined,
      toolCallTrace: toolTraceLines.length > 0 ? toolTraceLines.join("\n\n") : undefined,
    };
    return {
      response: response.content || "Üzgünüm, şu anda yanıt veremiyorum.",
      debugInfo,
    };
  }

  const fallbackAtLimit = await runSingleStrongFallback(
    "max_iterations_reached",
    false
  );
  if (fallbackAtLimit?.content) {
    accPromptTokens += fallbackAtLimit.usage?.prompt_tokens ?? 0;
    accCompletionTokens += fallbackAtLimit.usage?.completion_tokens ?? 0;
    accTotalTokens += fallbackAtLimit.usage?.total_tokens ?? 0;
    accCacheReadTokens +=
      fallbackAtLimit.usage?.cache_read_tokens ??
      fallbackAtLimit.usage?.prompt_tokens_cached ??
      0;
    accCacheCreationTokens += fallbackAtLimit.usage?.cache_creation_tokens ?? 0;
    const responseTimeMs = Date.now() - loopStartTime;
    const debugInfo: AgentDebugInfo = {
      responseTimeMs,
      model: fallbackAtLimit.model || tenantAiSettings.fallbackModel || tenantAiSettings.model,
      promptTokens: accPromptTokens || undefined,
      completionTokens: accCompletionTokens || undefined,
      totalTokens: accTotalTokens || undefined,
      cacheReadTokens: accCacheReadTokens || undefined,
      cacheCreationTokens: accCacheCreationTokens || undefined,
      thinkingContent:
        thinkingParts.length > 0 ? thinkingParts.join("\n\n---\n\n") : undefined,
      toolCallTrace:
        toolTraceLines.length > 0 ? toolTraceLines.join("\n\n") : undefined,
    };
    return { response: fallbackAtLimit.content, debugInfo };
  }

  return { response: "Üzgünüm, işleminizi tamamlayamadım. Lütfen tekrar deneyin." };
}

// --- Build agent context ---

async function buildContext(
  convex: ConvexHttpClient,
  job: AgentJob,
  conversation: Conversation,
  preloadedProfile?: any
): Promise<{
  messages: LLMMessage[];
  tenantAiSettings: TenantAiSettings;
  promptMissingForBoundTenant: boolean;
}> {
  const messages: LLMMessage[] = [];

  // ========== STEP 1: FETCH SETTINGS (parallelized) ==========
  const [globalSettingsResult, tenantContext] = await Promise.all([
    fetchGlobalSettings(),
    conversation.tenantId ? fetchTenantContext(conversation.tenantId) : Promise.resolve(null),
  ]);

  const globalPrompt = globalSettingsResult?.globalPromptText ?? null;
  let tenantAiSettings = resolveTenantAiSettings(
    tenantContext?.integrationKeys ?? null,
    globalPrompt
  );
  let dashboardPrompt: string | null = null;
  if (tenantContext) {
    dashboardPrompt = tenantAiSettings.systemPromptText;
  }

  // ========== STEP 1.5: FETCH EMBEDDED DATA FOR TENANT (lazy, conversation-level cache) ==========
  // Only fetches fields that the prompt actually uses via placeholder check.
  let servicesListText = "";
  let staffListText = "";
  let businessInfoText = "";

  if (conversation.tenantId && !conversation.adminMode) {
    const rawPromptForCheck = dashboardPrompt || globalPrompt || "";
    const needsServices = rawPromptForCheck.includes("{{services_list}}");
    const needsStaff = rawPromptForCheck.includes("{{staff_list}}");
    const needsBusinessInfo = rawPromptForCheck.includes("{{business_info}}");

    if (!(needsServices || needsStaff || needsBusinessInfo)) {
      console.log(`⚡ Skipping context fetch — no data placeholders in prompt`);
    } else {
    try {
      const cached = getCachedContext(conversation._id);

      // Cache hit: check every needed field was actually fetched
      const cacheCoversNeeds = cached &&
        (!needsServices || cached.fetchedFields.services) &&
        (!needsStaff || cached.fetchedFields.staff) &&
        (!needsBusinessInfo || cached.fetchedFields.businessInfo);

      if (cacheCoversNeeds && cached) {
        if (needsServices) servicesListText = cached.services;
        if (needsStaff) staffListText = cached.staff;
        if (needsBusinessInfo) businessInfoText = cached.businessInfo;
        console.log(`📦 Using cached context for conversation ${conversation._id}`);
      } else {
        // Fetch only fields that are needed AND not already cached
        const fetchServices = needsServices && (!cached || !cached.fetchedFields.services);
        const fetchStaff = needsStaff && (!cached || !cached.fetchedFields.staff);
        const fetchBiz = needsBusinessInfo && (!cached || !cached.fetchedFields.businessInfo);

        // Carry over already-cached fields
        if (cached) {
          if (needsServices && !fetchServices) servicesListText = cached.services;
          if (needsStaff && !fetchStaff) staffListText = cached.staff;
          if (needsBusinessInfo && !fetchBiz) businessInfoText = cached.businessInfo;
        }

        // Cache miss — fetch from Supabase (parallelized, only missing fields)
        const [servicesResult, staffResult, businessResult] = await Promise.all([
          fetchServices ? listServices(SUPABASE_CONFIG, {}, { tenantId: conversation.tenantId }) : Promise.resolve(null),
          fetchStaff ? listStaff(SUPABASE_CONFIG, {}, { tenantId: conversation.tenantId }) : Promise.resolve(null),
          fetchBiz ? getBusinessInfo(SUPABASE_CONFIG, {}, { tenantId: conversation.tenantId }) : Promise.resolve(null),
        ]);

        if (servicesResult && !(servicesResult as Record<string, unknown>).error) {
          const services = (servicesResult as any).services || [];
          servicesListText = services
            .map((svc: any) =>
              `- ${svc.name} (${svc.duration_minutes} dk${svc.price ? `, ${svc.price} TL` : ""})\n  ID: ${svc.id}`
            )
            .join("\n");
        }

        if (staffResult && !(staffResult as Record<string, unknown>).error) {
          const staff = (staffResult as any).staff || [];
          staffListText = staff
            .map((s: any) => `- ${s.name}${s.title ? ` (${s.title})` : ""}\n  ID: ${s.id}`)
            .join("\n");
        }

        if (businessResult && !(businessResult as Record<string, unknown>).error) {
          const tenant = (businessResult as any).tenant;
          const infoParts: string[] = [
            `Business Name: ${tenant.name || "N/A"}`,
            `Business ID: ${tenant.id}`,
          ];
          if (tenant.address) infoParts.push(`Address: ${tenant.address}`);
          if (tenant.phone) infoParts.push(`Phone: ${tenant.phone}`);
          if (tenant.maps_link) infoParts.push(`Maps Link: ${tenant.maps_link}`);
          if (tenant.working_days) infoParts.push(`Working Days: ${tenant.working_days}`);
          if (tenant.working_hours) infoParts.push(`Working Hours: ${tenant.working_hours}`);
          businessInfoText = infoParts.join("\n");
        }

        // Merge with existing cache entry and store updated fields
        const prevFetched = cached?.fetchedFields ?? { services: false, staff: false, businessInfo: false };
        setCachedContext(conversation._id, {
          services: fetchServices ? servicesListText : (cached?.services ?? ""),
          staff: fetchStaff ? staffListText : (cached?.staff ?? ""),
          businessInfo: fetchBiz ? businessInfoText : (cached?.businessInfo ?? ""),
          fetchedFields: {
            services: prevFetched.services || fetchServices,
            staff: prevFetched.staff || fetchStaff,
            businessInfo: prevFetched.businessInfo || fetchBiz,
          },
          builtAt: Date.now(),
        });
        console.log(`💾 Cached context for conversation ${conversation._id} (svc=${fetchServices}, staff=${fetchStaff}, biz=${fetchBiz})`);
      }
    } catch (err) {
      console.warn(`⚠️ Failed to fetch embedded data:`, err);
    }
    } // end placeholder check
  }

  // ========== STEP 2: SYSTEM PROMPT ==========
  // Priority: Admin Mode > Unbound routing > Dashboard (tenant) > Global Settings > None
  let systemPromptContent: string | null = null;
  let promptSource: string;
  let promptMissingForBoundTenant = false;

  if (conversation.adminMode) {
    systemPromptContent = ADMIN_MODE.systemPrompt;
    promptSource = 'ADMIN_MODE';
  } else if (!conversation.tenantId) {
    const activeTenants = await fetchActiveTenants(convex);
    const tenantList = activeTenants.length > 0
      ? activeTenants.map((t) => `- ${t.tenantName}`).join("\n")
      : "Şu anda aktif işletme yok.";

    const routerAgentPrompt = globalSettingsResult?.routerAgentPromptText;

    if (routerAgentPrompt) {
      systemPromptContent = `${routerAgentPrompt}\n\n## Aktif İşletmeler\n${tenantList}`;
      promptSource = 'ROUTER_AGENT_DB';
    } else {
      systemPromptContent = `## Aktif İşletmeler\n${tenantList}`;
      promptSource = 'TENANT_LIST_ONLY';
    }
    console.log(`🔀 Unbound routing: ${promptSource} (${activeTenants.length} tenants)`);
  } else {
    const rawPrompt = dashboardPrompt || globalPrompt || null;

    if (rawPrompt) {
      const dateInfo = getCurrentDateInfo();

      let customerProfileText = "";
      let customerName = "";
      try {
        // Use pre-fetched profile from identity sync to avoid duplicate query
        const profile = preloadedProfile ?? await convex.query(api.customerProfiles.getByPhone, {
          tenantId: conversation.tenantId,
          customerPhone: job.customerPhone,
        });

        if (profile) {
          const profileParts: string[] = [];
          if (profile.personNotes?.trim()) profileParts.push(`AI Notes: ${profile.personNotes.trim()}`);
          const name = profile.preferences?.customerName;
          if (name && typeof name === "string") {
            customerName = name;
            profileParts.push(`Customer Name: ${name}`);
          }
          customerProfileText = profileParts.join("\n");
        }
      } catch (err) {
        console.warn(`⚠️ Failed to fetch customer profile for placeholder:`, err);
      }

      // Fetch recent appointments from Supabase (tenant-isolated, last 3)
      try {
        if (conversation.tenantId) {
          const result = await listCustomerAppointments(
            SUPABASE_CONFIG,
            { only_future: false, include_cancelled: false, limit: 3 },
            { tenantId: conversation.tenantId, customerPhone: job.customerPhone }
          ) as { appointments?: Array<{ start_time: string; status: string; service?: { name?: string } | null; staff?: { name?: string } | null }>; total?: number };

          if (result.appointments && result.appointments.length > 0) {
            const lines = result.appointments.map((a) => {
              const date = new Date(a.start_time).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
              const time = new Date(a.start_time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
              const svc = a.service?.name || "N/A";
              const staff = a.staff?.name || "";
              return `- ${date} ${time} | ${svc}${staff ? ` | ${staff}` : ""} | ${a.status}`;
            });
            let appointmentBlock = `Recent Appointments:\n${lines.join("\n")}`;

            // Derive recent services from appointments
            const svcNames = Array.from(new Set(
              result.appointments
                .map((a) => a.service?.name)
                .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
            ));
            if (svcNames.length > 0) {
              appointmentBlock += `\nRecent Services: ${svcNames.join(", ")}`;
            }

            customerProfileText = customerProfileText
              ? customerProfileText + "\n" + appointmentBlock
              : appointmentBlock;
          }
          console.log(`📅 Appointments injected: ${result.appointments?.length ?? 0} (total: ${result.total ?? 0})`);
        }
      } catch (err) {
        console.warn(`⚠️ Failed to fetch appointments for prompt:`, err);
      }

      const placeholders: Record<string, string> = {
        current_date: dateInfo.date,
        current_day_name: dateInfo.dayName,
        current_time: dateInfo.time,
        tenant_name: tenantContext?.name || "İşletme",
        tenant_id: conversation.tenantId || "",
        business_name: tenantContext?.name || "İşletme",
        // Use empty string when data is unavailable — avoids sending misleading
        // "bulunamadı" strings that can confuse the LLM and cause hallucinations.
        business_info: businessInfoText || "",
        services_list: servicesListText || "",
        staff_list: staffListText || "",
        customer_first_name: customerName.split(" ")[0] || customerName,
        customer_name: customerName,
        customer_profile: customerProfileText || "",
      };

      systemPromptContent = resolvePlaceholders(rawPrompt, placeholders);
      promptSource = dashboardPrompt ? 'DASHBOARD' : 'GLOBAL';
    } else {
      systemPromptContent = null;
      promptSource = 'NONE';
      promptMissingForBoundTenant = true;
    }
  }

  if (systemPromptContent) {
    const systemPromptFormatted = `<system_prompt>\n${systemPromptContent}\n</system_prompt>`;
    messages.push({ role: "system", content: systemPromptFormatted });
    console.log(`📋 Prompt source=${promptSource} len=${systemPromptContent.length}chars`);
  } else {
    console.warn(`⚠️ No system prompt (source: ${promptSource})`);
  }

  // ========== STEP 3: MESSAGE HISTORY (with rolling summary) ==========
  // UPDATED: Reduced limit to 10 (rolling summary provides older context)
  // DEPRECATED: sessionStartedAt no longer used - new architecture has immutable conversations
  const recentMessages = await convex.query(api.messages.getContextWindow, {
    conversationId: conversation._id,
    limit: 10, // Reduced from 20 — rolling summary provides older context
    sessionStartedAt: undefined, // DEPRECATED: not used anymore
  });

  // Integrate rolling summary if available
  if (conversation.rollingSummary && conversation.rollingSummary.trim()) {
    messages.push({
      role: "user",
      content: `[SUMMARY FROM PREVIOUS SESSION]\n${conversation.rollingSummary}`,
    });
    console.log(`📝 Added rolling summary (${conversation.rollingSummary.length} chars)`);
  }

  if (recentMessages.length > 0) {
    for (const msg of recentMessages) {
      if (msg.role === "customer") {
        messages.push({ role: "user", content: msg.content });
      } else if (msg.role === "agent" || msg.role === "human") {
        // Filter out booking flow state JSON injections — these are internal state
        // markers ("__BOOKING_FLOW_STATE__:") saved as human messages and must
        // never reach the LLM as context.
        if (typeof msg.content === "string" && msg.content.startsWith("__BOOKING_FLOW_STATE__:")) {
          continue;
        }
        messages.push({ role: "assistant", content: msg.content });
      }
    }
  }

  console.log(`📋 Context built: ${messages.length} messages (tenant=${conversation.tenantId || 'unbound'}, summary=${conversation.rollingSummary ? 'yes' : 'no'})`);

  return { messages, tenantAiSettings, promptMissingForBoundTenant };
}
