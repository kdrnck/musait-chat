export type AiModelProfile = "cheap" | "fast" | "premium" | "oss-deepinfra" | "oss-groq";
export type OutboundNumberMode = "inbound" | "musait" | "tenant";

/** Panel → DB'den gelen tier bazlı default modeller */
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

interface ModelPreset {
  model: string;
  providerPriority: string[];
  allowFallbacks: boolean;
}

const MODEL_PRESETS: Record<AiModelProfile, ModelPreset> = {
  cheap: {
    model: "google/gemini-3.1-flash-lite-preview",
    providerPriority: [],
    allowFallbacks: true,
  },
  fast: {
    model: "google/gemini-3-flash-preview",
    providerPriority: [],
    allowFallbacks: true,
  },
  premium: {
    model: "anthropic/claude-haiku-4.5",
    providerPriority: [],
    allowFallbacks: true,
  },
  "oss-deepinfra": {
    model: "openai/gpt-oss-120b",
    providerPriority: ["deepinfra"],
    allowFallbacks: true,
  },
  "oss-groq": {
    model: "openai/gpt-oss-120b",
    providerPriority: ["groq"],
    allowFallbacks: true,
  },
};

const DEFAULT_PROFILE: AiModelProfile = "fast";

export interface TenantAiSettings {
  modelProfile: AiModelProfile;
  model: string;
  providerPriority: string[];
  allowFallbacks: boolean;
  providerConfig: Record<string, unknown> | null;
  systemPromptText: string | null;
  legacyExtraSystemPrompt: string | null;
  outboundNumberMode: OutboundNumberMode;
  bookingFlowEnabled: boolean;
  maxIterations: number;
  llmTimeoutMs: number;
}

export function resolveTenantAiSettings(
  integrationKeys?: Record<string, unknown> | null,
  globalPrompt?: string | null
): TenantAiSettings {
  const keys = asRecord(integrationKeys);

  const profileRaw = asString(keys.ai_model_profile)?.toLowerCase();
  const modelProfile: AiModelProfile =
    profileRaw === "cheap" || profileRaw === "fast" || profileRaw === "premium" ||
    profileRaw === "oss-deepinfra" || profileRaw === "oss-groq"
      ? (profileRaw as AiModelProfile)
      : DEFAULT_PROFILE;

  const preset = MODEL_PRESETS[modelProfile];

  const rawModel = asString(keys.ai_model);
  // Normalize legacy model slugs that OpenRouter has retired
  const MODEL_ALIASES: Record<string, string> = {
    "deepseek/deepseek-chat": "deepseek/deepseek-chat-v3-0324",
    "deepseek/deepseek-chat-v3-0324": "google/gemini-3-flash-preview",
  };
  const normalizedModel = rawModel ? (MODEL_ALIASES[rawModel] ?? rawModel) : null;
  // Model önceliği: 1) DB'deki ai_model  2) Preset model  3) Hardcoded default
  // .env KULLANILMAZ — model her zaman panelden yönetilir
  const model = normalizedModel || preset.model || DEFAULT_MODEL;

  const providerPriority =
    parseProviderPriority(keys.ai_provider_priority) ||
    (preset.providerPriority.length > 0
      ? preset.providerPriority
      : []);

  const allowFallbacks =
    asBoolean(keys.ai_allow_fallbacks) ??
    preset.allowFallbacks ??
    true;

  const systemPromptText = asString(keys.ai_system_prompt_text) || globalPrompt || null;
  const legacyExtraSystemPrompt = asString(keys.ai_extra_system_prompt);

  const modeRaw = asString(keys.ai_outbound_number_mode)?.toLowerCase();
  const outboundNumberMode: OutboundNumberMode =
    modeRaw === "inbound" || modeRaw === "musait" || modeRaw === "tenant"
      ? (modeRaw as OutboundNumberMode)
      : "inbound";

  // Booking flow disabled by default - LLM handles conversation flow
  const bookingFlowEnabled = asBoolean(keys.ai_booking_flow_enabled) ?? false;

  const maxIterations = asPositiveInt(keys.ai_max_iterations, 5, 1, 10);
  const llmTimeoutMs = asPositiveInt(keys.ai_llm_timeout_ms, 8000, 3000, 30000);

  // Provider config from ai_models table (JSONB), stored in integration keys
  const providerConfigRaw = keys.ai_provider_config;
  const providerConfig: Record<string, unknown> | null =
    providerConfigRaw && typeof providerConfigRaw === "object" && !Array.isArray(providerConfigRaw)
      ? (providerConfigRaw as Record<string, unknown>)
      : typeof providerConfigRaw === "string"
        ? (() => { try { return JSON.parse(providerConfigRaw); } catch { return null; } })()
        : null;

  return {
    modelProfile,
    model,
    providerPriority,
    allowFallbacks,
    providerConfig,
    systemPromptText,
    legacyExtraSystemPrompt,
    outboundNumberMode,
    bookingFlowEnabled,
    maxIterations,
    llmTimeoutMs,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
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
  if (typeof value === "number" && Number.isFinite(value))
    return Math.max(min, Math.min(max, Math.round(value)));
  if (typeof value === "string") {
    const p = parseInt(value, 10);
    if (Number.isFinite(p)) return Math.max(min, Math.min(max, p));
  }
  return defaultVal;
}

function parseProviderPriority(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const list = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);

    return list.length > 0 ? list : null;
  }

  if (typeof value === "string") {
    const list = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return list.length > 0 ? list : null;
  }

  return null;
}
