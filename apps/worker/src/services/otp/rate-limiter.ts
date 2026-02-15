// OTP Module — Rate Limiting
// Uses Supabase RPC for sliding window rate limiting.
// No coupling with agent or queue modules.

import type { SupabaseClient } from "@supabase/supabase-js";
import { OTP_CONFIG } from "./config.js";

interface RateLimitResult {
  allowed: boolean;
  reason?: "phone_rate_limit" | "ip_rate_limit" | "cooldown";
  retryAfterSeconds?: number;
}

/**
 * Check all rate limits for an OTP request.
 * Checks in order:
 * 1. Phone cooldown (60s between requests)
 * 2. Phone rate limit (5 per 60 min)
 * 3. IP rate limit (10 per 60 min)
 *
 * @param supabase - Supabase admin client
 * @param phoneE164 - Phone number in E.164 format
 * @param ipAddress - Client IP address
 * @returns Whether the request is allowed
 */
export async function checkOtpRateLimit(
  supabase: SupabaseClient,
  phoneE164: string,
  ipAddress: string
): Promise<RateLimitResult> {
  // 1. Check cooldown — last OTP request for this phone within 60s
  const { data: recentOtp } = await supabase
    .from("phone_login_codes")
    .select("created_at")
    .eq("phone_e164", phoneE164)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (recentOtp) {
    const createdAt = new Date(recentOtp.created_at).getTime();
    const elapsed = (Date.now() - createdAt) / 1000;
    const cooldown = OTP_CONFIG.COOLDOWN_SECONDS;

    if (elapsed < cooldown) {
      return {
        allowed: false,
        reason: "cooldown",
        retryAfterSeconds: Math.ceil(cooldown - elapsed),
      };
    }
  }

  // 2. Check phone rate limit via DB function
  const { data: phoneAllowed } = await supabase.rpc("check_otp_rate_limit", {
    p_identifier: phoneE164,
    p_identifier_type: "phone",
    p_max_requests: OTP_CONFIG.PHONE_RATE_LIMIT.maxRequests,
    p_window_minutes: OTP_CONFIG.PHONE_RATE_LIMIT.windowMinutes,
  });

  if (phoneAllowed === false) {
    return {
      allowed: false,
      reason: "phone_rate_limit",
      retryAfterSeconds: OTP_CONFIG.PHONE_RATE_LIMIT.windowMinutes * 60,
    };
  }

  // 3. Check IP rate limit via DB function
  const { data: ipAllowed } = await supabase.rpc("check_otp_rate_limit", {
    p_identifier: ipAddress,
    p_identifier_type: "ip",
    p_max_requests: OTP_CONFIG.IP_RATE_LIMIT.maxRequests,
    p_window_minutes: OTP_CONFIG.IP_RATE_LIMIT.windowMinutes,
  });

  if (ipAllowed === false) {
    return {
      allowed: false,
      reason: "ip_rate_limit",
      retryAfterSeconds: OTP_CONFIG.IP_RATE_LIMIT.windowMinutes * 60,
    };
  }

  return { allowed: true };
}
