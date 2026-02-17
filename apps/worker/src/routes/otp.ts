// OTP HTTP Routes
// POST /otp/request — Request a new OTP code
// All endpoints require x-api-key header

import { Router, type Request, type Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requestOtp,
  validatePhone,
  normalizePhoneToE164,
  getInternalApiKey,
} from "../services/otp/index.js";

export function createOtpRouter(supabase: SupabaseClient): Router {
  const router = Router();

  // API key auth middleware
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
   * Body: { phone: string, context: "signup" | "login", redirectTo?: string }
   *
   * Success: { success: true, requestId, phoneE164, otpCode, channel, cooldownSeconds }
   * Rate limited: { success: false, error, retryAfterSeconds }
   */
  router.post("/request", async (req: Request, res: Response) => {
    try {
      const { phone, context, redirectTo } = req.body;

      if (!phone || typeof phone !== "string") {
        res.status(400).json({ error: "phone is required" });
        return;
      }

      if (!context || !["signup", "login"].includes(context)) {
        res.status(400).json({ error: "context must be 'signup' or 'login'" });
        return;
      }

      if (redirectTo !== undefined && typeof redirectTo !== "string") {
        res.status(400).json({ error: "redirectTo must be a string" });
        return;
      }

      const phoneE164 = normalizePhoneToE164(phone);
      if (!validatePhone(phoneE164)) {
        res.status(400).json({ error: "invalid phone number format" });
        return;
      }

      const ipAddress =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.ip ||
        "unknown";

      const result = await requestOtp(supabase, {
        phoneE164,
        ipAddress,
        context: context as "signup" | "login",
        redirectTo,
        userAgent: req.headers["user-agent"],
      });

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode =
          "retryAfterSeconds" in result && result.retryAfterSeconds ? 429 : 500;
        res.status(statusCode).json(result);
      }
    } catch (err) {
      console.error("❌ OTP request error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  return router;
}
