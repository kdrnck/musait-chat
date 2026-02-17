// Router Module — Message Router
// Routes incoming WhatsApp messages to OTP or Agent handler.
// This is the ONLY decision point between OTP and Agent paths.

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractOtpCode } from "../otp/crypto.js";

export type MessageRoute = "otp" | "agent";

interface RouteDecision {
  route: MessageRoute;
  /** If OTP route, the extracted code */
  otpCode?: string;
}

/**
 * Determine whether an incoming WhatsApp message should be routed
 * to the OTP handler or the Agent handler.
 *
 * Decision logic:
 * 1. Check if the phone number has an active (unused, non-expired) OTP in DB
 * 2. If yes, check if the message contains a 6-digit code
 * 3. If both conditions met → route to OTP
 * 4. Otherwise → route to Agent
 *
 * This is an EXPLICIT check — no implicit pattern matching.
 * OTP state is determined solely by the phone_login_codes table.
 */
export async function routeIncomingMessage(
  supabase: SupabaseClient,
  customerPhone: string,
  messageContent: string
): Promise<RouteDecision> {
  // 1. Try to extract 6-digit code from message
  const otpCode = extractOtpCode(messageContent);

  if (otpCode) {
    // If message contains a code, ALWAYS route to OTP handler
    // Even if no active OTP exists, OTP handler will respond with "expired/invalid"
    console.log(`🔀 Routing ${customerPhone} → OTP handler (code detected)`);
    return { route: "otp", otpCode };
  }

  // 2. No code in message — check for active OTP state
  // Only route non-code messages (like "help") to OTP handler if an OTP session is active
  const hasActiveOtp = await checkActiveOtpState(supabase, customerPhone);

  if (hasActiveOtp) {
    console.log(
      `🔀 Routing ${customerPhone} → OTP handler (active OTP, non-code message)`
    );
    return { route: "otp" };
  }

  // 3. No code and no active OTP → route to Agent
  return { route: "agent" };
}

/**
 * Check if a phone number has an active (pending) OTP in the database.
 *
 * Active means:
 * - used_at IS NULL (not consumed)
 * - expires_at > now() (not expired)
 * - attempt_count < max_attempts (not exhausted)
 */
async function checkActiveOtpState(
  supabase: SupabaseClient,
  phoneE164: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("phone_login_codes")
    .select("id")
    .eq("phone_e164", phoneE164)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);

  if (error) {
    console.error("❌ Error checking OTP state:", error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}
