import type { ConvexHttpClient } from "convex/browser";
import type { AgentJob, LLMMessage } from "@musait/shared";
import { api } from "../lib/convex-api.js";
import { LLM_CONFIG } from "../config.js";
import { buildSystemPrompt } from "./prompts.js";
import { executeToolCall, getToolDefinitions } from "./tools/index.js";

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

  // 1. Build context
  const messages = await buildContext(convex, job, conversation);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // 2. Call LLM
    const response = await callOpenRouter(messages);

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

  // System prompt
  const systemPrompt = buildSystemPrompt(conversation);
  messages.push({ role: "system", content: systemPrompt });

  // Customer profile context (if available)
  if (conversation.tenantId) {
    const profile = await convex.query(api.customerProfiles.getByPhone, {
      tenantId: conversation.tenantId,
      customerPhone: job.customerPhone,
    });

    if (profile && profile.personNotes) {
      messages.push({
        role: "system",
        content: `[Müşteri Notları]: ${profile.personNotes}\n[Tercihler]: ${JSON.stringify(profile.preferences)}`,
      });
    }
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
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

async function callOpenRouter(
  messages: LLMMessage[]
): Promise<OpenRouterResponse> {
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
      body: JSON.stringify({
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
      }),
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
      name: tc.function?.name,
      arguments:
        typeof tc.function?.arguments === "string"
          ? JSON.parse(tc.function.arguments)
          : tc.function?.arguments,
    })),
  };
}
