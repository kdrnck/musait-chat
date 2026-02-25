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
  inboundPhoneNumberId?: string;
  [key: string]: any;
}

interface RoutingResult {
  handled: boolean;
  tenantId: string | null;
}

interface ActiveTenant {
  tenantId: string;
  tenantName: string;
}

export async function routeMessage(
  convex: ConvexHttpClient,
  job: AgentJob,
  conversation: Conversation
): Promise<RoutingResult> {
  const numberMapping = await convex.query(api.whatsappNumbers.getByPhoneNumberId, {
    phoneNumberId: job.phoneNumberId,
  });
  const isMasterNumber = Boolean(numberMapping?.isMasterNumber);

  // 1) Bound conversation path
  if (conversation.tenantId !== null) {
    if (!isMasterNumber) {
      return { handled: false, tenantId: conversation.tenantId };
    }

    const activeTenants = await getActiveTenants(convex);
    if (activeTenants.length === 0) {
      return { handled: false, tenantId: conversation.tenantId };
    }

    if (!shouldAttemptTenantSwitch(job.messageContent, activeTenants)) {
      return { handled: false, tenantId: conversation.tenantId };
    }

    const matchedTenant = await selectTenantWithLlm(job.messageContent, activeTenants);
    if (!matchedTenant || matchedTenant.tenantId === conversation.tenantId) {
      return { handled: false, tenantId: conversation.tenantId };
    }

    await performTenantSwitch(convex, job, conversation, matchedTenant);
    return { handled: true, tenantId: matchedTenant.tenantId };
  }

  // 2) Unbound conversation path (master number flow)
  if (!isMasterNumber) {
    return { handled: false, tenantId: null };
  }

  const messageText = job.messageContent.trim();
  const previousMessages = await convex.query(api.messages.listByConversation, {
    conversationId: conversation._id,
    limit: 10,
  });

  const hasWelcomeMessage = previousMessages.some(
    (msg: any) =>
      msg.role === "agent" && msg.content === ROUTING_PROMPTS.welcomeMessage
  );

  const activeTenants = await getActiveTenants(convex);
  if (!activeTenants || activeTenants.length === 0) {
    await replyAndPersist(convex, {
      job,
      conversationId: conversation._id,
      content: ROUTING_PROMPTS.noActiveTenantMessage,
    });
    return { handled: true, tenantId: null };
  }

  // First touch: try "last tenant" shortcut before welcome message.
  if (!hasWelcomeMessage) {
    const rememberedTenant = await getRememberedTenant(
      convex,
      job.customerPhone,
      activeTenants
    );

    if (rememberedTenant) {
      await convex.mutation(api.conversations.bindToTenant, {
        id: conversation._id,
        tenantId: rememberedTenant.tenantId,
      });

      const flowMessage = await initializeBookingFlow(
        convex,
        String(conversation._id),
        rememberedTenant.tenantId
      );

      const warmStartMessage =
        `Tekrar hoş geldiniz. Son tercihinize göre *${rememberedTenant.tenantName}* ile devam ediyorum.\n` +
        "İşletme değiştirmek isterseniz \"işletme değiştir\" yazabilirsiniz.\n\n" +
        flowMessage;

      await replyAndPersist(convex, {
        job,
        conversationId: conversation._id,
        content: warmStartMessage,
      });

      await convex.mutation(api.customerMemories.upsertPreferredTenant, {
        customerPhone: job.customerPhone,
        preferredTenantId: rememberedTenant.tenantId,
      });

      return { handled: true, tenantId: rememberedTenant.tenantId };
    }

    await replyAndPersist(convex, {
      job,
      conversationId: conversation._id,
      content: ROUTING_PROMPTS.welcomeMessage,
    });
    return { handled: true, tenantId: null };
  }

  const matchedTenant = await selectTenantWithLlm(messageText, activeTenants);
  if (!matchedTenant) {
    await replyAndPersist(convex, {
      job,
      conversationId: conversation._id,
      content: ROUTING_PROMPTS.tenantRetryMessage,
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

  await replyAndPersist(convex, {
    job,
    conversationId: conversation._id,
    content: selectionMessage,
  });

  await convex.mutation(api.customerMemories.upsertPreferredTenant, {
    customerPhone: job.customerPhone,
    preferredTenantId: matchedTenant.tenantId,
  });

  return { handled: true, tenantId: matchedTenant.tenantId };
}

async function performTenantSwitch(
  convex: ConvexHttpClient,
  job: AgentJob,
  conversation: Conversation,
  matchedTenant: ActiveTenant
): Promise<void> {
  await convex.mutation(api.conversations.archiveAndReset, {
    id: conversation._id,
  });

  const newConversationId = await convex.mutation(api.conversations.create, {
    tenantId: matchedTenant.tenantId,
    customerPhone: conversation.customerPhone,
    inboundPhoneNumberId:
      conversation.inboundPhoneNumberId || job.phoneNumberId,
  } as any);

  // Copy the switch-triggering customer message into the new tenant thread
  await convex.mutation(api.messages.create, {
    conversationId: newConversationId as any,
    role: "customer",
    content: job.messageContent,
    status: "done",
  });

  const flowMessage = await initializeBookingFlow(
    convex,
    String(newConversationId),
    matchedTenant.tenantId
  );
  const switchMessage =
    `Tamamdır, konuşmayı *${matchedTenant.tenantName}* işletmesine taşıdım.\n\n` +
    flowMessage;

  await replyAndPersist(convex, {
    job,
    conversationId: newConversationId,
    content: switchMessage,
  });

  await convex.mutation(api.customerMemories.upsertPreferredTenant, {
    customerPhone: job.customerPhone,
    preferredTenantId: matchedTenant.tenantId,
  });

  await convex.mutation(api.customerMemories.appendNote, {
    customerPhone: job.customerPhone,
    note:
      `- ${new Date().toISOString()}: Tenant switch -> ${matchedTenant.tenantName} (${matchedTenant.tenantId})`,
  });
}

async function getRememberedTenant(
  convex: ConvexHttpClient,
  customerPhone: string,
  activeTenants: ActiveTenant[]
): Promise<ActiveTenant | null> {
  const memory = await convex.query(api.customerMemories.getByPhone, {
    customerPhone,
  });
  if (!memory?.preferredTenantId) return null;

  return (
    activeTenants.find((t) => t.tenantId === memory.preferredTenantId) || null
  );
}

async function getActiveTenants(
  convex: ConvexHttpClient
): Promise<ActiveTenant[]> {
  const activeTenants = await convex.query(api.tenantCodes.listActive);
  return (activeTenants || []).map((t: any) => ({
    tenantId: t.tenantId,
    tenantName: t.tenantName,
  }));
}

function shouldAttemptTenantSwitch(
  messageText: string,
  tenants: ActiveTenant[]
): boolean {
  const normalized = messageText.toLocaleLowerCase("tr-TR");
  if (
    /(işletme değiştir|başka işletme|farklı işletme|başka salon|başka kuaför|değiştir)/i.test(
      normalized
    )
  ) {
    return true;
  }

  return tenants.some((t) =>
    normalized.includes(t.tenantName.toLocaleLowerCase("tr-TR"))
  );
}

async function selectTenantWithLlm(
  userMessage: string,
  tenants: ActiveTenant[]
): Promise<ActiveTenant | null> {
  if (!LLM_CONFIG.apiKey || tenants.length === 0) {
    return null;
  }

  const tenantList = tenants
    .map((t) => `- ${t.tenantName} (tenantId: ${t.tenantId})`)
    .join("\n");

  const payload: Record<string, unknown> = {
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
  };

  if (LLM_CONFIG.providerPriority.length > 0) {
    payload.provider = {
      order: LLM_CONFIG.providerPriority,
      allow_fallbacks: LLM_CONFIG.providerAllowFallbacks,
    };
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LLM_CONFIG.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://musait.app",
      "X-Title": "Musait Tenant Selector",
    },
    body: JSON.stringify(payload),
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

async function replyAndPersist(
  convex: ConvexHttpClient,
  args: {
    job: AgentJob;
    conversationId: any;
    content: string;
  }
): Promise<void> {
  await sendWhatsAppMessage(args.job.customerPhone, args.content, {
    phoneNumberId: args.job.outboundPhoneNumberId || args.job.phoneNumberId,
    accessToken: args.job.outboundAccessToken,
  });

  await convex.mutation(api.messages.create, {
    conversationId: args.conversationId as any,
    role: "agent",
    content: args.content,
    status: "done",
  });
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
