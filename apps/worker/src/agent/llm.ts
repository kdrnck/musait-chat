import type { ConvexHttpClient } from "convex/browser";
import type { AgentJob, LLMMessage, AgentToolName } from "@musait/shared";
import { api } from "../lib/convex-api.js";
import { LLM_CONFIG, SUPABASE_CONFIG } from "../config.js";
import { executeToolCall, getToolDefinitions } from "./tools/index.js";
import {
  resolveTenantAiSettings,
  type TenantAiSettings,
} from "./tenant-ai-settings.js";
import { ADMIN_MODE } from "./master-prompts.js";
import { listServices, listStaff, getBusinessInfo } from "./tools/list-business-data.js";

interface Conversation {
  _id: any;
  tenantId: string | null;
  rollingSummary: string;
  personNotes: string;
  adminMode?: boolean;
  [key: string]: any;
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
    // NOTE: Always send tool definitions — skipping them on follow-up iterations
    // would break multi-step tool chains (e.g. check_calendar → get_staff → create_appointment)
    const response = await callOpenRouter(messages, {
      useReasoning: i === 0 && useReasoning,
      tenantAiSettings,
      isAdminMode: conversation.adminMode,
      isSuperThink: isSuperUltraThink,
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

      // Propagate bind_tenant side-effect: update in-memory tenantId so
      // subsequent iterations in this same loop can use tenant-scoped tools.
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
      // Inject a corrective system message and let the LLM try again
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

// --- Helper functions for placeholder resolution ---

/**
 * Get current date, day name and time in Istanbul timezone
 */
function getCurrentDateInfo(): { date: string; dayName: string; time: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  const weekday = parts.find((p) => p.type === "weekday")?.value;

  const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const time = timeFormatter.format(now);

  return {
    date: `${year}-${month}-${day}`,
    dayName: weekday || "Bilinmiyor",
    time,
  };
}

/**
 * Resolve placeholders in system prompt.
 * Supports both {{placeholder}} and {placeholder} formats.
 */
function resolvePlaceholders(
  prompt: string,
  placeholders: Record<string, string>
): string {
  let resolved = prompt;
  for (const [key, value] of Object.entries(placeholders)) {
    // Support both {{placeholder}} and {placeholder} formats
    const doubleBrace = `{{${key}}}`;
    const singleBrace = `{${key}}`;
    resolved = resolved.replaceAll(doubleBrace, value);
    resolved = resolved.replaceAll(singleBrace, value);
  }
  return resolved;
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

  console.log(`\n========== BUILD CONTEXT START ==========`);
  console.log(`📋 Tenant ID: ${conversation.tenantId || 'NULL (unbound)'}`);
  console.log(`📋 Customer Phone: ${job.customerPhone}`);

  if (conversation.tenantId) {
    tenantContext = await fetchTenantContext(conversation.tenantId);

    console.log(`📋 Tenant Context Fetched: ${tenantContext ? 'YES' : 'NO'}`);
    console.log(`📋 Integration Keys: ${tenantContext?.integrationKeys ? JSON.stringify(Object.keys(tenantContext.integrationKeys)) : 'NONE'}`);

    if (tenantContext?.integrationKeys) {
      const rawPrompt = tenantContext.integrationKeys.ai_system_prompt_text;
      console.log(`📋 Raw ai_system_prompt_text type: ${typeof rawPrompt}`);
      console.log(`📋 Raw ai_system_prompt_text value (first 150 chars): ${rawPrompt ? String(rawPrompt).slice(0, 150) : 'NULL/UNDEFINED'}`);
    }

    tenantAiSettings = resolveTenantAiSettings(tenantContext?.integrationKeys, globalPrompt);
    dashboardPrompt = tenantAiSettings.systemPromptText;

    console.log(`📋 Resolved System Prompt Length: ${dashboardPrompt?.length || 0}`);
    console.log(`📋 Resolved System Prompt (first 200 chars): ${dashboardPrompt ? dashboardPrompt.slice(0, 200) : 'NULL'}`);
  }

  // ========== STEP 1.5: FETCH EMBEDDED DATA FOR TENANT ==========
  let servicesListText = "";
  let staffListText = "";
  let businessInfoText = "";

  if (conversation.tenantId) {
    try {
      // Fetch services
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

      // Fetch staff
      const staffResult = await listStaff({}, { tenantId: conversation.tenantId });
      if (staffResult && !(staffResult as Record<string, unknown>).error) {
        const staff = (staffResult as any).staff || [];
        staffListText = staff
          .map((s: any) => `- ${s.name}${s.title ? ` (${s.title})` : ""}\n  ID: ${s.id}`)
          .join("\n");
      }

      // Fetch business info
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
  // System prompt is the ONLY source of agent personality/rules
  // It comes from: Admin Mode > Unbound routing > Dashboard (tenant) > Global Settings > Minimal Fallback

  // 🔓 ADMIN MODE - Override everything if active
  let systemPromptContent: string | null = null;
  let promptSource: string;

  if (conversation.adminMode) {
    systemPromptContent = ADMIN_MODE.systemPrompt;
    promptSource = 'ADMIN_MODE';
    console.log(`🔓 ADMIN MODE ACTIVE - Using admin system prompt`);
  } else if (!conversation.tenantId) {
    // 🔀 UNBOUND — use RouterAgent prompt from DB only. Append live tenant list as data.
    const activeTenants = await fetchActiveTenants(convex);
    const tenantList = activeTenants.length > 0
      ? activeTenants.map((t) => `- ${t.tenantName} (tenant_id: ${t.tenantId})`).join("\n")
      : "Şu anda aktif işletme yok.";

    const routerAgentPrompt = globalSettingsResult?.routerAgentPromptText;

    if (routerAgentPrompt) {
      // Panel-configured router prompt — append live tenant list
      systemPromptContent = `${routerAgentPrompt}\n\n## Aktif İşletmeler\n${tenantList}`;
      promptSource = 'ROUTER_AGENT_DB';
    } else {
      // No panel prompt — inject tenant list as data only, no hardcoded instructions
      systemPromptContent = `## Aktif İşletmeler\n${tenantList}`;
      promptSource = 'TENANT_LIST_ONLY';
    }
    console.log(`🔀 UNBOUND - Using ${promptSource} prompt (${activeTenants.length} tenants)`);
  } else {
    // Bound — use ONLY panel/global prompt with placeholder resolution
    const rawPrompt = dashboardPrompt || globalPrompt || null;
    
    if (rawPrompt) {
      // Get current date info
      const dateInfo = getCurrentDateInfo();
      
      // Prepare customer profile text and name for placeholders
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

      // Resolve placeholders
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
      console.log(`✅ Placeholder resolution complete. Resolved ${Object.keys(placeholders).length} placeholders.`);
    } else {
      systemPromptContent = null;
      promptSource = 'NONE';
    }
  }

  if (systemPromptContent) {
    const systemPromptFormatted = `<system_prompt>\n${systemPromptContent}\n</system_prompt>`;
    messages.push({ role: "system", content: systemPromptFormatted });
    console.log(`✅ SYSTEM PROMPT ADDED (source: ${promptSource})`);
    console.log(`   Length: ${systemPromptContent.length} chars`);
  } else {
    console.log(`⚠️ NO SYSTEM PROMPT (source: ${promptSource}) - panel prompt not configured, tools only`);
  }

  // ========== STEP 3: MESSAGE HISTORY ==========
  // Only fetch messages from current session (after sessionStartedAt if set)
  const recentMessages = await convex.query(api.messages.getContextWindow, {
    conversationId: conversation._id,
    limit: 20,
    sessionStartedAt: conversation.sessionStartedAt || undefined,
  });

  console.log(`📋 Message History: ${recentMessages.length} messages (session boundary: ${conversation.sessionStartedAt ? new Date(conversation.sessionStartedAt).toISOString() : 'none'})`);

  // Format message history
  if (recentMessages.length > 0) {
    for (const msg of recentMessages) {
      if (msg.role === "customer") {
        messages.push({ role: "user", content: msg.content });
      } else if (msg.role === "agent" || msg.role === "human") {
        messages.push({ role: "assistant", content: msg.content });
      }
    }
  }

  console.log(`✅ TOTAL MESSAGES TO LLM: ${messages.length}`);
  console.log(`========== BUILD CONTEXT END ==========\n`);

  return { messages, tenantAiSettings };
}

// --- OpenRouter API Call ---

interface OpenRouterResponse {
  content: string | null;
  thinking?: string | null;  // reasoning/thinking tokens from DeepSeek / other models
  tool_calls?: Array<{
    id: string;
    name: AgentToolName;
    arguments: Record<string, unknown>;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
}

export interface AgentDebugInfo {
  responseTimeMs: number;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** Internal monologue / reasoning tokens (DeepSeek thinking, etc.) */
  thinkingContent?: string;
  /** Full tool call trace: each iteration's tool calls + results formatted as text */
  toolCallTrace?: string;
}

export interface AgentLoopResult {
  response: string;
  debugInfo?: AgentDebugInfo;
}

async function callOpenRouter(
  messages: LLMMessage[],
  options: { useReasoning: boolean; tenantAiSettings: TenantAiSettings; isAdminMode?: boolean; isSuperThink?: boolean }
): Promise<OpenRouterResponse> {
  const providerOrder = options.tenantAiSettings.providerPriority;
  const payload: Record<string, unknown> = {
    model: options.tenantAiSettings.model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      ...(m.name ? { name: m.name } : {}),
    })),
    tools: getToolDefinitions(),
    temperature: LLM_CONFIG.temperature,
    max_tokens: LLM_CONFIG.maxTokens,
  };

  if (providerOrder.length > 0) {
    payload.provider = {
      order: providerOrder,
      allow_fallbacks: options.tenantAiSettings.allowFallbacks,
    };
  }

  // 🔓 ADMIN MODE + SÜPER ULTRA DÜŞÜN: Use high effort reasoning
  const shouldUseDeepReasoning = options.isAdminMode && options.isSuperThink;
  
  if (
    (options.useReasoning || shouldUseDeepReasoning) &&
    LLM_CONFIG.enableReasoningForComplex &&
    supportsReasoning(options.tenantAiSettings.model)
  ) {
    payload.reasoning = {
      enabled: true,
      effort: shouldUseDeepReasoning ? "high" : "low",  // 🚀 Süper ultra düşün = high effort
      exclude: true,
    };
  }

  // Attempt 1: with configured provider order
  let response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LLM_CONFIG.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://musait.app",
        "X-Title": "Musait Chat Agent",
      },
      body: JSON.stringify(payload),
    }
  );

