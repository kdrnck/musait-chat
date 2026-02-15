// OTP Module — Cleanup Job
// Periodically removes expired OTP codes and stale rate limit records.
// Runs as a daily interval within the Railway worker process.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Cleanup interval: every 24 hours */
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Hold reference to interval for graceful shutdown */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the daily OTP cleanup job.
 * Calls cleanup_expired_otp_codes() Supabase function.
 *
 * Also runs immediately on start to clear any accumulated expired records.
 */
export function startOtpCleanupJob(supabase: SupabaseClient): void {
  // Run immediately on startup
  runCleanup(supabase);

  // Schedule daily
  cleanupInterval = setInterval(() => {
    runCleanup(supabase);
  }, CLEANUP_INTERVAL_MS);

  console.log("🧹 OTP cleanup job scheduled (every 24h)");
}

/**
 * Stop the cleanup job gracefully.
 */
export function stopOtpCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log("🧹 OTP cleanup job stopped");
  }
}

/**
 * Execute the cleanup logic.
 * Strategy:
 * 1. Try the stored procedure first (cleanup_expired_otp_codes)
 * 2. Fallback to manual DELETE if function doesn't exist
 */
async function runCleanup(supabase: SupabaseClient): Promise<void> {
  try {
    // Try stored procedure first
    const { error: rpcError } = await supabase.rpc(
      "cleanup_expired_otp_codes"
    );

    if (rpcError) {
      console.warn(
        "⚠️ cleanup_expired_otp_codes RPC failed, using manual cleanup:",
        rpcError.message
      );
      await manualCleanup(supabase);
      return;
    }

    console.log("🧹 OTP cleanup completed via stored procedure");
  } catch (err) {
    console.error("❌ OTP cleanup failed:", err);
  }
}

/**
 * Manual cleanup fallback.
 * Deletes OTP records older than 24 hours and expired rate limit windows.
 */
async function manualCleanup(supabase: SupabaseClient): Promise<void> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 24);
  const cutoffIso = cutoff.toISOString();

  // Delete expired OTP codes (older than 24h)
  const { error: otpError, count: otpCount } = await supabase
    .from("phone_login_codes")
    .delete({ count: "exact" })
    .lt("created_at", cutoffIso);

  if (otpError) {
    console.error("❌ Failed to cleanup OTP codes:", otpError);
  } else {
    console.log(`🧹 Deleted ${otpCount ?? 0} expired OTP codes`);
  }

  // Delete expired rate limit windows
  const { error: rlError, count: rlCount } = await supabase
    .from("otp_rate_limits")
    .delete({ count: "exact" })
    .lt("window_start", cutoffIso);

  if (rlError) {
    console.error("❌ Failed to cleanup rate limits:", rlError);
  } else {
    console.log(`🧹 Deleted ${rlCount ?? 0} expired rate limit records`);
  }
}
