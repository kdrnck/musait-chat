// OTP Module — Core Service
// Clean rewrite: OTP generation, verification, magic link via short code.
// NO polling. NO token extraction. NO manual verifyOtp.

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateOtpCode, hashOtpCode, calculateExpiration } from "./crypto.js";
import { checkOtpRateLimit } from "./rate-limiter.js";
import { getAppBaseUrl, OTP_CONFIG } from "./config.js";
import crypto from "crypto";
import type {
  OtpRequestParams,
  OtpRequestResult,
  OtpVerifyParams,
  OtpVerifyResult,
} from "./types.js";

// ═══════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════

/**
 * Request a new OTP code.
 *
 * 1. Check rate limits
 * 2. Generate 6-digit code
 * 3. Hash and store in DB
 * 4. Return raw code to client (client shows it + wa.me link)
 */
export async function requestOtp(
  supabase: SupabaseClient,
  params: OtpRequestParams
): Promise<OtpRequestResult | { success: false; error: string; retryAfterSeconds?: number }> {
  const { phoneE164, ipAddress, context, userAgent } = params;

  // Rate limit check
  const rateCheck = await checkOtpRateLimit(supabase, phoneE164, ipAddress);
  if (!rateCheck.allowed) {
    console.warn(`🚫 OTP rate limited: ${phoneE164} — ${rateCheck.reason}`);
    return {
      success: false,
      error: rateCheck.reason || "rate_limited",
      retryAfterSeconds: rateCheck.retryAfterSeconds,
    };
  }

  // Generate & store
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = calculateExpiration();

  const { data: otpRecord, error: insertError } = await supabase
    .from("phone_login_codes")
    .insert({
      phone_e164: phoneE164,
      code_hash: codeHash,
      channel: "whatsapp",
      context,
      expires_at: expiresAt,
      attempt_count: 0,
      max_attempts: OTP_CONFIG.MAX_ATTEMPTS,
      ip_address: ipAddress,
      user_agent: userAgent || null,
      metadata: {},
    })
    .select("id")
    .single();

  if (insertError || !otpRecord) {
    console.error("❌ Failed to insert OTP record:", insertError);
    return { success: false, error: "internal_error" };
  }

  console.log(`📤 OTP generated for ${phoneE164} (requestId: ${otpRecord.id})`);

  return {
    success: true,
    requestId: otpRecord.id,
    phoneE164,
    otpCode: code,
    channel: "whatsapp",
    cooldownSeconds: OTP_CONFIG.COOLDOWN_SECONDS,
  };
}

/**
 * Verify an OTP code received via WhatsApp.
 *
 * 1. Hash submitted code, atomic UPDATE to mark as used
 * 2. Resolve or create user
 * 3. Generate Supabase magic link (action_link)
 * 4. Generate short code, store mapping in DB
 * 5. Return short magic link URL for WhatsApp delivery
 *
 * The short URL (musait.app/auth/magic/CODE) redirects to Supabase's
 * own verify endpoint. Supabase handles token verification internally.
 */
export async function verifyOtp(
  supabase: SupabaseClient,
  params: OtpVerifyParams
): Promise<OtpVerifyResult> {
  const { phoneE164, code } = params;
  const codeHash = hashOtpCode(code);

  // Atomic verification
  const { data: verified, error: verifyError } = await supabase
    .from("phone_login_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("phone_e164", phoneE164)
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .lt("attempt_count", OTP_CONFIG.MAX_ATTEMPTS)
    .select("id, context")
    .single();

  if (verifyError || !verified) {
    await incrementAttemptCount(supabase, phoneE164);
    const reason = await diagnoseOtpFailure(supabase, phoneE164, codeHash);
    console.warn(`❌ OTP verification failed for ${phoneE164}: ${reason}`);
    return { success: false, error: reason };
  }

  console.log(`✅ OTP verified for ${phoneE164} (record: ${verified.id})`);

  // Resolve or create user
  const user = await resolveOrCreateUser(
    supabase,
    phoneE164,
    verified.context as "signup" | "login"
  );

  if (!user) {
    console.error(`❌ Failed to resolve user for ${phoneE164}`);
    return { success: false, error: "internal_error" };
  }

  // Generate magic link (Supabase action_link + short code)
  const magicLink = await generateMagicLink(
    supabase,
    user.email,
    verified.context as "signup" | "login"
  );

  if (!magicLink) {
    return { success: false, error: "internal_error" };
  }

  // Store short code mapping in OTP record metadata
  await supabase
    .from("phone_login_codes")
    .update({
      metadata: {
        short_code: magicLink.shortCode,
        supabase_verify_url: magicLink.supabaseVerifyUrl,
        verified_at: new Date().toISOString(),
      },
    })
    .eq("id", verified.id);

  console.log(`🔗 Short magic link: ${magicLink.shortUrl}`);

  return {
    success: true,
    magicLinkUrl: magicLink.shortUrl,
  };
}

// ═══════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════

/**
 * Generate a Supabase magic link and create a short redirect URL.
 *
 * Uses admin.generateLink to get Supabase's action_link.
 * Fixes redirect_to to point to musait.app.
 * Generates a short code for a branded URL.
 *
 * Flow when user clicks musait.app/auth/magic/CODE:
 *   1. Main App looks up CODE in DB → gets supabase_verify_url
 *   2. Main App redirects user to supabase_verify_url
 *   3. Supabase verifies token internally → redirects to musait.app/auth/callback
 *   4. Main App callback handles session creation
 */
async function generateMagicLink(
  supabase: SupabaseClient,
  email: string,
  context: "signup" | "login"
): Promise<{ shortCode: string; shortUrl: string; supabaseVerifyUrl: string } | null> {
  const baseUrl = getAppBaseUrl();
  const nextPath = context === "signup" ? "/profil/duzenle" : "/app";
  const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo,
    },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("❌ Failed to generate magic link:", linkError || "No action_link");
    return null;
  }

  // Fix redirect_to in the Supabase action_link (in case options.redirectTo was ignored)
  const actionUrl = new URL(linkData.properties.action_link);
  actionUrl.searchParams.set("redirect_to", redirectTo);
  const supabaseVerifyUrl = actionUrl.toString();

  // Generate short code (8 chars, URL-safe)
  const shortCode = crypto.randomBytes(6).toString("base64url").substring(0, 8);
  const shortUrl = `${baseUrl}/auth/magic/${shortCode}`;

  return { shortCode, shortUrl, supabaseVerifyUrl };
}

