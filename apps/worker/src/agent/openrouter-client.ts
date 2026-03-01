import type { LLMMessage, AgentToolName } from "@musait/shared";
import { LLM_CONFIG } from "../config.js";
import { getToolDefinitions } from "./tools/index.js";
import type { TenantAiSettings } from "./tenant-ai-settings.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 15_000;

const OPENROUTER_HEADERS = {
  "Content-Type": "application/json",
  "HTTP-Referer": "https://musait.app",
  "X-Title": "Musait Chat Agent",
} as const;

export interface OpenRouterResponse {
  content: string | null;
  thinking?: string | null;
  tool_calls?: Array<{
    id: string;
    name: AgentToolName;
    arguments: Record<string, unknown>;
    _parseError?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
}

export interface CallOpenRouterOptions {
  useReasoning: boolean;
  tenantAiSettings: TenantAiSettings;
  isAdminMode?: boolean;
  isSuperThink?: boolean;
  /** Tool definitions to include. If null, uses default getToolDefinitions(). */
  toolDefinitions?: ReturnType<typeof getToolDefinitions> | null;
}

function supportsReasoning(model: string): boolean {
  return /deepseek/i.test(model);
}

function makeHeaders(): Record<string, string> {
  return {
    ...OPENROUTER_HEADERS,
    Authorization: `Bearer ${LLM_CONFIG.apiKey}`,
  };
}

export async function callOpenRouter(
  messages: LLMMessage[],
  options: CallOpenRouterOptions
): Promise<OpenRouterResponse> {
  const providerOrder = options.tenantAiSettings.providerPriority;
  const tools = options.toolDefinitions !== undefined
    ? options.toolDefinitions
    : getToolDefinitions();

  const payload: Record<string, unknown> = {
    model: options.tenantAiSettings.model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      ...(m.name ? { name: m.name } : {}),
    })),
    temperature: LLM_CONFIG.temperature,
    max_tokens: LLM_CONFIG.maxTokens,
  };

  if (tools) {
    payload.tools = tools;
  }

  if (providerOrder.length > 0) {
    payload.provider = {
      order: providerOrder,
      allow_fallbacks: options.tenantAiSettings.allowFallbacks,
    };
  }

  // Reasoning mode (DeepSeek thinking)
  const shouldUseDeepReasoning = options.isAdminMode && options.isSuperThink;

  if (
    (options.useReasoning || shouldUseDeepReasoning) &&
    LLM_CONFIG.enableReasoningForComplex &&
    supportsReasoning(options.tenantAiSettings.model)
  ) {
    payload.reasoning = {
      enabled: true,
      effort: shouldUseDeepReasoning ? "high" : "low",
      exclude: true,
    };
  }

  // Attempt 1: with configured provider order
  const controller1 = new AbortController();
  const timeout1 = setTimeout(() => controller1.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: makeHeaders(),
      body: JSON.stringify(payload),
      signal: controller1.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`OpenRouter request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout1);
  }

  // Attempt 2: transient/provider error → retry with explicit tool-capable providers
  if (!response.ok) {
    const errorBody = await response.text();
    const isTransientOrProvider =
      response.status === 502 ||
      response.status === 503 ||
      response.status === 429 ||
      response.status === 404 ||
      errorBody.includes("Provider returned error") ||
      errorBody.includes("503") ||
      errorBody.includes("404") ||
      errorBody.includes("无可用渠道") ||
      errorBody.includes("does not exist");

    if (isTransientOrProvider) {
      console.warn(
        `⚠️ Provider error (${response.status}), retrying with explicit tool-capable providers...`
      );
      const fallbackPayload = {
        ...payload,
        provider: {
          order: ["deepinfra", "groq", "together"],
          allow_fallbacks: false,
        },
      };

      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), REQUEST_TIMEOUT_MS);

      try {
        response = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: makeHeaders(),
          body: JSON.stringify(fallbackPayload),
          signal: controller2.signal,
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          throw new Error(`OpenRouter retry timed out after ${REQUEST_TIMEOUT_MS}ms`);
        }
        throw err;
      } finally {
        clearTimeout(timeout2);
      }

      if (!response.ok) {
        const retryErrorBody = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${retryErrorBody}`);
      }
    } else {
      // Non-transient error (400, 422 etc.) — don't retry
      throw new Error(`OpenRouter API error (${response.status}): ${errorBody}`);
    }
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice) {
    throw new Error("No response from OpenRouter");
  }

  // Extract reasoning/thinking content
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
      let parseError: string | null = null;
      try {
        args =
          typeof tc.function?.arguments === "string"
            ? JSON.parse(tc.function.arguments)
            : tc.function?.arguments ?? {};
      } catch (e) {
        parseError = `Tool argument parse error for ${tc.function?.name}: ${e instanceof Error ? e.message : String(e)}`;
        console.warn(`⚠️ ${parseError}. Raw: ${tc.function?.arguments}`);
      }
      return {
        id: tc.id,
        name: (tc.function?.name ?? "unknown") as AgentToolName,
        arguments: args,
        _parseError: parseError,
      };
    }),
    usage: data.usage,
    model: data.model,
  };
}
