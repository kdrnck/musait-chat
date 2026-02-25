import type { ConvexHttpClient } from "convex/browser";
import type { AgentJob, LLMMessage, AgentToolName } from "@musait/shared";
import { api } from "../lib/convex-api.js";
import { LLM_CONFIG, SUPABASE_CONFIG } from "../config.js";
import { buildSystemPrompt } from "./prompts.js";
import { executeToolCall, getToolDefinitions } from "./tools/index.js";
import { isLikelyRealName } from "./customer-name.js";

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
  const messages = await buildContext(convex, job, conversation);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // 2. Call LLM
    const response = await callOpenRouter(messages, {
      useReasoning: i === 0 && useReasoning,
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
): Promise<LLMMessage[]> {
  const messages: LLMMessage[] = [];
  let knownCustomerName: string | null = job.customerName || null;

  // System prompt
  const systemPrompt = buildSystemPrompt(conversation);
  messages.push({ role: "system", content: systemPrompt });

  if (conversation.tenantId) {
    const tenantCtx = await fetchTenantContext(conversation.tenantId);
    const extraPrompt =
      tenantCtx?.integrationKeys?.ai_extra_system_prompt?.trim() || "";
    const serviceLink = buildServiceLink(
      tenantCtx?.slug,
      job.inboundDisplayNumber
    );

    messages.push({
      role: "system",
      content:
        `[İşletme]: ${tenantCtx?.name || "Bilinmeyen İşletme"}\n` +
        `[Hizmet Linki]: ${serviceLink}\n` +
        `Kural: Müşteriyle ilk greeting cevabında bu linki kısa şekilde paylaşabilirsin.`,
    });

    if (extraPrompt) {
      messages.push({
        role: "system",
        content:
          "[Tenant Ek Sistem Promptu]\n" +
          extraPrompt.slice(0, 3000),
      });
    }
  }

  // Customer profile context (if available)
  if (conversation.tenantId) {
    const profile = await convex.query(api.customerProfiles.getByPhone, {
      tenantId: conversation.tenantId,
      customerPhone: job.customerPhone,
    });

    const profileName =
      typeof profile?.preferences?.customerName === "string"
        ? profile.preferences.customerName
        : null;

    if (!knownCustomerName && profileName) {
      knownCustomerName = profileName;
    }

    if (profile && (profile.personNotes || profile.preferences)) {
      messages.push({
        role: "system",
        content:
          `[Müşteri Notları]: ${profile.personNotes || "-"}\n` +
          `[Tercihler]: ${JSON.stringify(profile.preferences || {})}`,
      });
    }
  }

  if (!knownCustomerName && job.contactName && isLikelyRealName(job.contactName)) {
    knownCustomerName = job.contactName;
  }

  if (knownCustomerName) {
    messages.push({
      role: "system",
      content:
        `Bilinen müşteri adı: ${knownCustomerName}\n` +
        "Kural: Müşteri adını sadece selamlaşma ve randevu onay/özet mesajlarında doğal şekilde kullan.",
    });
  } else {
    messages.push({
      role: "system",
      content:
        "Müşteri adı kesin değil. İlk mesajlarda zorla isim sorma; randevuyu finalize etmeye yakın noktada nazikçe adını sor.",
    });
  }

  // Rolling summary (if exists)
  if (conversation.rollingSummary) {
    messages.push({
      role: "system",
      content: `[Konuşma Özeti]: ${conversation.rollingSummary}`,
    });
  }

  // Recent messages (context window)
  const recentMessages = await convex.query(api.messages.getContextWindow, {
    conversationId: conversation._id,
    limit: 20,
  });

  for (const msg of recentMessages) {
    if (msg.role === "customer") {
      messages.push({ role: "user", content: msg.content });
    } else if (msg.role === "agent") {
      messages.push({ role: "assistant", content: msg.content });
    } else if (msg.role === "human") {
      messages.push({
        role: "assistant",
        content: `[İnsan Operatör]: ${msg.content}`,
      });
    }
  }

  return messages;
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
  options: { useReasoning: boolean }
): Promise<OpenRouterResponse> {
  const providerOrder = LLM_CONFIG.providerPriority;
  const payload: Record<string, unknown> = {
    model: LLM_CONFIG.model,
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
      allow_fallbacks: LLM_CONFIG.providerAllowFallbacks,
    };
  }

  if (options.useReasoning && LLM_CONFIG.enableReasoningForComplex) {
    payload.reasoning = {
      enabled: true,
      effort: "low",
      exclude: true,
    };
  }

  const response = await fetch(
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice) {
    throw new Error("No response from OpenRouter");
  }

  return {
    content: choice.message?.content || null,
    tool_calls: choice.message?.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function?.name as AgentToolName,
      arguments:
        typeof tc.function?.arguments === "string"
          ? JSON.parse(tc.function.arguments)
          : tc.function?.arguments,
    })),
  };
}

async function fetchTenantContext(tenantId: string): Promise<{
  name: string | null;
  slug: string | null;
  integrationKeys: Record<string, string>;
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
    integration_keys?: Record<string, string>;
  }>;

  const tenant = rows[0];
  if (!tenant) return null;

  return {
    name: tenant.name || null,
    slug: tenant.slug || null,
    integrationKeys: tenant.integration_keys || {},
  };
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