/**
 * Find existing user by phone or create a new one.
 */
async function resolveOrCreateUser(
  supabase: SupabaseClient,
  phoneE164: string,
  context: "signup" | "login"
): Promise<{ id: string; email: string } | null> {
  // 1. Check profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("phone_e164", phoneE164)
    .limit(1)
    .single();

  if (profile) {
    let email = profile.email;
    if (!email) {
      // Fallback: get email from auth.users
      const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
      email = authUser?.user?.email || "";
    }
    return { id: profile.id, email };
  }

  // 2. No user found — create one
  if (context === "login") {
    console.warn(`⚠️ Login but no user for ${phoneE164}, creating new user`);
  }

  const digits = phoneE164.replace(/\D/g, "");
  const placeholderEmail = `${digits}@phone.musait.app`;

  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email: placeholderEmail,
    email_confirm: true,
    app_metadata: {
      role: "customer",
      tenant_id: null,
      provider: "phone",
    },
    user_metadata: {
      phone_e164: phoneE164,
    },
  });

  if (createError) {
    if (createError.message?.includes("already been registered")) {
      // Edge case: user exists with this email but not in profiles
      const { data: profileByEmail } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone_e164", phoneE164)
        .limit(1)
        .single();
      if (profileByEmail) return { id: profileByEmail.id, email: placeholderEmail };
    }
    console.error("❌ Failed to create user:", createError);
    return null;
  }

  if (!newUser?.user) return null;

  // Create profile
  const { error: profileError } = await supabase.from("profiles").insert({
    id: newUser.user.id,
    phone_e164: phoneE164,
  });

  if (profileError) {
    console.error("❌ Failed to create profile:", profileError);
  }

  console.log(`👤 New user created: ${newUser.user.id} for ${phoneE164}`);
  return { id: newUser.user.id, email: placeholderEmail };
}

/**
 * Increment attempt count on the latest active OTP.
 */
async function incrementAttemptCount(
  supabase: SupabaseClient,
  phoneE164: string
): Promise<void> {
  const { data: latestOtp } = await supabase
    .from("phone_login_codes")
    .select("id, attempt_count, max_attempts")
    .eq("phone_e164", phoneE164)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!latestOtp) return;

  const newCount = latestOtp.attempt_count + 1;

  if (newCount >= latestOtp.max_attempts) {
    await supabase
      .from("phone_login_codes")
      .update({ attempt_count: newCount, used_at: new Date().toISOString() })
      .eq("id", latestOtp.id);
    console.warn(`🚫 Max attempts reached for OTP ${latestOtp.id}`);
  } else {
    await supabase
      .from("phone_login_codes")
      .update({ attempt_count: newCount })
      .eq("id", latestOtp.id);
  }
}

/**
 * Diagnose why OTP verification failed.
 */
async function diagnoseOtpFailure(
  supabase: SupabaseClient,
  phoneE164: string,
  _codeHash: string
): Promise<"no_active_otp" | "expired" | "max_attempts" | "invalid_code" | "already_used"> {
  const { data: anyOtp } = await supabase
    .from("phone_login_codes")
    .select("id, used_at, expires_at, attempt_count, max_attempts")
    .eq("phone_e164", phoneE164)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!anyOtp) return "no_active_otp";
  if (anyOtp.used_at) return "already_used";
  if (new Date(anyOtp.expires_at) <= new Date()) return "expired";
  if (anyOtp.attempt_count >= anyOtp.max_attempts) return "max_attempts";
  return "invalid_code";
}
