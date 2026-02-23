import { Router, type Request, type Response } from "express";
import type { ConvexHttpClient } from "convex/browser";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentQueue, WhatsAppWebhookPayload } from "@musait/shared";
import { WHATSAPP_CONFIG } from "../config.js";
import { api } from "../lib/convex-api.js";
import {
  verifyMetaSignature,
  getMetaAppSecret,
  isSignatureVerificationRequired,
} from "../lib/meta-signature.js";
import { routeIncomingMessage } from "../services/router/message-router.js";
import { verifyOtp, normalizePhoneToE164 } from "../services/otp/index.js";
import { sendWhatsAppMessage } from "../lib/whatsapp.js";
import { OTP_PROMPTS } from "../agent/master-prompts.js";

/**
 * WhatsApp Webhook Router
 *
 * CRITICAL RULES:
 * 1. NEVER call LLM directly from webhook
 * 2. Always validate Meta signature in production
 * 3. Route message: OTP → synchronous | Agent → enqueue
 * 4. Return 200 immediately
 *
 * ROUTING LOGIC:
 * Incoming message →
 *   Router checks phone_login_codes for active OTP →
 *     If OTP pending: handle synchronously (verify, magic link, WhatsApp reply)
 *     Else: persist message + enqueue for agent processing
 */
export function createWebhookRouter(
  convex: ConvexHttpClient,
  queue: AgentQueue,
  supabase: SupabaseClient
): Router {
  const router = Router();

  // --- GET: WhatsApp webhook verification ---
  router.get("/whatsapp", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === WHATSAPP_CONFIG.verifyToken) {
      console.log("✅ WhatsApp webhook verified");
      res.status(200).send(challenge);
      return;
    }

    console.warn("❌ WhatsApp webhook verification failed");
    res.sendStatus(403);
  });

  // --- POST: Incoming WhatsApp messages ---
  router.post("/whatsapp", async (req: Request, res: Response) => {
    // 1. Verify Meta signature (REQUIRED in production)
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    const appSecret = getMetaAppSecret();
    // Use raw body captured by express.json({ verify }) — NOT re-serialized JSON
    const rawBody = (req as any).rawBody as Buffer;

    if (isSignatureVerificationRequired()) {
      if (!verifyMetaSignature(rawBody, signature, appSecret)) {
        console.error("🚫 Invalid Meta webhook signature — rejecting");
        res.sendStatus(403);
        return;
      }
    } else if (appSecret) {
      // Development: verify if secret is configured, but don't block
      const isValid = verifyMetaSignature(rawBody, signature, appSecret);
      if (!isValid) {
        console.warn(
          "⚠️ Meta signature verification failed (dev mode — continuing)"
        );
      }
    }

    // 2. Always return 200 immediately to acknowledge receipt
    res.sendStatus(200);

    try {
      const payload = req.body as WhatsAppWebhookPayload;

      if (payload.object !== "whatsapp_business_account") return;

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field !== "messages") continue;

          const { metadata, messages, contacts } = change.value;

          if (!messages || messages.length === 0) continue;

          for (const message of messages) {
            // Only handle text messages for MVP
            if (message.type !== "text" || !message.text?.body) continue;

            const phoneNumberId = metadata.phone_number_id;
            // Normalize to E.164 (add + prefix if missing)
            const customerPhone = normalizePhoneToE164(message.from);
            const messageContent = message.text.body;
            const contactName =
              contacts?.[0]?.profile?.name || "Bilinmeyen";

            console.log(
              `📨 Incoming: ${customerPhone} → ${phoneNumberId}: "${messageContent}"`
            );

            // 3. ROUTE: OTP or Agent?
            const routeDecision = await routeIncomingMessage(
              supabase,
              customerPhone,
              messageContent
            );

            if (routeDecision.route === "otp") {
              // --- OTP PATH: Synchronous, no queue ---
              await handleOtpMessage({
                supabase,
                phoneNumberId,
                customerPhone,
                messageContent,
                otpCode: routeDecision.otpCode,
              });
            } else {
              // --- AGENT PATH: Persist + Enqueue (unchanged) ---
              await handleAgentMessage({
                convex,
                queue,
                supabase,
                phoneNumberId,
                customerPhone,
                messageContent,
                contactName,
              });
            }
          }
        }
      }
    } catch (err) {
      // Don't throw — we already sent 200
      console.error("❌ Webhook processing error:", err);
    }
  });

  return router;
}

// ─── OTP Message Handler ───────────────────────────────────────────────────────

/**
 * Handle an incoming message routed to the OTP handler.
 *
 * This is SYNCHRONOUS — no queue involved.
 * OTP verification and magic link generation happen inline.
 */
