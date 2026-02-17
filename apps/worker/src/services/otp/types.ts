// OTP Module — Type Definitions

export interface OtpRequestParams {
  phoneE164: string;
  ipAddress: string;
  context: "signup" | "login";
  userAgent?: string;
}

export interface OtpRequestResult {
  success: true;
  requestId: string;
  phoneE164: string;
  otpCode: string;
  channel: "whatsapp";
  cooldownSeconds: number;
}

export interface OtpVerifyParams {
  phoneE164: string;
  code: string;
}

export interface OtpVerifyResult {
  success: boolean;
  /** Short magic link URL to send via WhatsApp */
  magicLinkUrl?: string;
  /** Failure reason */
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
