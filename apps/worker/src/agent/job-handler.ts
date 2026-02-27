import type { ConvexHttpClient } from "convex/browser";
import type { AgentJob } from "@musait/shared";
import { api } from "../lib/convex-api.js";
import { routeMessage } from "./routing.js";
import { runAgentLoop } from "./llm.js";
import { sendWhatsAppMessage } from "../lib/whatsapp.js";
import { handleStructuredBookingFlow } from "./booking-flow.js";
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
 * Check if booking flow is enabled for a tenant
 */
async function isBookingFlowEnabled(tenantId: string): Promise<boolean> {
  try {
    const url = new URL(`${SUPABASE_CONFIG.url}/rest/v1/tenants`);
    url.searchParams.set("id", `eq.${tenantId}`);
    url.searchParams.set("select", "integration_keys");
    url.searchParams.set("limit", "1");

    const response = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_CONFIG.serviceKey,
        Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
      },
    });
    
    if (!response.ok) return false;
    
    const rows = await response.json();
    const tenant = rows[0];
    if (!tenant?.integration_keys) return false;
    
    const val = tenant.integration_keys.ai_booking_flow_enabled;
    return val === true || val === "true";
  } catch {
    return false; // Default to disabled on error
  }
}

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
      // 1. Mark message as processing
      await convex.mutation(api.messages.updateStatus, {
        id: job.id as any,
        status: "processing",
      });

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
        await convex.mutation(api.conversations.archiveAndReset, {
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
        console.error(`❌ Tenant not set for conversation ${job.conversationId} - cannot proceed to agent`);
        await convex.mutation(api.messages.updateStatus, {
          id: job.id as any,
          status: "failed",
        });
        return;
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

      // 5. Structured booking flow (service -> staff -> date -> time)
      // Only run if explicitly enabled in tenant settings (default: disabled)
      const bookingFlowEnabled = conversation.tenantId 
        ? await isBookingFlowEnabled(conversation.tenantId)
        : false;

      if (bookingFlowEnabled) {
        console.log(`📋 Booking flow ENABLED for tenant ${conversation.tenantId}`);
        const structuredResult = await handleStructuredBookingFlow(
          convex,
          job,
          conversation as any
        );

        if (structuredResult.handled && structuredResult.reply) {
          await convex.mutation(api.messages.create, {
            conversationId: job.conversationId as any,
            role: "agent",
            content: structuredResult.reply,
            status: "done",
          });

          await sendWhatsAppMessage(job.customerPhone, structuredResult.reply, {
            phoneNumberId: job.outboundPhoneNumberId || job.phoneNumberId,
            accessToken: job.outboundAccessToken,
          });

          await convex.mutation(api.messages.updateStatus, {
            id: job.id as any,
            status: "done",
          });
          return;
        }
      } else {
        console.log(`📋 Booking flow DISABLED - LLM will handle conversation`);
      }

      // 6. Run agent loop (LLM + tool calls)
      const agentResponse = await runAgentLoop(convex, job, conversation);

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

      // 7. Save agent response as message
      await convex.mutation(api.messages.create, {
        conversationId: job.conversationId as any,
        role: "agent",
        content: agentResponse,
        status: "done",
      });

      // 8. Send WhatsApp reply
      await sendWhatsAppMessage(job.customerPhone, agentResponse, {
        phoneNumberId: job.outboundPhoneNumberId || job.phoneNumberId,
        accessToken: job.outboundAccessToken,
      });

      // 9. Mark original message as done
      await convex.mutation(api.messages.updateStatus, {
        id: job.id as any,
        status: "done",
      });

      console.log(`✅ Job ${job.id} completed successfully`);
    } catch (err) {
      console.error(`❌ Job ${job.id} failed:`, err);

      // Mark as failed if max retries exceeded
      const maxRetries = 3;
      if (job.retryCount >= maxRetries - 1) {
        await convex.mutation(api.messages.updateStatus, {
          id: job.id as any,
          status: "failed",
        });
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
