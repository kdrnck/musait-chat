// OTP Module — Cryptographic Utilities
// Handles OTP code generation and hashing.

import { createHash, getRandomValues } from "node:crypto";
import { getOtpHashSecret, OTP_CONFIG } from "./config.js";

/**
 * Generate a cryptographically secure random OTP code.
 * Uses crypto.getRandomValues for CSPRNG.
 *
 * @returns A string of digits with length OTP_CONFIG.CODE_LENGTH
 */
export function generateOtpCode(): string {
  const length = OTP_CONFIG.CODE_LENGTH;
  const values = new Uint32Array(length);
  getRandomValues(values);

  let code = "";
  for (let i = 0; i < length; i++) {
    code += (values[i] % 10).toString();
  }

  return code;
}

/**
 * Hash an OTP code using SHA-256 with the OTP_HASH_SECRET.
 * Formula: sha256(code + OTP_HASH_SECRET)
 *
 * This ensures that even if the DB is compromised,
 * the raw OTP codes cannot be recovered without the secret.
 *
 * @param code - The raw OTP code
 * @returns Hex-encoded SHA-256 hash
 */
export function hashOtpCode(code: string): string {
  const secret = getOtpHashSecret();
  return createHash("sha256")
    .update(code + secret)
    .digest("hex");
}

/**
 * Verify an OTP code against a stored hash.
 *
 * @param code - The raw OTP code to verify
 * @param storedHash - The hash stored in the database
 * @returns true if the code matches the hash
 */
export function verifyOtpCode(code: string, storedHash: string): boolean {
  const computedHash = hashOtpCode(code);
  // Constant-time comparison to prevent timing attacks
  if (computedHash.length !== storedHash.length) return false;

  let mismatch = 0;
  for (let i = 0; i < computedHash.length; i++) {
    mismatch |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Calculate OTP expiration timestamp.
 *
 * @returns ISO 8601 timestamp string
 */
export function calculateExpiration(): string {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + OTP_CONFIG.EXPIRATION_MINUTES);
  return expiry.toISOString();
}

/**
 * Normalize a phone number to E.164 format.
 * Strips spaces, dashes, parentheses. Ensures + prefix.
 *
 * @param phone - Raw phone input
 * @returns E.164 formatted phone number
 */
export function normalizePhoneToE164(phone: string): string {
  // Strip everything except digits and leading +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // Ensure + prefix
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }

  return cleaned;
}

/**
 * Validate a phone number (basic E.164 validation).
 *
 * @param phone - Phone number to validate
 * @returns true if valid
 */
export function validatePhone(phone: string): boolean {
  // E.164: + followed by 7-15 digits
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

/**
 * Extract a 6-digit OTP code from a WhatsApp message text.
 * Handles messages that are just the code, or contain it with text.
 *
 * @param text - The message text
 * @returns The extracted code or null
 */
export function extractOtpCode(text: string): string | null {
  const trimmed = text.trim();

  // Exact 6-digit match (most common case)
  if (/^\d{6}$/.test(trimmed)) {
    return trimmed;
  }

  // Try to find a 6-digit sequence in the text
  const match = trimmed.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}
