import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateExpiration, generateOtpCode, hashOtpCode } from "./crypto.js";
import { getAppBaseUrl, OTP_CONFIG } from "./config.js";
import { checkOtpRateLimit } from "./rate-limiter.js";
import type {
  OtpRequestParams,
  OtpRequestResult,
  OtpVerifyError,
  OtpVerifyParams,
  OtpVerifyResult,
} from "./types.js";

const MAGIC_LINK_TTL_MINUTES = 60;
const SHORT_CODE_LENGTH = 8;
const SHORT_CODE_MAX_RETRIES = 8;

type OtpContext = "signup" | "login";

type OtpVerificationRow = {
  id: string;
  context: OtpContext | string;
  metadata: unknown;
};

type OtpMagicLinkRow = {
  short_code: string;
  supabase_verify_url: string;
  expires_at: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
};

function toMetadataRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeContext(value: unknown): OtpContext {
  return value === "signup" ? "signup" : "login";
}

function normalizeRedirectPath(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  if (/[\r\n]/.test(trimmed)) return null;

  return trimmed;
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 80);
}

function generateShortCode(length = SHORT_CODE_LENGTH): string {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

function buildPlaceholderEmail(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `${digits}@phone.musait.app`;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  if (err.code === "23505") return true;
  if (typeof err.message === "string" && err.message.toLowerCase().includes("duplicate")) {
    return true;
  }
  return false;
}

export async function requestOtp(
  supabase: SupabaseClient,
  params: OtpRequestParams
): Promise<OtpRequestResult | { success: false; error: string; retryAfterSeconds?: number }> {
  const { phoneE164, ipAddress, context, redirectTo, firstName, lastName, userAgent } = params;

  if (context === "login") {
    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone_e164", phoneE164)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (profileLookupError) {
      console.error("Failed to lookup profile for login context:", profileLookupError);
      return { success: false, error: "internal_error" };
    }

    if (!existingProfile) {
      return { success: false, error: "phone_not_found" };
    }
  }

  const rateCheck = await checkOtpRateLimit(supabase, phoneE164, ipAddress);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: rateCheck.reason || "rate_limited",
      retryAfterSeconds: rateCheck.retryAfterSeconds,
    };
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = calculateExpiration();

  const metadata: Record<string, unknown> = {};
  const safeRedirect = normalizeRedirectPath(redirectTo);
  const safeFirstName = normalizeName(firstName);
  const safeLastName = normalizeName(lastName);

  if (safeRedirect) metadata.redirect_to = safeRedirect;
  if (safeFirstName) metadata.first_name = safeFirstName;
  if (safeLastName) metadata.last_name = safeLastName;

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
      metadata,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !otpRecord) {
    console.error("Failed to insert OTP record:", insertError);
    return { success: false, error: "internal_error" };
  }

  return {
    success: true,
    requestId: otpRecord.id,
    phoneE164,
    otpCode: code,
    channel: "whatsapp",
    cooldownSeconds: OTP_CONFIG.COOLDOWN_SECONDS,
  };
}

export async function verifyOtp(
  supabase: SupabaseClient,
  params: OtpVerifyParams
): Promise<OtpVerifyResult> {
  const { phoneE164, code } = params;
  const codeHash = hashOtpCode(code);
  const nowIso = new Date().toISOString();

  const { data: verified, error: verifyError } = await supabase
    .from("phone_login_codes")
    .update({ used_at: nowIso })
    .eq("phone_e164", phoneE164)
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .lt("attempt_count", OTP_CONFIG.MAX_ATTEMPTS)
    .select("id, context, metadata")
    .single<OtpVerificationRow>();

  if (verifyError || !verified) {
    await incrementAttemptCount(supabase, phoneE164);
    const reason = await diagnoseOtpFailure(supabase, phoneE164);
    return { success: false, error: reason };
  }

  const context = normalizeContext(verified.context);
  const otpMetadata = toMetadataRecord(verified.metadata);
  const redirectPath = normalizeRedirectPath(otpMetadata.redirect_to);
  const firstName = normalizeName(otpMetadata.first_name);
  const lastName = normalizeName(otpMetadata.last_name);

  const user = await resolveOrCreateUser(supabase, {
    phoneE164,
    context,
    firstName,
    lastName,
  });
  if (!user) return { success: false, error: "internal_error" };

  const magicLink = await createShortMagicLink(supabase, {
    phoneE164,
    context,
    userId: user.id,
    email: user.email,
    redirectPath,
    otpRecordId: verified.id,
  });
  if (!magicLink) return { success: false, error: "internal_error" };

  return {
    success: true,
    magicLinkUrl: magicLink.shortUrl,
  };
}

