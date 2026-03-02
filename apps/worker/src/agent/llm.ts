import type { ConvexHttpClient } from "convex/browser";
import type { AgentJob, LLMMessage } from "@musait/shared";
import { api } from "../lib/convex-api.js";
import { executeToolCall, getToolDefinitions } from "./tools/index.js";
import {
  resolveTenantAiSettings,
  type TenantAiSettings,
} from "./tenant-ai-settings.js";
import { ADMIN_MODE } from "./master-prompts.js";
import { listServices, listStaff, getBusinessInfo } from "./tools/list-business-data.js";

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
  thinkingContent?: string;
  toolCallTrace?: string;
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
  conversation: Conversation
): Promise<AgentLoopResult> {
  const MAX_ITERATIONS = 5;

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
  const context = await buildContext(convex, job, conversation);
  const messages = context.messages;
  const tenantAiSettings = context.tenantAiSettings;

  // Context-aware tool filtering: unbound conversations only need routing tools
  const toolDefs = !conversation.tenantId && !conversation.adminMode
    ? getToolDefinitions().filter((t) => {
        const name = t.function.name;
        return name === "list_businesses" || name === "bind_tenant" || name === "ask_human";
      })
    : getToolDefinitions();

  const loopStartTime = Date.now();
  let lastResponse: OpenRouterResponse | null = null;

  // Accumulators for debug info across all iterations
  let accPromptTokens = 0;
  let accCompletionTokens = 0;
  let accTotalTokens = 0;
  const thinkingParts: string[] = [];
  const toolTraceLines: string[] = [];
  const toolCallsExecuted = new Set<string>();

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // 2. Call LLM
    const response = await callOpenRouter(messages, {
      useReasoning: i === 0 && useReasoning,
      tenantAiSettings,
      isAdminMode: conversation.adminMode,
      isSuperThink: isSuperUltraThink,
      toolDefinitions: toolDefs,
    });
    lastResponse = response;

    // Accumulate token counts across all iterations
    accPromptTokens += response.usage?.prompt_tokens ?? 0;
    accCompletionTokens += response.usage?.completion_tokens ?? 0;
    accTotalTokens += response.usage?.total_tokens ?? 0;

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
          });
          return { toolCall, result };
        })
      );

      // Propagate bind_tenant side-effect
      for (const { toolCall, result } of toolResults) {
        if (
          toolCall.name === "bind_tenant" &&
          !result.error &&
          (result.result as any)?.success === true &&
          typeof (toolCall.arguments as any)?.tenant_id === "string"
        ) {
          conversation.tenantId = (toolCall.arguments as any).tenant_id as string;
          console.log(`🔗 bind_tenant: in-memory tenantId refreshed to ${conversation.tenantId}`);
        }
      }

      // Add results to context in original order
      for (const { toolCall, result } of toolResults) {
        toolCallsExecuted.add(toolCall.name);
        const resultStr = JSON.stringify(result.result ?? result.error);
        toolTraceLines.push(
          `→ ${toolCall.name}(${JSON.stringify(toolCall.arguments)})\n` +
          `  ${result.error ? `❌ HATA: ${result.error}` : `✅ ${resultStr.slice(0, 300)}${resultStr.length > 300 ? "..." : ""}`}`
        );

        messages.push({
          role: "tool",
          content: resultStr,
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
      }

      // Continue loop — LLM will process tool results
      continue;
    }

    // 4a. Hallucination guard: detect booking-success language without create_appointment call
    if (
      !conversation.adminMode &&
      !toolCallsExecuted.has("create_appointment") &&
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
      thinkingContent: thinkingParts.length > 0 ? thinkingParts.join("\n\n---\n\n") : undefined,
      toolCallTrace: toolTraceLines.length > 0 ? toolTraceLines.join("\n\n") : undefined,
    };
    return {
      response: response.content || "Üzgünüm, şu anda yanıt veremiyorum.",
      debugInfo,
    };
  }

  return { response: "Üzgünüm, işleminizi tamamlayamadım. Lütfen tekrar deneyin." };
}

// --- Build agent context ---

