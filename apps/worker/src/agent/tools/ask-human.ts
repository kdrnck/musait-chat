import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api.js";
import { randomBytes } from "crypto";

interface ToolContext {
  tenantId: string;
  conversationId: string;
  customerPhone: string;
}

/**
 * ask_human - Triggers human override mode.
 *
 * When called:
 * 1. Sets conversation status to "handoff"
 * 2. Disables agent for 24 hours
 * 3. Creates magic link for quick staff access
 * 4. Sends Telegram notification (when configured)
 */
export async function askHuman(
  convex: ConvexHttpClient,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const reason = (args.reason as string) || "Agent yanıt veremedi";

  // 1. Set conversation to handoff mode + disable agent for 24h
  const twentyFourHours = 24 * 60 * 60 * 1000;
  await convex.mutation(api.conversations.disableAgent, {
    id: ctx.conversationId as any,
    disabledUntilMs: Date.now() + twentyFourHours,
  });

  // 2. Create magic link
  const token = randomBytes(32).toString("hex");
  await convex.mutation(api.magicLinks.create, {
    conversationId: ctx.conversationId as any,
    token,
    createdBy: "system",
    expiresInMs: 60 * 60 * 1000, // 1 hour
  });

  const magicLinkUrl = `https://chat.musait.app/handoff/${token}`;

  // 3. Send Telegram notification (if configured)
  await sendTelegramNotification({
    reason,
    customerPhone: ctx.customerPhone,
    conversationId: ctx.conversationId,
    magicLink: magicLinkUrl,
  });

  console.log(
    `🙋 Human override activated for conversation ${ctx.conversationId}`
  );
  console.log(`🔗 Magic link: ${magicLinkUrl}`);

  return {
    success: true,
    message:
      "Konuşma bir insan operatöre devredildi. Kısa süre içinde size yardımcı olunacaktır.",
  };
}

// --- Telegram notification ---

async function sendTelegramNotification(params: {
  reason: string;
  customerPhone: string;
  conversationId: string;
  magicLink: string;
}): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log("⚠️ Telegram not configured, skipping notification");
    return;
  }

  const message = `🔔 *İnsan Desteği Gerekli*

📱 Müşteri: ${params.customerPhone}
💬 Konuşma: \`${params.conversationId}\`
📝 Sebep: ${params.reason}

🔗 [Konuşmayı Aç](${params.magicLink})`;

  try {
    await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );
  } catch (err) {
    console.error("❌ Telegram notification failed:", err);
    // Don't throw — notification failure shouldn't break the flow
  }
}
