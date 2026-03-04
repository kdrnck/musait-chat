export type AiModelProfile = "cheap" | "fast" | "premium" | "oss-deepinfra" | "oss-groq";
export type OutboundNumberMode = "inbound" | "musait" | "tenant";

export interface AiModelPreset {
  label: string;
  model: string;
  providerPriority: string[];
  allowFallbacks: boolean;
}

export const AI_MODEL_PRESETS: Record<AiModelProfile, AiModelPreset> = {
  cheap: {
    label: "Ekonomik (Gemini Flash Lite)",
    model: "google/gemini-3.1-flash-lite-preview",
    providerPriority: [],
    allowFallbacks: true,
  },
  fast: {
    label: "Hızlı (Gemini 3 Flash)",
    model: "google/gemini-3-flash-preview",
    providerPriority: [],
    allowFallbacks: true,
  },
  premium: {
    label: "Premium (Claude Haiku 4.5)",
    model: "anthropic/claude-haiku-4.5",
    providerPriority: [],
    allowFallbacks: true,
  },
  "oss-deepinfra": {
    label: "GPT-OSS (DeepInfra)",
    model: "openai/gpt-oss-120b",
    providerPriority: ["deepinfra"],
    allowFallbacks: true,
  },
  "oss-groq": {
    label: "GPT-OSS (Groq)",
    model: "openai/gpt-oss-120b",
    providerPriority: ["groq"],
    allowFallbacks: true,
  },
};

export const DEFAULT_AI_MODEL_PROFILE: AiModelProfile = "fast";
export const DEFAULT_OUTBOUND_NUMBER_MODE: OutboundNumberMode = "inbound";

export interface ResolvedAiSettings {
  modelProfile: AiModelProfile;
  model: string;
  fallbackModel: string | null;
  providerPriority: string[];
  allowFallbacks: boolean;
  providerConfig: Record<string, unknown> | null;
  fallbackProviderConfig: Record<string, unknown> | null;
  promptText: string;
  outboundNumberMode: OutboundNumberMode;
  bookingFlowEnabled: boolean;
  maxIterations: number;
  llmTimeoutMs: number;
}

export const DEFAULT_MAX_ITERATIONS = 5;
export const DEFAULT_LLM_TIMEOUT_MS = 15000;

export function resolveAiSettingsFromIntegrationKeys(
  integrationKeys: unknown,
  globalSystemPrompt?: string | null
): ResolvedAiSettings {
  const keys = asObject(integrationKeys);

  const profileRaw = asString(keys.ai_model_profile)?.toLowerCase();
  const modelProfile: AiModelProfile =
    profileRaw === "cheap" || profileRaw === "fast" || profileRaw === "premium" || profileRaw === "oss-deepinfra" || profileRaw === "oss-groq"
      ? (profileRaw as AiModelProfile)
      : DEFAULT_AI_MODEL_PROFILE;

  const preset = AI_MODEL_PRESETS[modelProfile];

  const model = asString(keys.ai_model) || preset.model;
  const fallbackModel = asString(keys.ai_fallback_model);
  const providerPriority =
    parseProviderPriority(keys.ai_provider_priority) || preset.providerPriority;

  const allowFallbacks =
    asBoolean(keys.ai_allow_fallbacks) ?? preset.allowFallbacks;

  const promptOverride = asString(keys.ai_system_prompt_text);
  const legacyExtraPrompt = asString(keys.ai_extra_system_prompt);

  const basePrompt = promptOverride || globalSystemPrompt || "";
  const promptText = legacyExtraPrompt
    ? [basePrompt, "## Tenant Ek Talimatlar", legacyExtraPrompt]
      .filter((item) => !!item)
      .join("\n\n")
    : basePrompt;

  const outboundModeRaw = asString(keys.ai_outbound_number_mode)?.toLowerCase();
  const outboundNumberMode: OutboundNumberMode =
    outboundModeRaw === "inbound" ||
      outboundModeRaw === "musait" ||
      outboundModeRaw === "tenant"
      ? (outboundModeRaw as OutboundNumberMode)
      : DEFAULT_OUTBOUND_NUMBER_MODE;

  // Booking flow disabled by default - LLM handles conversation flow
  const bookingFlowEnabled = asBoolean(keys.ai_booking_flow_enabled) ?? false;

  const maxIterations = asPositiveInt(keys.ai_max_iterations, DEFAULT_MAX_ITERATIONS, 1, 10);
  const llmTimeoutMs = asPositiveInt(keys.ai_llm_timeout_ms, DEFAULT_LLM_TIMEOUT_MS, 3000, 30000);

  // Provider config from ai_models table (JSONB), stored in integration keys
  const providerConfigRaw = keys.ai_provider_config;
  const providerConfig: Record<string, unknown> | null =
    providerConfigRaw && typeof providerConfigRaw === "object" && !Array.isArray(providerConfigRaw)
      ? (providerConfigRaw as Record<string, unknown>)
      : typeof providerConfigRaw === "string"
        ? (() => { try { return JSON.parse(providerConfigRaw as string); } catch { return null; } })()
        : null;
  const fallbackProviderConfigRaw = keys.ai_fallback_provider_config;
  const fallbackProviderConfig: Record<string, unknown> | null =
    fallbackProviderConfigRaw && typeof fallbackProviderConfigRaw === "object" && !Array.isArray(fallbackProviderConfigRaw)
      ? (fallbackProviderConfigRaw as Record<string, unknown>)
      : typeof fallbackProviderConfigRaw === "string"
        ? (() => { try { return JSON.parse(fallbackProviderConfigRaw as string); } catch { return null; } })()
        : null;

  return {
    modelProfile,
    model,
    fallbackModel,
    providerPriority,
    allowFallbacks,
    providerConfig,
    fallbackProviderConfig,
    promptText,
    outboundNumberMode,
    bookingFlowEnabled,
    maxIterations,
    llmTimeoutMs,
  };
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function asPositiveInt(value: unknown, defaultVal: number, min: number, max: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(min, Math.min(max, Math.round(value)));
  }
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(min, Math.min(max, parsed));
    }
  }
  return defaultVal;
}

function parseProviderPriority(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const parsed = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    return parsed.length > 0 ? parsed : null;
  }

  if (typeof value === "string") {
    const parsed = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return parsed.length > 0 ? parsed : null;
  }

  return null;
}
