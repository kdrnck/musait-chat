import type { LLMMessage, AgentToolName } from "@musait/shared";
import { LLM_CONFIG } from "../config.js";
import { getToolDefinitions } from "./tools/index.js";
import type { TenantAiSettings } from "./tenant-ai-settings.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

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
    /** Tokens served from cache (~75% cheaper) */
    cache_read_tokens?: number;
    /** Tokens written to cache this request */
    cache_creation_tokens?: number;
    /** Alias used by some providers */
    prompt_tokens_cached?: number;
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
  return /deepseek|gemini/i.test(model);
}

function makeHeaders(): Record<string, string> {
  return {
    ...OPENROUTER_HEADERS,
    Authorization: `Bearer ${LLM_CONFIG.apiKey}`,
  };
}

/**
 * Build the message array for the OpenRouter API.
 *
 * Prompt caching: mark the system message with cache_control: ephemeral.
 * Providers that support it (DeepSeek, Anthropic, Google) will cache the
 * prefix up to that point and serve it at ~75% fewer tokens on repeated calls
 * (same tenant = same system prompt = cache hit every time).
 *
 * Silently ignored on providers that don't support it (Groq etc.).
 */
function buildMessages(messages: LLMMessage[]): unknown[] {
  return messages.map((m) => {
    const base: Record<string, unknown> = {
      role: m.role,
      content: m.content,
    };

    if (m.tool_calls) base.tool_calls = m.tool_calls;
    if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
    if (m.name) base.name = m.name;

    // Apply cache_control to the system message — biggest, most static content.
    // Always safe to include; providers apply it only if the prefix meets their
    // minimum token threshold (DeepSeek >= 1024, Anthropic >= 2048).
    if (
      m.role === "system" &&
      typeof m.content === "string" &&
      m.content.length > 200
    ) {
      base.content = [
        {
          type: "text",
          text: m.content,
          cache_control: { type: "ephemeral" },
        },
      ];
    }

    return base;
  });
}

export async function callOpenRouter(
  messages: LLMMessage[],
  options: CallOpenRouterOptions
): Promise<OpenRouterResponse> {
  const providerOrder = options.tenantAiSettings.providerPriority;
  const tools =
    options.toolDefinitions !== undefined
      ? options.toolDefinitions
      : getToolDefinitions();

  const payload: Record<string, unknown> = {
    model: options.tenantAiSettings.model,
    messages: buildMessages(messages),
    temperature: LLM_CONFIG.temperature,
    max_tokens: LLM_CONFIG.maxTokens,
  };

  // Log which model + provider is being used
  const providerInfo = options.tenantAiSettings.providerConfig
    ? "provider_config (registry)"
    : options.tenantAiSettings.providerPriority.length > 0
      ? options.tenantAiSettings.providerPriority.join(",")
      : "auto (OpenRouter default)";
  console.log(
    `🤖 LLM Call → model: ${options.tenantAiSettings.model} | provider: ${providerInfo}`
  );

  if (tools) {
    payload.tools = tools;
  }

  // Build provider object: prefer full providerConfig (from ai_models table),
  // fall back to legacy providerPriority array
  if (options.tenantAiSettings.providerConfig && Object.keys(options.tenantAiSettings.providerConfig).length > 0) {
    // Full provider routing config from ai_models.provider_config JSONB
    payload.provider = { ...options.tenantAiSettings.providerConfig };
  } else if (providerOrder.length > 0) {
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

  // Use tenant-configured timeout or fall back to default
  const timeoutMs =
    options.tenantAiSettings.llmTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;

  // Attempt 1: with configured provider order
  const controller1 = new AbortController();
  const timeout1 = setTimeout(() => controller1.abort(), timeoutMs);

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
      throw new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout1);
  }

  // Attempt 2: transient/provider error → retry with relaxed fallback strategy
  if (!response.ok) {
    const errorBody = await response.text();
    const errorBodyLower = errorBody.toLowerCase();
    const isModelMissing =
      errorBodyLower.includes("does not exist") ||
      errorBodyLower.includes("model not found");
    const hasTransientProviderHint =
      errorBody.includes("Provider returned error") ||
      errorBody.includes("无可用渠道");
    const isTransientOrProvider =
      response.status === 429 ||
      response.status >= 500 ||
      (!isModelMissing && response.status === 400 && hasTransientProviderHint);

    console.warn(
      `⚠️ OpenRouter non-OK response status=${response.status} body=${errorBody.slice(0, 600)}`
    );

    if (isTransientOrProvider) {
      console.warn(
        `⚠️ Provider error (${response.status}), retrying with relaxed fallback...`
      );

      const userProviders = providerOrder.length > 0 ? providerOrder : [];
      const broadenedOrder = [
        ...userProviders,
        ...["deepinfra", "together", "fireworks"].filter(
          (p) => !userProviders.includes(p)
        ),
      ];

      const fallbackPayload = {
        ...payload,
        provider: {
          order: broadenedOrder,
          allow_fallbacks: true,
        },
      };

      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), timeoutMs);

      try {
        response = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: makeHeaders(),
          body: JSON.stringify(fallbackPayload),
          signal: controller2.signal,
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          throw new Error(`OpenRouter retry timed out after ${timeoutMs}ms`);
        }
        throw err;
      } finally {
        clearTimeout(timeout2);
      }

      if (!response.ok) {
        const retryErrorBody = await response.text();
        throw new Error(
          `OpenRouter API error (${response.status}): ${retryErrorBody}`
        );
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

  // Log cache stats when provider returns them
  if (data.usage) {
    const cached =
      data.usage.cache_read_tokens ??
      data.usage.prompt_tokens_cached ??
      0;
    const created = data.usage.cache_creation_tokens ?? 0;
    const total = data.usage.prompt_tokens ?? 0;

    if (cached > 0 && total > 0) {
      console.log(
        `💾 Prompt cache HIT: ${cached}/${total} tokens from cache ` +
          `(${Math.round((cached / total) * 100)}% hit rate)`
      );
    } else if (created > 0) {
      console.log(
        `💾 Prompt cache WRITE: ${created} tokens written to cache`
      );
    }
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
        parseError = `Tool argument parse error for ${tc.function?.name}: ${
          e instanceof Error ? e.message : String(e)
        }`;
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
