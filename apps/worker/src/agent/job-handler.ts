import type { ConvexHttpClient } from "convex/browser";
import type { AgentJob } from "@musait/shared";
import { api } from "../lib/convex-api.js";
import { routeMessage } from "./routing.js";
import { runAgentLoop } from "./llm.js";
import { sendWhatsAppMessage, simulateTyping } from "../lib/whatsapp.js";
import { SESSION_PROMPTS, ADMIN_MODE } from "./master-prompts.js";
import { SUPABASE_CONFIG } from "../config.js";
import {
  extractNameUpdateIntent,
  isLikelyRealName,
} from "./customer-name.js";
import {
  ensureCustomerRecord,
  getCustomerByPhone,
  updateCustomerName,
  createCustomer,
} from "../services/customers.js";

/**
 * Creates the job handler function.
 *
 * This is the ONLY consumer of the queue.
 * When migrating to Redis, this function stays IDENTICAL.
 * Only the queue implementation changes.
 */
export function createJobHandler(convex: ConvexHttpClient) {
  return async function handleJob(job: AgentJob): Promise<void> {
    console.log(`🤖 Handling job ${job.id} for ${job.customerPhone}`);

    try {
      // 0. Status guard — skip if already processed (duplicate webhook / recovery race)
      const currentMsg = await convex.query(api.messages.getById, {
        id: job.id as any,
      });
      if (!currentMsg || currentMsg.status === "done" || currentMsg.status === "failed") {
        console.log(
          `⏭️ Job ${job.id} already ${currentMsg?.status ?? "deleted"}, skipping`
        );
        return;
      }

      // 1. Mark message as processing
      await convex.mutation(api.messages.updateStatus, {
        id: job.id as any,
        status: "processing",
      });

      // 1a. Read receipt + typing simulation
      if (job.wamid) {
        await simulateTyping(job.wamid, {
          phoneNumberId: job.outboundPhoneNumberId || job.phoneNumberId,
          accessToken: job.outboundAccessToken,
        });
      }

      // 2. Get conversation
      const conversationRaw = await convex.query(api.conversations.getById, {
        id: job.conversationId as any,
      });

      if (!conversationRaw) {
        throw new Error(`Conversation ${job.conversationId} not found`);
      }
      let conversation: any = conversationRaw;

      const normalizedMessage = job.messageContent.trim().toLocaleLowerCase("tr-TR");
      if (normalizedMessage === "/bitir") {
        // Reset session without archiving — agent state cleared (tenantId null, fresh routing)
        // but conversation stays visible in admin panel with all messages intact.
        await convex.mutation(api.conversations.resetSession, {
          id: conversation._id,
        });

        await convex.mutation(api.messages.create, {
          conversationId: job.conversationId as any,
          role: "agent",
          content: SESSION_PROMPTS.ended,
          status: "done",
        });

        await sendWhatsAppMessage(job.customerPhone, SESSION_PROMPTS.ended, {
          phoneNumberId: job.outboundPhoneNumberId || job.phoneNumberId,
          accessToken: job.outboundAccessToken,
        });

        await convex.mutation(api.messages.updateStatus, {
          id: job.id as any,
          status: "done",
        });
        return;
      }

      // 3. Handle handoff mode
      if (
        conversation.status === "handoff" &&
        conversation.agentDisabledUntil &&
        Date.now() >= conversation.agentDisabledUntil
      ) {
        await convex.mutation(api.conversations.enableAgent, {
          id: conversation._id,
        });
        conversation = {
          ...conversation,
          status: "active",
          agentDisabledUntil: null,
        };
      }

      if (
        conversation.status === "handoff" &&
        (!conversation.agentDisabledUntil ||
          Date.now() < conversation.agentDisabledUntil)
      ) {
        console.log(
          `⏸️ Agent disabled for conversation ${job.conversationId} (handoff mode)`
        );
        // Mark message as done — human will handle
        await convex.mutation(api.messages.updateStatus, {
          id: job.id as any,
          status: "done",
        });
        return;
      }

      // 4. Route message (handle unbound/master number flow)
      const routingResult = await routeMessage(convex, job, conversation);

      if (routingResult.handled) {
        // Routing already sent a response (e.g., tenant selection prompt)
        await convex.mutation(api.messages.updateStatus, {
          id: job.id as any,
          status: "done",
        });
        return;
      }

      // SAFETY: Ensure tenant is set before proceeding to agent
      // If routing returned handled:false, tenant must be set
      // Refresh conversation to get updated tenantId if it was bound during routing
      const refreshedConversation = await convex.query(api.conversations.getById, {
        id: job.conversationId as any,
      });
      
      if (!refreshedConversation) {
        console.error(`❌ Conversation ${job.conversationId} disappeared`);
        return;
      }
      
      conversation = refreshedConversation;
      
      if (!conversation.tenantId) {
        console.log(`🔀 Tenant not set for conversation ${job.conversationId} - routing agent will handle binding`);
      }

      // 4.5 Sync customer identity and handle explicit name updates
      if (conversation.tenantId) {
        try {
          await convex.mutation(api.customerMemories.upsertPreferredTenant, {
            customerPhone: job.customerPhone,
            preferredTenantId: conversation.tenantId,
          });
        } catch (memErr) {
          console.warn(`⚠️ customerMemories upsert failed (non-fatal):`, memErr);
        }

        try {
          const identity = await syncCustomerIdentity(convex, {
            tenantId: conversation.tenantId,
            customerPhone: job.customerPhone,
            contactName: job.contactName,
          });
          if (identity.customerName) {
            job.customerName = identity.customerName;
          }
        } catch (idErr) {
          console.warn(`⚠️ syncCustomerIdentity failed (non-fatal):`, idErr);
        }

        const requestedName = extractNameUpdateIntent(job.messageContent);
        if (requestedName && isLikelyRealName(requestedName)) {
          try {
            await applyExplicitNameUpdate(convex, {
              tenantId: conversation.tenantId,
              customerPhone: job.customerPhone,
              newName: requestedName,
            });

            const updateReply = `Üzgünüm, kaydınızı *${requestedName}* olarak güncelledim.`;

            await convex.mutation(api.messages.create, {
              conversationId: job.conversationId as any,
              role: "agent",
              content: updateReply,
              status: "done",
            });

            await sendWhatsAppMessage(job.customerPhone, updateReply, {
              phoneNumberId: job.outboundPhoneNumberId || job.phoneNumberId,
              accessToken: job.outboundAccessToken,
            });

            await convex.mutation(api.messages.updateStatus, {
              id: job.id as any,
              status: "done",
            });
            return;
          } catch (nameErr) {
            console.warn(`⚠️ applyExplicitNameUpdate failed (non-fatal):`, nameErr);
          }
        }
      }

      // 5. Run agent loop (LLM + tool calls)
      const agentResult = await runAgentLoop(convex, job, conversation);
      const agentResponse = agentResult.response;
      const agentDebugInfo = agentResult.debugInfo;

      // 🔓 ADMIN MODE ACTIVATION
      if (agentResponse === "__ADMIN_MODE_ACTIVATE__") {
        console.log(`🔓 Admin mode activated for conversation ${job.conversationId}`);

        // Update conversation with admin mode flag
        await convex.mutation(api.conversations.update, {
          id: conversation._id,
          adminMode: true,
        });

        const activationMessage = ADMIN_MODE.activationMessage;

        await convex.mutation(api.messages.create, {
          conversationId: job.conversationId as any,
          role: "agent",
          content: activationMessage,
          status: "done",
        });

        await sendWhatsAppMessage(job.customerPhone, activationMessage, {
          phoneNumberId: job.outboundPhoneNumberId || job.phoneNumberId,
          accessToken: job.outboundAccessToken,
        });

        await convex.mutation(api.messages.updateStatus, {
          id: job.id as any,
          status: "done",
        });
        return;
      }

      // 6. Save agent response as message
      const agentMessageId = await convex.mutation(api.messages.create, {
        conversationId: job.conversationId as any,
        role: "agent",
        content: agentResponse,
        status: "done",
      });

      // 6a. Attach debug metrics separately (non-fatal if schema not yet deployed)
      if (agentDebugInfo) {
        try {
          await convex.mutation(api.messages.updateDebugInfo, {
            id: agentMessageId as any,
            debugInfo: agentDebugInfo,
          });
        } catch (debugErr) {
          console.warn(`⚠️ Could not save debugInfo (schema may need deployment):`, (debugErr as Error).message);
        }
      }

      // 7. Send WhatsApp reply
      await sendWhatsAppMessage(job.customerPhone, agentResponse, {
        phoneNumberId: job.outboundPhoneNumberId || job.phoneNumberId,
        accessToken: job.outboundAccessToken,
      });

      // 8. Mark original message as done
      await convex.mutation(api.messages.updateStatus, {
        id: job.id as any,
        status: "done",
      });

      console.log(`✅ Job ${job.id} completed successfully`);
    } catch (err) {
      console.error(`❌ Job ${job.id} failed:`, err);

      // Extract error information for debugging
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorType = err instanceof Error ? err.name : 'UnknownError';
      const errorStack = err instanceof Error ? err.stack : undefined;

      // Mark as failed if max retries exceeded
      const maxRetries = 3;
      if (job.retryCount >= maxRetries - 1) {
        await convex.mutation(api.messages.updateStatus, {
          id: job.id as any,
          status: "failed",
        });

        // Store error details in debugInfo for admin panel visibility
        try {
          await convex.mutation(api.messages.updateDebugInfo, {
            id: job.id as any,
            debugInfo: {
              responseTimeMs: 0,
              model: 'error',
              errorMessage,
              errorType,
              errorStack: errorStack?.slice(0, 2000), // Limit stack trace size
            },
          });
        } catch (debugErr) {
          console.warn('⚠️ Failed to store error debugInfo:', debugErr);
        }
      }

      throw err; // Re-throw for queue retry logic
    }
  };
}

