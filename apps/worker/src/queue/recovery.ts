import type { ConvexHttpClient } from "convex/browser";
import type { AgentQueue } from "@musait/shared";
import { api } from "../lib/convex-api.js";

/**
 * Recovery: On worker startup, re-enqueue any messages that were
 * left in pending or processing state (from a previous crash/restart).
 *
 * This ensures no messages are lost even with in-memory queue.
 * When migrating to Redis, this becomes redundant (BullMQ handles it),
 * but keeping it as a safety net is recommended.
 */
export async function recoverPendingJobs(
  convex: ConvexHttpClient,
  queue: AgentQueue
): Promise<void> {
  console.log("🔍 Checking for pending/processing messages to recover...");

  try {
    const pendingMessages = await convex.query(api.messages.getPendingMessages);

    if (pendingMessages.length === 0) {
      console.log("✅ No messages to recover");
      return;
    }

    console.log(`📋 Found ${pendingMessages.length} message(s) to recover`);

    for (const msg of pendingMessages) {
      // Get conversation for context
      const conversation = await convex.query(api.conversations.getById, {
        id: msg.conversationId,
      });

      if (!conversation) {
        console.warn(
          `⚠️ Conversation ${msg.conversationId} not found for message ${msg._id}, skipping`
        );
        continue;
      }

      await queue.enqueue({
        id: msg._id,
        conversationId: msg.conversationId,
        customerPhone: conversation.customerPhone,
        phoneNumberId:
          conversation.inboundPhoneNumberId ||
          process.env.WHATSAPP_PHONE_NUMBER_ID ||
          "",
        outboundPhoneNumberId:
          conversation.inboundPhoneNumberId ||
          process.env.WHATSAPP_PHONE_NUMBER_ID ||
          "",
        messageContent: msg.content,
        tenantId: conversation.tenantId,
        createdAt: msg.createdAt,
        retryCount: msg.retryCount,
      });
    }

    console.log(`✅ Recovered ${pendingMessages.length} job(s)`);
  } catch (err) {
    console.error("❌ Recovery failed:", err);
    // Don't crash worker — just log and continue
  }
}