  // Attempt 2: provider error → retry with an explicit, tool-capable provider list.
  // IMPORTANT: allow_fallbacks must be FALSE here so OpenRouter cannot spill over to
  // unlisted providers (e.g. Novita) that don't carry the requested model variant.
  if (!response.ok) {
    const errorBody = await response.text();
    const is503OrProvider =
      response.status === 503 ||
      response.status === 400 ||
      response.status === 404 ||
      errorBody.includes("Provider returned error") ||
      errorBody.includes("503") ||
      errorBody.includes("404") ||
      errorBody.includes("无可用渠道") ||
      errorBody.includes("does not exist");

    if (is503OrProvider) {
      console.warn(
        `⚠️ Provider error (${response.status}), retrying with explicit tool-capable providers (no spillover)...`
      );
      const fallbackPayload = {
        ...payload,
        provider: {
          // Strict ordered list — deepinfra and groq reliably host DeepSeek tool-calling.
          // allow_fallbacks: false prevents OpenRouter from picking random providers like Novita.
          order: ["deepinfra", "groq", "together"],
          allow_fallbacks: false,
        },
      };
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LLM_CONFIG.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://musait.app",
          "X-Title": "Musait Chat Agent",
        },
        body: JSON.stringify(fallbackPayload),
      });
    }

    if (!response.ok) {
      // errorBody already consumed above; read the new response body here
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice) {
    throw new Error("No response from OpenRouter");
  }

  // Extract reasoning/thinking content (DeepSeek returns it in .reasoning or .thinking)
  const thinkingRaw: string | null =
    choice.message?.reasoning ||
    choice.message?.thinking ||
    choice.message?.reasoning_content ||
    null;

  return {
    content: choice.message?.content || null,
    thinking: thinkingRaw || undefined,
    tool_calls: choice.message?.tool_calls?.map((tc: any) => {
      let args: Record<string, unknown> = {};
      try {
        args =
          typeof tc.function?.arguments === "string"
            ? JSON.parse(tc.function.arguments)
            : tc.function?.arguments ?? {};
      } catch {
        console.warn(
          `⚠️ Failed to parse tool arguments for ${tc.function?.name}: ${tc.function?.arguments}`
        );
      }
      return {
        id: tc.id,
        name: (tc.function?.name ?? "unknown") as AgentToolName,
        arguments: args,
      };
    }),
    usage: data.usage,
    model: data.model,
  };
}

