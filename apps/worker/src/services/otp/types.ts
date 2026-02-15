// OTP Module — Type Definitions
// This module is INDEPENDENT from the agent module.
// No imports from agent/, queue/, or routing/.

export interface OtpRequestParams {
  /** Phone number in E.164 format */
  phoneE164: string;
  /** Client IP address for rate limiting */
  ipAddress: string;
  /** Context: signup or login */
  context: "signup" | "login";
  /** User agent string */
  userAgent?: string;
}

export interface OtpRequestResult {
  success: true;
  requestId: string;
  phoneE164: string;
  /** Cooldown in seconds before next request allowed */
  cooldownSeconds: number;
}

export interface OtpVerifyParams {
  /** Phone number in E.164 format */
  phoneE164: string;
  /** Raw OTP code from WhatsApp message */
  code: string;
}

export interface OtpVerifyResult {
  success: boolean;
  /** If success, the magic link URL to send via WhatsApp */
  magicLinkUrl?: string;
  /** If failed, the reason */
  error?: OtpVerifyError;
}

export type OtpVerifyError =
  | "no_active_otp"
  | "expired"
  | "max_attempts"
  | "invalid_code"
  | "already_used"
  | "internal_error";

export interface PhoneLoginCode {
  id: string;
  phone_e164: string;
  code_hash: string;
  channel: "whatsapp";
  context: "signup" | "login";
  created_at: string;
  expires_at: string;
  used_at: string | null;
  attempt_count: number;
  max_attempts: number;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
}

export interface OtpRateLimitCheck {
  identifier: string;
  identifierType: "phone" | "ip";
  maxRequests: number;
  windowMinutes: number;
}
