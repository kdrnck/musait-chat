import type { ConvexHttpClient } from "convex/browser";
import type { AgentJob, LLMMessage, AgentToolName } from "@musait/shared";
import { api } from "../lib/convex-api.js";
import { LLM_CONFIG, SUPABASE_CONFIG } from "../config.js";
import { executeToolCall, getToolDefinitions } from "./tools/index.js";
import {
  resolveTenantAiSettings,
  type TenantAiSettings,
} from "./tenant-ai-settings.js";

interface Conversation {
  _id: any;
  tenantId: string | null;
  rollingSummary: string;
  personNotes: string;
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
): Promise<string> {
  const MAX_ITERATIONS = 5;
  const useReasoning = isComplexMessage(job.messageContent || "");

  // 1. Build context
  const context = await buildContext(convex, job, conversation);
  const messages = context.messages;
  const tenantAiSettings = context.tenantAiSettings;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // 2. Call LLM
    const response = await callOpenRouter(messages, {
      useReasoning: i === 0 && useReasoning,
      tenantAiSettings,
    });

    // 3. Check for tool calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      // Add assistant response to context
      messages.push({
        role: "assistant",
        content: response.content,
        tool_calls: response.tool_calls,
      });

      // Execute each tool call
      for (const toolCall of response.tool_calls) {
        console.log(`🔧 Tool call: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);

        const result = await executeToolCall(convex, toolCall, {
          tenantId: conversation.tenantId!,
          conversationId: conversation._id,
          customerPhone: job.customerPhone,
          customerName: job.customerName,
        });

        // Add tool result to context
        messages.push({
          role: "tool",
          content: JSON.stringify(result.result ?? result.error),
          tool_call_id: toolCall.id,
          name: toolCall.name,
        });
      }

      // Continue loop — LLM will process tool results
      continue;
    }

    // 4. No tool calls — return text response
    return response.content || "Üzgünüm, şu anda yanıt veremiyorum.";
  }

  return "Üzgünüm, işleminizi tamamlayamadım. Lütfen tekrar deneyin.";
}

// --- Build agent context ---

async function buildContext(
  convex: ConvexHttpClient,
  job: AgentJob,
  conversation: Conversation
): Promise<{ messages: LLMMessage[]; tenantAiSettings: TenantAiSettings }> {
  const messages: LLMMessage[] = [];
  
  // ========== STEP 1: FETCH SETTINGS ==========
  const globalPrompt = await fetchGlobalSettings();
  let tenantAiSettings = resolveTenantAiSettings(null, globalPrompt);
  let dashboardPrompt: string | null = null;

  console.log(`\n========== BUILD CONTEXT START ==========`);
  console.log(`📋 Tenant ID: ${conversation.tenantId || 'NULL (unbound)'}`);
  console.log(`📋 Customer Phone: ${job.customerPhone}`);

  if (conversation.tenantId) {
    const tenantCtx = await fetchTenantContext(conversation.tenantId);
    
    console.log(`📋 Tenant Context Fetched: ${tenantCtx ? 'YES' : 'NO'}`);
    console.log(`📋 Integration Keys: ${tenantCtx?.integrationKeys ? JSON.stringify(Object.keys(tenantCtx.integrationKeys)) : 'NONE'}`);
    
    if (tenantCtx?.integrationKeys) {
      const rawPrompt = tenantCtx.integrationKeys.ai_system_prompt_text;
      console.log(`📋 Raw ai_system_prompt_text type: ${typeof rawPrompt}`);
      console.log(`📋 Raw ai_system_prompt_text value (first 150 chars): ${rawPrompt ? String(rawPrompt).slice(0, 150) : 'NULL/UNDEFINED'}`);
    }
    
    tenantAiSettings = resolveTenantAiSettings(tenantCtx?.integrationKeys, globalPrompt);
    dashboardPrompt = tenantAiSettings.systemPromptText;
    
    console.log(`📋 Resolved System Prompt Length: ${dashboardPrompt?.length || 0}`);
    console.log(`📋 Resolved System Prompt (first 200 chars): ${dashboardPrompt ? dashboardPrompt.slice(0, 200) : 'NULL'}`);
  }

  // ========== STEP 2: SYSTEM PROMPT ==========
  // System prompt is the ONLY source of agent personality/rules
  // It comes from: Dashboard (tenant) > Global Settings > Minimal Fallback
  
  const systemPromptContent = dashboardPrompt || globalPrompt || "Sen yardımcı bir asistansın. Kullanıcının isteklerine Türkçe yanıt ver.";
  
  const systemPromptFormatted = `<system_prompt>
${systemPromptContent}
</system_prompt>`;

  messages.push({ role: "system", content: systemPromptFormatted });
  
  console.log(`✅ SYSTEM PROMPT ADDED (source: ${dashboardPrompt ? 'DASHBOARD' : globalPrompt ? 'GLOBAL' : 'FALLBACK'})`);
  console.log(`   Length: ${systemPromptContent.length} chars`);

  // ========== STEP 3: CUSTOMER PROFILE (if exists) ==========
  if (conversation.tenantId) {
    try {
      const profile = await convex.query(api.customerProfiles.getByPhone, {
        tenantId: conversation.tenantId,
        customerPhone: job.customerPhone,
      });

      if (profile) {
        const profileParts: string[] = [];
        
        if (profile.personNotes?.trim()) {
          profileParts.push(`<ai_notes>${profile.personNotes.trim()}</ai_notes>`);
        }
        
        if (profile.lastStaff?.length > 0) {
          profileParts.push(`<preferred_staff>${profile.lastStaff.join(", ")}</preferred_staff>`);
        }
        
        if (profile.lastServices?.length > 0) {
          profileParts.push(`<recent_services>${profile.lastServices.join(", ")}</recent_services>`);
        }

        const customerName = profile.preferences?.customerName;
        if (customerName && typeof customerName === "string") {
          profileParts.push(`<customer_name>${customerName}</customer_name>`);
        }

        if (profileParts.length > 0) {
          const profileContent = `<customer_profile>
${profileParts.join("\n")}
</customer_profile>`;
          
          messages.push({ role: "system", content: profileContent });
          console.log(`✅ CUSTOMER PROFILE ADDED (${profileParts.length} fields)`);
        }
      }
    } catch (err) {
      console.warn(`⚠️ Failed to fetch customer profile:`, err);
    }
  }

  // ========== STEP 4: MESSAGE HISTORY ==========
  const recentMessages = await convex.query(api.messages.getContextWindow, {
    conversationId: conversation._id,
    limit: 20,
  });

  console.log(`📋 Message History: ${recentMessages.length} messages`);

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
  tool_calls?: Array<{
    id: string;
    name: AgentToolName;
    arguments: Record<string, unknown>;
  }>;
}

async function callOpenRouter(
  messages: LLMMessage[],
  options: { useReasoning: boolean; tenantAiSettings: TenantAiSettings }
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

  if (
    options.useReasoning &&
    LLM_CONFIG.enableReasoningForComplex &&
    supportsReasoning(options.tenantAiSettings.model)
  ) {
    payload.reasoning = {
      enabled: true,
      effort: "low",
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

  // Attempt 2: 503/provider error → retry with allow_fallbacks=true, no provider order
  if (!response.ok) {
    const errorBody = await response.text();
    const is503OrProvider = response.status === 503 || response.status === 400 ||
      errorBody.includes("Provider returned error") ||
      errorBody.includes("503") ||
      errorBody.includes("无可用渠道");

    if (is503OrProvider) {
      console.warn(`⚠️ Provider error (${response.status}), retrying with full fallback...`);
      const fallbackPayload = {
        ...payload,
        provider: { allow_fallbacks: true },
      };
      response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LLM_CONFIG.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://musait.app",
            "X-Title": "Musait Chat Agent",
          },
          body: JSON.stringify(fallbackPayload),
        }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice) {
    throw new Error("No response from OpenRouter");
  }

  return {
    content: choice.message?.content || null,
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

async function fetchGlobalSettings(): Promise<string | null> {
  const url = new URL(`${SUPABASE_CONFIG.url}/rest/v1/global_settings`);
  url.searchParams.set("id", "eq.default");
  url.searchParams.set("select", "ai_system_prompt_text");
  url.searchParams.set("limit", "1");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_CONFIG.serviceKey,
        Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
      },
    });
    if (!response.ok) return null;

    const rows = (await response.json()) as Array<{ ai_system_prompt_text?: string | null }>;
    return rows[0]?.ai_system_prompt_text || null;
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

function isComplexMessage(message: string): boolean {
  if (!message) return false;
  const text = message.toLocaleLowerCase("tr-TR");
  const lengthScore = text.length >= 120;
  const hasDateToken =
    /(yarın|bugün|pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar|\d{1,2}[./-]\d{1,2})/i.test(
      text
    );
  const hasTimeToken = /([01]?\d|2[0-3])[:.]?[0-5]?\d/.test(text);
  const hasMultiIntent =
    /(ve|ayrıca|hem|sonra|ama|bir de|aynı anda|aynı mesaj)/i.test(text);
  const hasServiceAndBusiness =
    /(saç|tırnak|boya|cilt|masaj|hizmet|işletme|kuaför|salon)/i.test(text);

  const score = [lengthScore, hasDateToken, hasTimeToken, hasMultiIntent, hasServiceAndBusiness].filter(Boolean).length;
  return score >= 3;
}