async function fetchTenantContext(tenantId: string): Promise<{
  name: string | null;
  slug: string | null;
  integrationKeys: Record<string, unknown>;
} | null> {
  const url = new URL(`${SUPABASE_CONFIG.url}/rest/v1/tenants`);
  url.searchParams.set("id", `eq.${tenantId}`);
  url.searchParams.set("select", "name,slug,integration_keys");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_CONFIG.serviceKey,
      Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
    },
  });
  if (!response.ok) return null;

  const rows = (await response.json()) as Array<{
    name?: string | null;
    slug?: string | null;
    integration_keys?: Record<string, unknown>;
  }>;

  const tenant = rows[0];
  if (!tenant) return null;

  return {
    name: tenant.name || null,
    slug: tenant.slug || null,
    integrationKeys: tenant.integration_keys || {},
  };
}

async function fetchActiveTenants(
  convex: ConvexHttpClient
): Promise<Array<{ tenantId: string; tenantName: string }>> {
  try {
    const list = await convex.query(api.tenantCodes.listActive);
    return (list || []).map((t: any) => ({
      tenantId: t.tenantId,
      tenantName: t.tenantName,
    }));
  } catch {
    return [];
  }
}

async function fetchGlobalSettings(): Promise<{ globalPromptText: string | null; routerAgentPromptText: string | null } | null> {
  const url = new URL(`${SUPABASE_CONFIG.url}/rest/v1/global_settings`);
  url.searchParams.set("id", "eq.default");
  url.searchParams.set("select", "ai_system_prompt_text,router_agent_master_prompt_text");
  url.searchParams.set("limit", "1");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_CONFIG.serviceKey,
        Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
      },
    });
    if (!response.ok) return null;

    const rows = (await response.json()) as Array<{
      ai_system_prompt_text?: string | null;
      router_agent_master_prompt_text?: string | null;
    }>;
    const row = rows[0];
    if (!row) return null;
    return {
      globalPromptText: row.ai_system_prompt_text || null,
      routerAgentPromptText: row.router_agent_master_prompt_text || null,
    };
  } catch (err) {
    console.error("Failed to fetch global settings:", err);
    return null;
  }
}

