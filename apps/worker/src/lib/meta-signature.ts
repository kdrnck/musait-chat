// Meta Webhook Signature Verification
// Validates X-Hub-Signature-256 header from Meta WhatsApp Cloud API.
// CRITICAL: Must be enabled in production to prevent spoofed webhooks.

import { createHmac } from "node:crypto";

/**
 * Verify Meta webhook signature (X-Hub-Signature-256).
 *
 * Meta signs webhook payloads with HMAC-SHA256 using the App Secret.
 * Format: "sha256=<hex-encoded-hmac>"
 *
 * @param rawBody - The raw request body as a Buffer or string
 * @param signature - The X-Hub-Signature-256 header value
 * @param appSecret - The META_APP_SECRET environment variable
 * @returns true if signature is valid
 */
export function verifyMetaSignature(
  rawBody: Buffer | string,
  signature: string | undefined,
  appSecret: string
): boolean {
  if (!signature) {
    console.warn("⚠️ Missing X-Hub-Signature-256 header");
    return false;
  }

  if (!appSecret) {
    console.error("❌ META_APP_SECRET not configured");
    return false;
  }

  const expectedSignature =
    "sha256=" +
    createHmac("sha256", appSecret)
      .update(typeof rawBody === "string" ? rawBody : rawBody)
      .digest("hex");

  // Constant-time comparison
  if (expectedSignature.length !== signature.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    mismatch |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }

  const isValid = mismatch === 0;

  if (!isValid) {
    console.warn("❌ Meta webhook signature verification FAILED");
  }

  return isValid;
}

/**
 * Get META_APP_SECRET from environment.
 * Required for production webhook signature verification.
 */
export function getMetaAppSecret(): string {
  return process.env.META_APP_SECRET || "";
}

/**
 * Check if signature verification should be enforced.
 * In development, we can optionally skip it.
 */
export function isSignatureVerificationRequired(): boolean {
  return process.env.NODE_ENV === "production";
}
