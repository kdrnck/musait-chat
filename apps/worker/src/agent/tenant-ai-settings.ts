import { LLM_CONFIG } from "../config.js";

// ─────────────────────────────────────────────────────────────────────────────
// 🧪 TEST MODEL OVERRIDE — set to a model string to force all tenants to use
//    that model regardless of their settings. Set to null to disable.
//    Example: "openai/gpt-4o-mini"  |  "google/gemini-2.0-flash-001"
//    ⚠️  ONLY active outside production. Always set back to null before deploy.
// ─────────────────────────────────────────────────────────────────────────────
const TEST_MODEL_OVERRIDE: string | null = null;
if (TEST_MODEL_OVERRIDE && process.env.NODE_ENV === "production") {
  console.warn(
    "⚠️  [TEST_MODEL_OVERRIDE] is set in production — this forces all tenants onto a single model. Set it to null immediately."
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export type AiModelProfile = "cheap" | "fast" | "premium" | "oss-deepinfra" | "oss-groq";
export type OutboundNumberMode = "inbound" | "musait" | "tenant";

interface ModelPreset {
  model: string;
  providerPriority: string[];
  allowFallbacks: boolean;
}

const MODEL_PRESETS: Record<AiModelProfile, ModelPreset> = {
  cheap: {
    model: "deepseek/deepseek-chat-v3-0324",
    providerPriority: ["deepinfra", "groq"],
    allowFallbacks: true,
  },
  fast: {
    model: "deepseek/deepseek-chat-v3-0324",
    providerPriority: ["groq", "deepinfra"],
    allowFallbacks: true,
  },
  premium: {
    model: "google/gemini-2.5-flash-preview",
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
  systemPromptText: string | null;
  legacyExtraSystemPrompt: string | null;
  outboundNumberMode: OutboundNumberMode;
  bookingFlowEnabled: boolean;
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
  };
  const normalizedModel = rawModel ? (MODEL_ALIASES[rawModel] ?? rawModel) : null;
  // Priority: TEST_MODEL_OVERRIDE > tenant ai_model key > profile preset > global LLM_CONFIG default
  const model = (TEST_MODEL_OVERRIDE && process.env.NODE_ENV !== "production" ? TEST_MODEL_OVERRIDE : null)
    || normalizedModel || preset.model || LLM_CONFIG.model;

  const providerPriority =
    parseProviderPriority(keys.ai_provider_priority) ||
    (preset.providerPriority.length > 0
      ? preset.providerPriority
      : LLM_CONFIG.providerPriority);

  const allowFallbacks =
    asBoolean(keys.ai_allow_fallbacks) ??
    preset.allowFallbacks ??
    LLM_CONFIG.providerAllowFallbacks;

  const systemPromptText = asString(keys.ai_system_prompt_text) || globalPrompt || null;
  const legacyExtraSystemPrompt = asString(keys.ai_extra_system_prompt);

  const modeRaw = asString(keys.ai_outbound_number_mode)?.toLowerCase();
  const outboundNumberMode: OutboundNumberMode =
    modeRaw === "inbound" || modeRaw === "musait" || modeRaw === "tenant"
      ? (modeRaw as OutboundNumberMode)
      : "inbound";

  // Booking flow disabled by default - LLM handles conversation flow
  const bookingFlowEnabled = asBoolean(keys.ai_booking_flow_enabled) ?? false;

  return {
    modelProfile,
    model,
    providerPriority,
    allowFallbacks,
    systemPromptText,
    legacyExtraSystemPrompt,
    outboundNumberMode,
    bookingFlowEnabled,
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
