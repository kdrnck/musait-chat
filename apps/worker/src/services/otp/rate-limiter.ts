import type { SupabaseClient } from "@supabase/supabase-js";
import { OTP_CONFIG } from "./config.js";

interface RateLimitResult {
  allowed: boolean;
  reason?: "phone_rate_limit" | "ip_rate_limit" | "cooldown";
  retryAfterSeconds?: number;
}

type WindowCheckResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

type RateRow = {
  id: string;
  request_count: number;
  window_start: string;
  window_minutes: number;
};

type LatestOtpRow = {
  created_at: string;
};

function secondsUntil(dateIso: string): number {
  const target = new Date(dateIso).getTime();
  const diffMs = target - Date.now();
  return Math.max(0, Math.ceil(diffMs / 1000));
}

async function checkCooldown(
  supabase: SupabaseClient,
  phoneE164: string
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const { data, error } = await supabase
    .from("phone_login_codes")
    .select("created_at")
    .eq("phone_e164", phoneE164)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<LatestOtpRow>();

  if (error) {
    console.error("Failed to check OTP cooldown:", error);
    return { allowed: false, retryAfterSeconds: OTP_CONFIG.COOLDOWN_SECONDS };
  }

  if (!data) return { allowed: true };

  const nextAllowedAt = new Date(data.created_at);
  nextAllowedAt.setSeconds(nextAllowedAt.getSeconds() + OTP_CONFIG.COOLDOWN_SECONDS);
  const retryAfterSeconds = secondsUntil(nextAllowedAt.toISOString());

  if (retryAfterSeconds > 0) {
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true };
}

async function checkSlidingWindow(
  supabase: SupabaseClient,
  identifier: string,
  identifierType: "phone" | "ip",
  maxRequests: number,
  windowMinutes: number
): Promise<WindowCheckResult> {
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: row, error: selectError } = await supabase
    .from("otp_rate_limits")
    .select("id, request_count, window_start, window_minutes")
    .eq("identifier", identifier)
    .eq("identifier_type", identifierType)
    .order("window_start", { ascending: false })
    .limit(1)
    .maybeSingle<RateRow>();

  if (selectError) {
    console.error("Failed to read otp_rate_limits:", selectError);
    return { allowed: false, retryAfterSeconds: windowMinutes * 60 };
  }

  if (!row) {
    const { error: insertError } = await supabase.from("otp_rate_limits").insert({
      identifier,
      identifier_type: identifierType,
      request_count: 1,
      window_start: nowIso,
      window_minutes: windowMinutes,
    });

    if (insertError) {
      console.error("Failed to insert otp_rate_limits:", insertError);
      return { allowed: false, retryAfterSeconds: windowMinutes * 60 };
    }

    return { allowed: true };
  }

  const windowStart = new Date(row.window_start);
  const windowEnd = new Date(windowStart);
  windowEnd.setMinutes(windowEnd.getMinutes() + row.window_minutes);

  if (now > windowEnd) {
    const { error: resetError } = await supabase
      .from("otp_rate_limits")
      .update({
        request_count: 1,
        window_start: nowIso,
        window_minutes: windowMinutes,
      })
      .eq("id", row.id);

    if (resetError) {
      console.error("Failed to reset otp_rate_limits window:", resetError);
      return { allowed: false, retryAfterSeconds: windowMinutes * 60 };
    }

    return { allowed: true };
  }

  if (row.request_count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: secondsUntil(windowEnd.toISOString()),
    };
  }

  const { error: incrementError } = await supabase
    .from("otp_rate_limits")
    .update({ request_count: row.request_count + 1 })
    .eq("id", row.id);

  if (incrementError) {
    console.error("Failed to increment otp_rate_limits:", incrementError);
    return { allowed: false, retryAfterSeconds: windowMinutes * 60 };
  }

  return { allowed: true };
}

export async function checkOtpRateLimit(
  supabase: SupabaseClient,
  phoneE164: string,
  ipAddress: string
): Promise<RateLimitResult> {
  const cooldown = await checkCooldown(supabase, phoneE164);
  if (!cooldown.allowed) {
    return {
      allowed: false,
      reason: "cooldown",
      retryAfterSeconds: cooldown.retryAfterSeconds,
    };
  }

  const phoneWindow = await checkSlidingWindow(
    supabase,
    phoneE164,
    "phone",
    OTP_CONFIG.PHONE_RATE_LIMIT.maxRequests,
    OTP_CONFIG.PHONE_RATE_LIMIT.windowMinutes
  );
  if (!phoneWindow.allowed) {
    return {
      allowed: false,
      reason: "phone_rate_limit",
      retryAfterSeconds: phoneWindow.retryAfterSeconds,
    };
  }

  const ipWindow = await checkSlidingWindow(
    supabase,
    ipAddress,
    "ip",
    OTP_CONFIG.IP_RATE_LIMIT.maxRequests,
    OTP_CONFIG.IP_RATE_LIMIT.windowMinutes
  );
  if (!ipWindow.allowed) {
    return {
      allowed: false,
      reason: "ip_rate_limit",
      retryAfterSeconds: ipWindow.retryAfterSeconds,
    };
  }

  return { allowed: true };
}
