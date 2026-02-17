// OTP HTTP Routes
// Exposes internal API endpoints for musait.app to request OTPs and poll verification status.
// These endpoints are NOT public — they require INTERNAL_API_KEY authentication.

import { Router, type Request, type Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requestOtp,
  validatePhone,
  normalizePhoneToE164,
  getInternalApiKey,
} from "../services/otp/index.js";

/**
 * Create the OTP router.
 *
 * Endpoints:
 * - POST /otp/request — Request a new OTP code (returns code to client)
 * - GET  /otp/poll-session — Poll for verification result (token_hash)
 *
 * Authentication:
 * - All endpoints require x-api-key header matching INTERNAL_API_KEY
 *
 * @param supabase - Supabase admin client
 */
export function createOtpRouter(supabase: SupabaseClient): Router {
  const router = Router();

  // --- Middleware: Internal API key authentication ---
  router.use((req: Request, res: Response, next) => {
    const apiKey = req.headers["x-api-key"];
    const expectedKey = getInternalApiKey();

    if (!apiKey || apiKey !== expectedKey) {
      console.warn(`🚫 Unauthorized OTP request from ${req.ip}`);
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    next();
  });

  /**
   * POST /otp/request
   *
   * Request body:
   * {
   *   phone: string,     // Phone number (any format — will be normalized)
   *   context: "signup" | "login"
   * }
   *
   * Response (success):
   * {
   *   success: true,
   *   requestId: string,
   *   phoneE164: string,
   *   otpCode: string,        // Raw code — client displays this
   *   channel: "whatsapp",
   *   cooldownSeconds: number
   * }
   *
   * Response (rate limited):
   * {
   *   success: false,
   *   error: "cooldown" | "phone_rate_limit" | "ip_rate_limit",
   *   retryAfterSeconds: number
   * }
   */
  router.post("/request", async (req: Request, res: Response) => {
    try {
      const { phone, context } = req.body;

      // Validate input
      if (!phone || typeof phone !== "string") {
        res.status(400).json({ error: "phone is required" });
        return;
      }

      if (!context || !["signup", "login"].includes(context)) {
        res.status(400).json({ error: "context must be 'signup' or 'login'" });
        return;
      }

      // Normalize phone
      const phoneE164 = normalizePhoneToE164(phone);
      if (!validatePhone(phoneE164)) {
        res.status(400).json({ error: "invalid phone number format" });
        return;
      }

      // Get client IP
      const ipAddress =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.ip ||
        "unknown";

      // Request OTP (returns raw code)
      const result = await requestOtp(supabase, {
        phoneE164,
        ipAddress,
        context: context as "signup" | "login",
        userAgent: req.headers["user-agent"],
      });

      if (result.success) {
        res.status(200).json(result);
      } else {
        // Rate limited or error
        const statusCode =
          "retryAfterSeconds" in result && result.retryAfterSeconds
            ? 429
            : 500;
        res.status(statusCode).json(result);
      }
    } catch (err) {
      console.error("❌ OTP request error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /**
   * GET /otp/poll-session
   *
   * Query params:
   *   phone: string       // E.164 format
   *   requestId: string   // UUID from /otp/request response
   *
   * Response (pending — not yet verified):
   * { success: false, error: "pending" }
   *
   * Response (verified — token ready):
   * { success: true, token: "..." }
   *
   * Response (expired/used):
   * { success: false, error: "expired" | "not_found" }
   */
  router.get("/poll-session", async (req: Request, res: Response) => {
    try {
      const phone = req.query.phone as string;
      const requestId = req.query.requestId as string;

      if (!phone || !requestId) {
        res.status(400).json({ error: "phone and requestId are required" });
        return;
      }

      const phoneE164 = normalizePhoneToE164(phone);

      // Look up the OTP record
      const { data: record, error } = await supabase
        .from("phone_login_codes")
        .select("id, used_at, expires_at, metadata")
        .eq("id", requestId)
        .eq("phone_e164", phoneE164)
        .single();

      if (error || !record) {
        res.status(404).json({ success: false, error: "not_found" });
        return;
      }

      // Check if expired
      if (new Date(record.expires_at) <= new Date()) {
        res.status(200).json({ success: false, error: "expired" });
        return;
      }

      // Check if verified (used_at is set, and metadata has token_hash)
      if (record.used_at && record.metadata?.token_hash) {
        res.status(200).json({
          success: true,
          token: record.metadata.token_hash,
        });
        return;
      }

      // Not yet verified — still pending
      res.status(200).json({ success: false, error: "pending" });
    } catch (err) {
      console.error("❌ OTP poll error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  return router;
}