async function handleOtpMessage(params: {
  supabase: SupabaseClient;
  phoneNumberId: string;
  customerPhone: string;
  messageContent: string;
  otpCode?: string;
}): Promise<void> {
  const { supabase, phoneNumberId, customerPhone, otpCode } = params;

  if (!otpCode) {
    // User has active OTP but sent a non-code message
    // Send a helpful reminder
    await sendWhatsAppMessage(
      customerPhone,
      OTP_PROMPTS.codeReminder,
      { phoneNumberId }
    );
    return;
  }

  // Verify the OTP code
  const result = await verifyOtp(supabase, {
    phoneE164: customerPhone,
    code: otpCode,
  });

  if (result.success && result.magicLinkUrl) {
    // Send magic link via WhatsApp
    const successMessage =
      `✅ Doğrulama başarılı!\n\n` +
      `Giriş yapmak için aşağıdaki bağlantıya tıklayın:\n` +
      `${result.magicLinkUrl}\n\n` +
      `Bu bağlantı tek kullanımlıktır.`;

    try {
      await sendWhatsAppMessage(customerPhone, successMessage, { phoneNumberId });
      console.log(`🔗 Magic link sent to ${customerPhone}`);
    } catch (err) {
      console.error(
        `❌ Failed to send WhatsApp success message to ${customerPhone}:`,
        err
      );
    }
  } else {
    // Send error message based on failure reason
    const errorMessages: Record<string, string> = {
      no_active_otp:
        "❌ Aktif bir doğrulama kodunuz bulunmuyor. Lütfen yeni kod talep edin.",
      expired:
        "⏰ Doğrulama kodunuzun süresi dolmuş. Lütfen yeni kod talep edin.",
      max_attempts: "🚫 Çok fazla deneme yapıldı. Lütfen yeni kod talep edin.",
      invalid_code: "❌ Geçersiz kod. Lütfen doğru kodu girin.",
      already_used: "❌ Bu kod zaten kullanılmış. Lütfen tekrar giriş yapın.",
      internal_error: "⚠️ Bir hata oluştu. Lütfen tekrar deneyin.",
    };

    const errorMsg =
      errorMessages[result.error || "internal_error"] ||
      errorMessages.internal_error;

    try {
      await sendWhatsAppMessage(customerPhone, errorMsg, { phoneNumberId });
    } catch (err) {
      console.error(
        `❌ Failed to send WhatsApp error message to ${customerPhone}:`,
        err
      );
    }
    console.warn(
      `❌ OTP verification failed for ${customerPhone}: ${result.error}`
    );
  }
}

// ─── Agent Message Handler ─────────────────────────────────────────────────────

/**
 * Handle an incoming message routed to the Agent handler.
 *
 * This is the ORIGINAL flow — persist message, enqueue job.
 * NO changes from original implementation.
 */
async function handleAgentMessage(params: {
  convex: ConvexHttpClient;
  queue: AgentQueue;
  supabase: SupabaseClient;
  phoneNumberId: string;
  customerPhone: string;
  messageContent: string;
  contactName: string;
}): Promise<void> {
  const { convex, queue, supabase, phoneNumberId, customerPhone, messageContent } =
    params;

  // 1. Look up phone_number_id → tenant mapping
  const numberMapping = await convex.query(
    api.whatsappNumbers.getByPhoneNumberId,
    { phoneNumberId }
  );

  if (!numberMapping) {
    console.warn(`⚠️ Unknown phone_number_id: ${phoneNumberId}, ignoring`);
    return;
  }

  // 2. Find or create conversation
  let conversation = await getActiveConversationWithBackwardCompatibility(
    convex,
    customerPhone,
    phoneNumberId
  );

  if (!conversation) {
    // Determine initial tenant_id based on routing
    const tenantId = numberMapping.isMasterNumber
      ? null // Unbound — master number flow
      : numberMapping.tenantId;

    const conversationId = await createConversationWithBackwardCompatibility(
      convex,
      tenantId,
      customerPhone,
      phoneNumberId
    );

    conversation = await convex.query(api.conversations.getById, {
      id: conversationId,
    });

    if (!conversation) {
      console.error("❌ Failed to create conversation");
      return;
    }
  }

  // 3. Persist incoming message (status=pending)
  const messageId = await convex.mutation(api.messages.create, {
    conversationId: conversation._id,
    role: "customer",
    content: messageContent,
    status: "pending",
  });

  let outboundPhoneNumberId = phoneNumberId;
  let outboundAccessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";

  if (!numberMapping.isMasterNumber && numberMapping.tenantId) {
    // For direct tenant numbers, prefer tenant-specific WhatsApp credentials from Supabase.
    const { data: tenantCfg, error } = await supabase
      .from("tenants")
      .select("waba_phone_number_id, waba_access_token")
      .eq("id", numberMapping.tenantId)
      .single();

    if (!error && tenantCfg) {
      outboundPhoneNumberId =
        tenantCfg.waba_phone_number_id || outboundPhoneNumberId;
      outboundAccessToken = tenantCfg.waba_access_token || outboundAccessToken;
    }
  }

  // 4. Enqueue job — NEVER call LLM here
  await queue.enqueue({
    id: messageId,
    conversationId: conversation._id,
    customerPhone,
    phoneNumberId,
    outboundPhoneNumberId,
    outboundAccessToken,
    messageContent,
    tenantId: conversation.tenantId,
    createdAt: Date.now(),
    retryCount: 0,
  });

  console.log(
    `✅ Message ${messageId} queued for conversation ${conversation._id}`
  );
}

async function getActiveConversationWithBackwardCompatibility(
  convex: ConvexHttpClient,
  customerPhone: string,
  phoneNumberId: string
) {
  try {
    return await convex.query(api.conversations.getActiveByPhone, {
      customerPhone,
      inboundPhoneNumberId: phoneNumberId,
    } as any);
  } catch (error) {
    // Backward compatibility: older Convex function expects only customerPhone.
    if (isArgumentValidationError(error)) {
      return await convex.query(api.conversations.getActiveByPhone, {
        customerPhone,
      } as any);
    }
    throw error;
  }
}

async function createConversationWithBackwardCompatibility(
  convex: ConvexHttpClient,
  tenantId: string | null,
  customerPhone: string,
  phoneNumberId: string
) {
  try {
    return await convex.mutation(api.conversations.create, {
      tenantId,
      customerPhone,
      inboundPhoneNumberId: phoneNumberId,
    } as any);
  } catch (error) {
    // Backward compatibility: older Convex mutation does not accept inboundPhoneNumberId.
    if (isArgumentValidationError(error)) {
      return await convex.mutation(api.conversations.create, {
        tenantId,
        customerPhone,
      } as any);
    }
    throw error;
  }
}

function isArgumentValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("ArgumentValidationError") ||
    error.message.includes("extra field")
  );
}
