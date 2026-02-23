import type { ConvexHttpClient } from "convex/browser";
import type { AgentJob } from "@musait/shared";
import { api } from "../lib/convex-api.js";
import { sendWhatsAppMessage } from "../lib/whatsapp.js";
import { LLM_CONFIG } from "../config.js";
import { LLM_PROMPTS, ROUTING_PROMPTS } from "./master-prompts.js";
import { initializeBookingFlow } from "./booking-flow.js";

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

interface ActiveTenant {
  tenantId: string;
  tenantName: string;
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

  // First touch for unbound conversation: send welcome flow message
  const previousMessages = await convex.query(api.messages.listByConversation, {
    conversationId: conversation._id,
    limit: 10,
  });

  const hasWelcomeMessage = previousMessages.some(
    (msg: any) =>
      msg.role === "agent" && msg.content === ROUTING_PROMPTS.welcomeMessage
  );

  if (!hasWelcomeMessage) {
    await sendWhatsAppMessage(job.customerPhone, ROUTING_PROMPTS.welcomeMessage, {
      phoneNumberId: job.outboundPhoneNumberId || job.phoneNumberId,
      accessToken: job.outboundAccessToken,
    });

    await convex.mutation(api.messages.create, {
      conversationId: conversation._id,
      role: "agent",
      content: ROUTING_PROMPTS.welcomeMessage,
      status: "done",
    });

    return { handled: true, tenantId: null };
  }

  const activeTenants = await convex.query(api.tenantCodes.listActive);
  if (!activeTenants || activeTenants.length === 0) {
    const noTenantMessage = ROUTING_PROMPTS.noActiveTenantMessage;
    await sendWhatsAppMessage(job.customerPhone, noTenantMessage, {
      phoneNumberId: job.outboundPhoneNumberId || job.phoneNumberId,
      accessToken: job.outboundAccessToken,
    });

    await convex.mutation(api.messages.create, {
      conversationId: conversation._id,
      role: "agent",
      content: noTenantMessage,
      status: "done",
    });
    return { handled: true, tenantId: null };
  }

  const matchedTenant = await selectTenantWithLlm(
    messageText,
    activeTenants.map((t: any) => ({
      tenantId: t.tenantId,
      tenantName: t.tenantName,
    }))
  );

  if (!matchedTenant) {
    const retryMessage = ROUTING_PROMPTS.tenantRetryMessage;
    await sendWhatsAppMessage(job.customerPhone, retryMessage, {
      phoneNumberId: job.outboundPhoneNumberId || job.phoneNumberId,
      accessToken: job.outboundAccessToken,
    });

    await convex.mutation(api.messages.create, {
      conversationId: conversation._id,
      role: "agent",
      content: retryMessage,
      status: "done",
    });

    return { handled: true, tenantId: null };
  }

  await convex.mutation(api.conversations.bindToTenant, {
    id: conversation._id,
    tenantId: matchedTenant.tenantId,
  });

  const selectionMessage = await initializeBookingFlow(
    convex,
    String(conversation._id),
    matchedTenant.tenantId
  );

  await sendWhatsAppMessage(job.customerPhone, selectionMessage, {
    phoneNumberId: job.outboundPhoneNumberId || job.phoneNumberId,
    accessToken: job.outboundAccessToken,
  });

  // Save agent message
  await convex.mutation(api.messages.create, {
    conversationId: conversation._id,
    role: "agent",
    content: selectionMessage,
    status: "done",
  });

  console.log(
    `🔗 Conversation ${conversation._id} bound to tenant ${matchedTenant.tenantId}`
  );

  return { handled: true, tenantId: matchedTenant.tenantId };
}

async function selectTenantWithLlm(
  userMessage: string,
  tenants: ActiveTenant[]
): Promise<ActiveTenant | null> {
  if (!LLM_CONFIG.apiKey) {
    return null;
  }

  const tenantList = tenants
    .map((t) => `- ${t.tenantName} (tenantId: ${t.tenantId})`)
    .join("\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LLM_CONFIG.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://musait.app",
      "X-Title": "Musait Tenant Selector",
    },
    body: JSON.stringify({
      model: LLM_CONFIG.model,
      temperature: 0,
      max_tokens: 100,
      messages: [
        {
          role: "system",
          content: LLM_PROMPTS.tenantSelectorSystem,
        },
        {
          role: "user",
          content: LLM_PROMPTS.tenantSelectorUser(tenantList, userMessage),
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  const parsed = safeParseJson(content);
  const tenantId = typeof parsed?.tenantId === "string" ? parsed.tenantId : null;
  if (!tenantId) return null;

  return tenants.find((t) => t.tenantId === tenantId) || null;
}

function safeParseJson(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