function supportsReasoning(model: string): boolean {
  return /deepseek/i.test(model);
}

function sanitizePhoneForLink(value?: string | null): string {
  if (!value) return "02128011028";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "02128011028";
  return digits;
}

function buildServiceLink(slug?: string | null, inboundNumber?: string): string {
  if (!slug) return "https://musait.app/isletme-listesi";
  const number = sanitizePhoneForLink(inboundNumber);
  return `https://musait.app/b/${slug}/backToWhatsapp?number=${encodeURIComponent(number)}`;
}

/**
 * Detect if the LLM response claims a booking was successfully created.
 * Used as a hallucination guard — if this returns true but create_appointment
 * was never called, the LLM is hallucinating.
 */
function detectBookingSuccessHallucination(content: string): boolean {
  const normalized = content.toLocaleLowerCase("tr-TR");
  const successPatterns = [
    /randevu(?:nuz)?\s+(?:başarıyla\s+)?oluşturuldu/,
    /randevu(?:nuz)?\s+(?:başarıyla\s+)?alındı/,
    /randevu(?:nuz)?\s+(?:başarıyla\s+)?kaydedildi/,
    /randevu(?:nuz)?\s+onaylanmıştır/,
    /randevu(?:nuz)?\s+tamamlandı/,
    /başarıyla\s+oluşturuldu/,
    /randevu\s+bilgileriniz/,
  ];
  return successPatterns.some((pattern) => pattern.test(normalized));
}