async function syncCustomerIdentity(
  convex: ConvexHttpClient,
  args: {
    tenantId: string;
    customerPhone: string;
    contactName?: string;
  }
): Promise<{ customerName: string | null }> {
  const candidateName =
    args.contactName && isLikelyRealName(args.contactName)
      ? args.contactName
      : null;

  const customer = await ensureCustomerRecord({
    tenantId: args.tenantId,
    customerPhone: args.customerPhone,
    customerName: candidateName,
  });

  const resolvedName = customer?.name || candidateName || null;
  if (!resolvedName) {
    return { customerName: null };
  }

  const profile = await convex.query(api.customerProfiles.getByPhone, {
    tenantId: args.tenantId,
    customerPhone: args.customerPhone,
  });

  const nextPreferences = {
    ...(profile?.preferences || {}),
    customerName: resolvedName,
  };

  await convex.mutation(api.customerProfiles.upsert, {
    tenantId: args.tenantId,
    customerPhone: args.customerPhone,
    preferences: nextPreferences,
  });

  return { customerName: resolvedName };
}

async function applyExplicitNameUpdate(
  convex: ConvexHttpClient,
  args: {
    tenantId: string;
    customerPhone: string;
    newName: string;
  }
): Promise<void> {
  const existingCustomer = await getCustomerByPhone(
    args.tenantId,
    args.customerPhone
  );

  if (existingCustomer) {
    await updateCustomerName(existingCustomer.id, args.newName);
  } else {
    await createCustomer(args.tenantId, args.customerPhone, args.newName);
  }

  const profile = await convex.query(api.customerProfiles.getByPhone, {
    tenantId: args.tenantId,
    customerPhone: args.customerPhone,
  });

  const nextPreferences = {
    ...(profile?.preferences || {}),
    customerName: args.newName,
  };

  await convex.mutation(api.customerProfiles.upsert, {
    tenantId: args.tenantId,
    customerPhone: args.customerPhone,
    preferences: nextPreferences,
  });
}
