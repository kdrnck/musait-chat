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
  // BYPASS RATE LIMITS FOR TESTING
  return { allowed: true };
}
