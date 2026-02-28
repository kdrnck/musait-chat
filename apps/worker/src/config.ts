import type { QueueConfig } from "@musait/shared";

// Re-export with defaults for worker
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  concurrency: 3, // 3 parallel workers for throughput
  maxRetries: 3,
  retryBaseDelay: 1000, // 1s base, exponential backoff
  jobTimeout: 30_000, // 30s per job
};

// WhatsApp config
export const WHATSAPP_CONFIG = {
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  apiVersion: "v21.0",
  baseUrl: "https://graph.facebook.com",
} as const;

// OpenRouter config
export const LLM_CONFIG = {
  apiKey: process.env.OPENROUTER_API_KEY || "",
  model: process.env.LLM_MODEL || "deepseek/deepseek-chat",
  temperature: 0.7,
  maxTokens: 2048, // Turkish text needs more tokens; 1024 often truncates
  providerPriority: (process.env.LLM_PROVIDER_PRIORITY || "groq,deepinfra")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean),
  providerAllowFallbacks:
    (process.env.LLM_PROVIDER_ALLOW_FALLBACKS || "true").toLowerCase() !==
    "false",
  enableReasoningForComplex:
    (process.env.LLM_ENABLE_REASONING_COMPLEX || "true").toLowerCase() !==
    "false",
} as const;

// Supabase config (for appointment tool calls AND OTP)
export const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL || "",
  serviceKey: process.env.SUPABASE_SERVICE_KEY || "",
} as const;

// Meta webhook config
export const META_CONFIG = {
  appSecret: process.env.META_APP_SECRET || "",
} as const;

// Rate limiting
export const RATE_LIMIT = {
  globalMaxPerMinute: 60,
  tenantMaxPerMinute: 20,
  whatsappMaxPerSecond: 10,
} as const;
