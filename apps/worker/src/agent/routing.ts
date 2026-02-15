import type { ConvexHttpClient } from "convex/browser";
import type { AgentJob } from "@musait/shared";
import { api } from "../lib/convex-api.js";
import { sendWhatsAppMessage } from "../lib/whatsapp.js";

interface Conversation {
  _id: any;
  tenantId: string | null;
  customerPhone: string;
  status: string;
  [key: string]: any;
}

interface RoutingResult {
  /** If true, the routing layer already handled the message (sent response) */
  handled: boolean;
  /** Updated tenant ID (may have changed via binding) */
  tenantId: string | null;
}

/**
 * WhatsApp Routing Logic (Hybrid Model)
 *
 * Handles:
 * 1. Direct tenant numbers → pass through to agent
 * 2. Master number, unbound → send tenant selection prompt
 * 3. Master number, unbound + valid code → bind to tenant
 * 4. Master number, unbound + invalid text → ask for code
 * 5. Master number, already bound → pass through to agent
 */
export async function routeMessage(
  convex: ConvexHttpClient,
  job: AgentJob,
  conversation: Conversation
): Promise<RoutingResult> {
  // If conversation already has a tenant, pass through
  if (conversation.tenantId !== null) {
    return { handled: false, tenantId: conversation.tenantId };
  }

  // Conversation is unbound — this is the master number flow
  console.log(
    `🔀 Routing unbound conversation ${conversation._id} for ${job.customerPhone}`
  );

  const messageText = job.messageContent.trim();

  // Check if message is a tenant code
  const tenantCode = await convex.query(api.tenantCodes.getByCode, {
    code: messageText,
  });

  if (tenantCode && tenantCode.isActive) {
    // Valid code → bind conversation to tenant
    await convex.mutation(api.conversations.bindToTenant, {
      id: conversation._id,
      tenantId: tenantCode.tenantId,
    });

    // Send confirmation
    const welcomeMsg = `✅ ${tenantCode.tenantName} işletmesine bağlandınız. Size nasıl yardımcı olabilirim?`;
    await sendWhatsAppMessage(job.customerPhone, welcomeMsg);

    // Save agent message
    await convex.mutation(api.messages.create, {
      conversationId: conversation._id,
      role: "agent",
      content: welcomeMsg,
      status: "done",
    });

    console.log(
      `🔗 Conversation ${conversation._id} bound to tenant ${tenantCode.tenantId}`
    );

    return { handled: true, tenantId: tenantCode.tenantId };
  }

  // Invalid code or first message → send selection prompt
  const selectionMessage = await convex.query(
    api.tenantCodes.buildSelectionMessage
  );

  await sendWhatsAppMessage(job.customerPhone, selectionMessage);

  // Save agent message
  await convex.mutation(api.messages.create, {
    conversationId: conversation._id,
    role: "agent",
    content: selectionMessage,
    status: "done",
  });

  return { handled: true, tenantId: null };
}