async function buildContext(
  convex: ConvexHttpClient,
  job: AgentJob,
  conversation: Conversation
): Promise<{ messages: LLMMessage[]; tenantAiSettings: TenantAiSettings }> {
  const messages: LLMMessage[] = [];

  // ========== STEP 1: FETCH SETTINGS ==========
  const globalSettingsResult = await fetchGlobalSettings();
  const globalPrompt = globalSettingsResult?.globalPromptText ?? null;
  let tenantAiSettings = resolveTenantAiSettings(null, globalPrompt);
  let dashboardPrompt: string | null = null;
  let tenantContext: Awaited<ReturnType<typeof fetchTenantContext>> = null;

  if (conversation.tenantId) {
    tenantContext = await fetchTenantContext(conversation.tenantId);
    tenantAiSettings = resolveTenantAiSettings(tenantContext?.integrationKeys, globalPrompt);
    dashboardPrompt = tenantAiSettings.systemPromptText;
  }

  // ========== STEP 1.5: FETCH EMBEDDED DATA FOR TENANT ==========
  let servicesListText = "";
  let staffListText = "";
  let businessInfoText = "";

  if (conversation.tenantId) {
    try {
      const servicesResult = await listServices({}, { tenantId: conversation.tenantId });
      if (servicesResult && !(servicesResult as Record<string, unknown>).error) {
        const services = (servicesResult as any).services || [];
        servicesListText = services
          .map((svc: any) => {
            const staffNames = svc.staff?.map((s: any) => s.name).join(", ") || "Yok";
            return `- ${svc.name} (${svc.duration_minutes} dk${svc.price ? `, ${svc.price} TL` : ""})\n  ID: ${svc.id}\n  Çalışanlar: ${staffNames}`;
          })
          .join("\n\n");
      }

      const staffResult = await listStaff({}, { tenantId: conversation.tenantId });
      if (staffResult && !(staffResult as Record<string, unknown>).error) {
        const staff = (staffResult as any).staff || [];
        staffListText = staff
          .map((s: any) => `- ${s.name}${s.title ? ` (${s.title})` : ""}\n  ID: ${s.id}`)
          .join("\n");
      }

      const businessResult = await getBusinessInfo({}, { tenantId: conversation.tenantId });
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
        if (tenant.description) infoParts.push(`Description: ${tenant.description}`);
        businessInfoText = infoParts.join("\n");
      }
    } catch (err) {
      console.warn(`⚠️ Failed to fetch embedded data:`, err);
    }
  }

  // ========== STEP 2: SYSTEM PROMPT ==========
  // Priority: Admin Mode > Unbound routing > Dashboard (tenant) > Global Settings > None
  let systemPromptContent: string | null = null;
  let promptSource: string;

  if (conversation.adminMode) {
    systemPromptContent = ADMIN_MODE.systemPrompt;
    promptSource = 'ADMIN_MODE';
  } else if (!conversation.tenantId) {
    const activeTenants = await fetchActiveTenants(convex);
    const tenantList = activeTenants.length > 0
      ? activeTenants.map((t) => `- ${t.tenantName} (tenant_id: ${t.tenantId})`).join("\n")
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
        const profile = await convex.query(api.customerProfiles.getByPhone, {
          tenantId: conversation.tenantId,
          customerPhone: job.customerPhone,
        });

        if (profile) {
          const profileParts: string[] = [];
          if (profile.personNotes?.trim()) profileParts.push(`AI Notes: ${profile.personNotes.trim()}`);
          if (profile.lastStaff?.length > 0) profileParts.push(`Preferred Staff: ${profile.lastStaff.join(", ")}`);
          if (profile.lastServices?.length > 0) profileParts.push(`Recent Services: ${profile.lastServices.join(", ")}`);
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

      const placeholders: Record<string, string> = {
        current_date: dateInfo.date,
        current_day_name: dateInfo.dayName,
        current_time: dateInfo.time,
        tenant_name: tenantContext?.name || "İşletme",
        tenant_id: conversation.tenantId || "",
        business_name: tenantContext?.name || "İşletme",
        business_info: businessInfoText || "İşletme bilgisi mevcut değil.",
        services_list: servicesListText || "Hizmet bilgisi mevcut değil.",
        staff_list: staffListText || "Personel bilgisi mevcut değil.",
        customer_first_name: customerName.split(" ")[0] || customerName,
        customer_name: customerName,
        customer_profile: customerProfileText || "Müşteri profili mevcut değil.",
      };

      systemPromptContent = resolvePlaceholders(rawPrompt, placeholders);
      promptSource = dashboardPrompt ? 'DASHBOARD' : 'GLOBAL';
    } else {
      systemPromptContent = null;
      promptSource = 'NONE';
    }
  }

  if (systemPromptContent) {
    const systemPromptFormatted = `<system_prompt>\n${systemPromptContent}\n</system_prompt>`;
    messages.push({ role: "system", content: systemPromptFormatted });
    console.log(`📋 Prompt source=${promptSource} len=${systemPromptContent.length}chars`);
  } else {
    console.warn(`⚠️ No system prompt (source: ${promptSource})`);
  }

  // ========== STEP 3: MESSAGE HISTORY ==========
  const recentMessages = await convex.query(api.messages.getContextWindow, {
    conversationId: conversation._id,
    limit: 20,
    sessionStartedAt: conversation.sessionStartedAt || undefined,
  });

  if (recentMessages.length > 0) {
    for (const msg of recentMessages) {
      if (msg.role === "customer") {
        messages.push({ role: "user", content: msg.content });
      } else if (msg.role === "agent" || msg.role === "human") {
        messages.push({ role: "assistant", content: msg.content });
      }
    }
  }

  console.log(`📋 Context built: ${messages.length} messages (tenant=${conversation.tenantId || 'unbound'})`);

  return { messages, tenantAiSettings };
}
