// OTP Module — Core Service
// Handles OTP request, verification, user resolution, and magic link generation.
// NO coupling with agent, queue, or routing modules.

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateOtpCode, hashOtpCode, calculateExpiration } from "./crypto.js";
import { checkOtpRateLimit } from "./rate-limiter.js";
import { getAppBaseUrl, OTP_CONFIG } from "./config.js";
import type {
  OtpRequestParams,
  OtpRequestResult,
  OtpVerifyParams,
  OtpVerifyResult,
} from "./types.js";

/**
 * Request a new OTP code.
 *
 * Flow:
 * 1. Validate rate limits
 * 2. Generate secure OTP code
 * 3. Hash with OTP_HASH_SECRET
 * 4. Store in Supabase (phone_login_codes)
 * 5. Send code via WhatsApp
 * 6. Return request ID
 */
export async function requestOtp(
  supabase: SupabaseClient,
  params: OtpRequestParams
): Promise<OtpRequestResult | { success: false; error: string; retryAfterSeconds?: number }> {
  const { phoneE164, ipAddress, context, userAgent } = params;

  // 1. Rate limit check
  const rateCheck = await checkOtpRateLimit(supabase, phoneE164, ipAddress);
  if (!rateCheck.allowed) {
    console.warn(`🚫 OTP rate limited: ${phoneE164} — ${rateCheck.reason}`);
    return {
      success: false,
      error: rateCheck.reason || "rate_limited",
      retryAfterSeconds: rateCheck.retryAfterSeconds,
    };
  }

  // 2. Generate OTP code
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = calculateExpiration();

  // 3. Store in database
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

  // 4. Return OTP code to the client
  // Client will display the code and generate wa.me link
  // User sends the code to our WhatsApp number themselves
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
 * Verify an OTP code received via WhatsApp webhook.
 *
 * CRITICAL: This is an ATOMIC operation.
 * Uses a single UPDATE with WHERE conditions to prevent race conditions.
 *
 * Flow:
 * 1. Hash the submitted code
 * 2. Atomic UPDATE: match phone + hash + unused + not expired + under max attempts
 * 3. If matched: mark as used, create user if needed, generate magic link
 * 4. Return magic link URL for WhatsApp delivery
 */
export async function verifyOtp(
  supabase: SupabaseClient,
  params: OtpVerifyParams
): Promise<OtpVerifyResult> {
  const { phoneE164, code } = params;
  const codeHash = hashOtpCode(code);

  // Atomic verification: single UPDATE with all conditions
  // This prevents race conditions and replay attacks
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
    // Attempt failed — increment attempt_count on latest active OTP
    await incrementAttemptCount(supabase, phoneE164);

    // Determine the specific error reason
    const reason = await diagnosOtpFailure(supabase, phoneE164, codeHash);
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

  // Generate magic link
  const magicLinkResult = await generateMagicLink(
    supabase,
    user.id,
    user.email,
    verified.context as "signup" | "login",
    phoneE164
  );
  if (!magicLinkResult) {
    return { success: false, error: "internal_error" };
  }

  // Store the token_hash in metadata so poll endpoint can find it
  await supabase
    .from("phone_login_codes")
    .update({
      metadata: {
        token_hash: magicLinkResult.tokenHash,
        magic_link_url: magicLinkResult.url,
        verified_at: new Date().toISOString(),
      },
    })
    .eq("id", verified.id);

  return {
    success: true,
    magicLinkUrl: magicLinkResult.url,
    tokenHash: magicLinkResult.tokenHash,
  };
}

/**
 * Increment the attempt_count on the latest active OTP for a phone number.
 * This is called on failed verification attempts.
 */
async function incrementAttemptCount(
  supabase: SupabaseClient,
  phoneE164: string
): Promise<void> {
  // Find the latest unused OTP for this phone
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

  // If max attempts reached, mark as used (consumed)
  if (newCount >= latestOtp.max_attempts) {
    await supabase
      .from("phone_login_codes")
      .update({
        attempt_count: newCount,
        used_at: new Date().toISOString(),
      })
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
 * Used for logging and error reporting.
 */
async function diagnosOtpFailure(
  supabase: SupabaseClient,
  phoneE164: string,
  _codeHash: string
): Promise<
  "no_active_otp" | "expired" | "max_attempts" | "invalid_code" | "already_used"
> {
  // Check if there's any OTP for this phone
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

/**
 * Find existing user or create a new one.
 *
 * Uses placeholder email pattern: {digits}@phone.musait.app
 * Checks profiles.phone_e164 for existing users.
 */
async function resolveOrCreateUser(
  supabase: SupabaseClient,
  phoneE164: string,
  context: "signup" | "login"
): Promise<{ id: string; email: string } | null> {
  // 1. Check if user exists by phone in profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("phone_e164", phoneE164)
    .limit(1)
    .single();

  if (profile) {
    // If email is missing in profile, fetch from auth.users (fallback)
    // But profiles usually has email. If not, construct placeholder?
    // Let's trust profile email first.
    let email = profile.email;
    if (!email) {
      const { data: authUser } = await supabase.auth.admin.getUserById(
        profile.id
      );
      email = authUser?.user?.email || "";
    }
    return { id: profile.id, email };
  }

  // 2. No existing user — create one (signup flow)
  if (context === "login") {
    // Login context but no user found — still create
    // (defensive: musait.app should have checked context)
    console.warn(
      `⚠️ Login context but no user found for ${phoneE164}, creating new user`
    );
  }

  const digits = phoneE164.replace(/\D/g, "");
  const placeholderEmail = `${digits}@phone.musait.app`;

  const { data: newUser, error: createError } =
    await supabase.auth.admin.createUser({
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
    // User might already exist with this email (edge case)
    if (createError.message?.includes("already been registered")) {
      const { data: existingUser } =
        await supabase.auth.admin.getUserById(placeholderEmail);

      // Fallback: try to find by email in profiles
      const { data: profileByEmail } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone_e164", phoneE164)
        .limit(1)
        .single();

      if (profileByEmail) return profileByEmail.id;
    }

    console.error("❌ Failed to create user:", createError);
    return null;
  }

  if (!newUser?.user) return null;

  // 3. Create profile record
  const { error: profileError } = await supabase.from("profiles").insert({
    id: newUser.user.id,
    phone_e164: phoneE164,
  });

  if (profileError) {
    console.error("❌ Failed to create profile:", profileError);
    // User was created, profile creation is non-critical for auth
  }

  console.log(`👤 New user created: ${newUser.user.id} for ${phoneE164}`);
  return { id: newUser.user.id, email: placeholderEmail };
}

/**
 * Generate a Supabase magic link for a user.
 *
 * Uses admin.generateLink({ type: 'magiclink', email })
 * Extracts token from action_link.
 * Constructs callback URL: https://musait.app/auth/callback?token=...&type=magiclink
 *
 * Session is NEVER created here.
 * Session is created when user taps the link and musait.app /auth/callback processes it.
 */
async function generateMagicLink(
  supabase: SupabaseClient,
  _userId: string,
  email: string,
  context: "signup" | "login",
  phoneE164: string
): Promise<{ url: string; tokenHash: string } | null> {
  // Don't reconstruct placeholder email — use the actual user email passed in

  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: email,
    });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("❌ Failed to generate magic link:", linkError || "No action_link in response");
    if (linkData) console.error("Link Data response:", JSON.stringify(linkData));
    return null;
  }

  // Extract token from action_link
  // action_link format: https://xxx.supabase.co/auth/v1/verify?token=...
  const actionUrl = new URL(linkData.properties.action_link);
  const token = actionUrl.searchParams.get("token");

  if (!token) {
    console.error("❌ No token found in action_link");
    return null;
  }

  // Get token_hash from linkData (Supabase returns it in properties)
  const tokenHash = linkData.properties.hashed_token || token;

  // Construct the callback URL pointing to musait.app
  const baseUrl = getAppBaseUrl();
  // Determine redirect path
  const nextPath = context === "signup" ? "/profil/duzenle" : "/app";
  // Main App expects 'token' query param (which it treats as token_hash)
  const callbackUrl = `${baseUrl}/auth/callback?token=${tokenHash}&type=magiclink&next=${encodeURIComponent(
    nextPath
  )}`;

  console.log(`🔗 Magic link generated for ${phoneE164} (next: ${nextPath})`);
  return { url: callbackUrl, tokenHash };
}