async function createShortMagicLink(
  supabase: SupabaseClient,
  params: {
    phoneE164: string;
    context: OtpContext;
    userId: string;
    email: string;
    redirectPath: string | null;
    otpRecordId: string;
  }
): Promise<{ shortUrl: string } | null> {
  const baseUrl = getAppBaseUrl();
  const defaultNextPath = params.context === "signup" ? "/profil/duzenle" : "/profil";
  const nextPath = params.redirectPath || defaultNextPath;
  const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: params.email,
    options: { redirectTo },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("Failed to generate magic link:", linkError || "action_link missing");
    return null;
  }

  const actionUrl = new URL(linkData.properties.action_link);
  actionUrl.searchParams.set("redirect_to", redirectTo);
  const supabaseVerifyUrl = actionUrl.toString();

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + MAGIC_LINK_TTL_MINUTES);
  const expiresAtIso = expiresAt.toISOString();

  for (let attempt = 0; attempt < SHORT_CODE_MAX_RETRIES; attempt += 1) {
    const shortCode = generateShortCode();

    const { data, error } = await supabase
      .from("otp_magic_links")
      .insert({
        short_code: shortCode,
        phone_e164: params.phoneE164,
        user_id: params.userId,
        supabase_verify_url: supabaseVerifyUrl,
        redirect_path: nextPath,
        created_from_otp_id: params.otpRecordId,
        expires_at: expiresAtIso,
        metadata: {
          context: params.context,
          created_by: "worker_otp",
        },
      })
      .select("short_code, supabase_verify_url, expires_at")
      .single<OtpMagicLinkRow>();

    if (error) {
      if (isUniqueViolation(error)) continue;
      console.error("Failed to persist otp_magic_links row:", error);
      return null;
    }

    if (!data) {
      console.error("otp_magic_links insert returned empty row");
      return null;
    }

    return {
      shortUrl: `${baseUrl}/auth/magic/${data.short_code}`,
    };
  }

  console.error("Could not generate unique short code for otp_magic_links");
  return null;
}

async function resolveOrCreateUser(
  supabase: SupabaseClient,
  params: {
    phoneE164: string;
    context: OtpContext;
    firstName: string | null;
    lastName: string | null;
  }
): Promise<{ id: string; email: string } | null> {
  const { phoneE164, firstName, lastName } = params;
  const placeholderEmail = buildPlaceholderEmail(phoneE164);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("phone_e164", phoneE164)
    .limit(1)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    console.error("Failed to lookup profile by phone:", profileError);
    return null;
  }

  if (profile) {
    if (profile.email) return { id: profile.id, email: profile.email };

    const { data: authUserData, error: authLookupError } = await supabase.auth.admin.getUserById(
      profile.id
    );
    if (authLookupError) {
      console.error("Failed to lookup auth user by id:", authLookupError);
      return { id: profile.id, email: placeholderEmail };
    }

    const authEmail = authUserData.user?.email || placeholderEmail;
    return { id: profile.id, email: authEmail };
  }

  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email: placeholderEmail,
    email_confirm: true,
    app_metadata: {
      role: "customer",
      tenant_id: null,
      provider: "phone",
    },
    user_metadata: {
      phone_e164: phoneE164,
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (createUserError || !createdUser?.user) {
    console.error("Failed to create auth user:", createUserError);
    return null;
  }

  const { error: createProfileError } = await supabase.from("profiles").insert({
    id: createdUser.user.id,
    email: placeholderEmail,
    phone_e164: phoneE164,
    first_name: firstName,
    last_name: lastName,
  });

  if (createProfileError) {
    console.error("Failed to create profile:", createProfileError);
  }

  return { id: createdUser.user.id, email: placeholderEmail };
}

async function incrementAttemptCount(
  supabase: SupabaseClient,
  phoneE164: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data: latestOtp, error } = await supabase
    .from("phone_login_codes")
    .select("id, attempt_count, max_attempts")
    .eq("phone_e164", phoneE164)
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; attempt_count: number; max_attempts: number }>();

  if (error || !latestOtp) return;

  const nextAttemptCount = latestOtp.attempt_count + 1;
  const exhausted = nextAttemptCount >= latestOtp.max_attempts;

  const payload: Record<string, unknown> = { attempt_count: nextAttemptCount };
  if (exhausted) payload.used_at = nowIso;

  await supabase.from("phone_login_codes").update(payload).eq("id", latestOtp.id);
}

async function diagnoseOtpFailure(
  supabase: SupabaseClient,
  phoneE164: string
): Promise<OtpVerifyError> {
  const { data: latestOtp, error } = await supabase
    .from("phone_login_codes")
    .select("id, used_at, expires_at, attempt_count, max_attempts")
    .eq("phone_e164", phoneE164)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      used_at: string | null;
      expires_at: string;
      attempt_count: number;
      max_attempts: number;
    }>();

  if (error || !latestOtp) return "no_active_otp";
  if (latestOtp.used_at) return "already_used";
  if (new Date(latestOtp.expires_at) <= new Date()) return "expired";
  if (latestOtp.attempt_count >= latestOtp.max_attempts) return "max_attempts";
  return "invalid_code";
}
