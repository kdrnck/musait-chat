// OTP Module — Configuration
// All OTP-specific constants and env var access.

export const OTP_CONFIG = {
  /** Length of the OTP code */
  CODE_LENGTH: 6,

  /** OTP expiration time in minutes */
  EXPIRATION_MINUTES: 10,

  /** Minimum seconds between OTP requests for the same phone */
  COOLDOWN_SECONDS: 60,

  /** Max verification attempts per OTP code */
  MAX_ATTEMPTS: 5,

  /** Rate limit: max OTP requests per phone per window */
  PHONE_RATE_LIMIT: {
    maxRequests: 5,
    windowMinutes: 60,
  },

  /** Rate limit: max OTP requests per IP per window */
  IP_RATE_LIMIT: {
    maxRequests: 10,
    windowMinutes: 60,
  },
} as const;

/**
 * OTP Hash Secret — used as salt for SHA-256 hashing.
 * MUST be set as Railway environment variable.
 * NEVER stored in DB or committed to source.
 */
export function getOtpHashSecret(): string {
  const secret = process.env.OTP_HASH_SECRET;
  if (!secret) {
    throw new Error(
      "OTP_HASH_SECRET environment variable is required but not set"
    );
  }
  return secret;
}

/**
 * The base URL of musait.app for constructing magic link callback URLs.
 */
export function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL || "https://musait.app";
}

/**
 * Internal API key for authenticating requests from musait.app to Railway.
 * Prevents unauthorized OTP requests.
 */
export function getInternalApiKey(): string {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) {
    throw new Error(
      "INTERNAL_API_KEY environment variable is required but not set"
    );
  }
  return key;
}
