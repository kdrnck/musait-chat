import type { ConvexHttpClient } from "convex/browser";
import type { AgentJob } from "@musait/shared";
import { api } from "../lib/convex-api.js";
import { routeMessage } from "./routing.js";
import { runAgentLoop } from "./llm.js";
import { sendWhatsAppMessage, sendWhatsAppInteractive, sendWhatsAppListMessage } from "../lib/whatsapp.js";
import { parseInteractiveResponse, buildStorageContent } from "../lib/interactive-parser.js";
import { SESSION_PROMPTS } from "./prompts/session-prompts.js";
import { ADMIN_MODE } from "./prompts/admin-mode.js";
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
import { PerfTimer, buildCorrelationId } from "../lib/perf-timer.js";
import { latencyTracker } from "../lib/latency-tracker.js";

/**
 * Creates the job handler function.
 *
 * PERF OPTIMIZATIONS applied:
 * - Removed simulateTyping (was adding 1.5s artificial delay + read receipt)
 * - Parallelized status guard + conversation fetch
 * - Preferred tenant upsert fire-and-forget (non-critical)
 * - Customer profile passed through to avoid duplicate fetch in buildContext
 * - Parallelized response save + WhatsApp send
 * - Parallelized debugInfo save + message status update
 * - Full PerfTimer instrumentation on every step
 * - LatencyTracker integration for p50/p90/p99 stats
 */
export function createJobHandler(convex: ConvexHttpClient) {
  return async function handleJob(job: AgentJob): Promise<void> {
    const correlationId = buildCorrelationId(job.conversationId, job.wamid);
    const timer = new PerfTimer("job-handler", correlationId);

    // Record queue wait time (webhook → handler start)
    if (job.webhookReceivedAt) {
      timer.record("queueWait", Date.now() - job.webhookReceivedAt);
    }

    console.log(`[${correlationId}] 🤖 Handling job ${job.id} for ${job.customerPhone}`);

    try {
      // 0. Status guard + conversation fetch — PARALLEL
      timer.start("statusGuard");
      const [currentMsg, conversationRaw] = await Promise.all([
        convex.query(api.messages.getById, { id: job.id as any }),
        convex.query(api.conversations.getById, { id: job.conversationId as any }),
      ]);
      timer.end("statusGuard");

      if (!currentMsg || currentMsg.status === "done" || currentMsg.status === "failed") {
        console.log(
          `[${correlationId}] ⏭️ Job ${job.id} already ${currentMsg?.status ?? "deleted"}, skipping`
        );
        return;
      }

      if (!conversationRaw) {
        throw new Error(`Conversation ${job.conversationId} not found`);
      }

      // 1. Mark message as processing
      await convex.mutation(api.messages.updateStatus, {
        id: job.id as any,
        status: "processing",
      });

      let conversation: any = conversationRaw;

      const normalizedMessage = job.messageContent.trim().toLocaleLowerCase("tr-TR");
      if (normalizedMessage === "/bitir") {
        // UPDATED: Archive conversation instead of resetting tenant binding.
        // New architecture: /bitir ends the session by archiving.
        // Next message creates a new lobby conversation (or tenant-scoped if remembered).
        await convex.mutation(api.conversations.archiveAndReset, {
          id: conversation._id,
        });

        await convex.mutation(api.messages.create, {
          conversationId: conversation._id,
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
      // Uses job.isMasterNumber to avoid duplicate Convex query
      timer.start("routing");
      const originalConversationId = conversation._id;
      const routingResult = await routeMessage(convex, job, conversation);
      timer.end("routing");

      if (routingResult.handled) {
        // Routing already sent a response (e.g., tenant selection prompt)
        await convex.mutation(api.messages.updateStatus, {
          id: job.id as any,
          status: "done",
        });
        return;
      }

      // UPDATED: Refresh conversation if routing changed it (warm-start creates new conversation)
      // or if it was unbound before (tenant binding might have occurred)
      if (!conversation.tenantId || (job.conversationId as any) !== originalConversationId) {
        const conversationIdToUse = (job.conversationId as any) || originalConversationId;
        const refreshedConversation = await convex.query(api.conversations.getById, {
          id: conversationIdToUse,
        });
        if (!refreshedConversation) {
          console.error(`[${correlationId}] ❌ Conversation ${conversationIdToUse} disappeared`);
          return;
        }
        conversation = refreshedConversation;
      }
      
      if (!conversation.tenantId) {
        console.log(`[${correlationId}] 🔀 Tenant not set - routing agent will handle binding`);
      }

      // 4.5 Sync customer identity — fire-and-forget preferred tenant, profile reused by buildContext
      let customerProfile: any = null;
      if (conversation.tenantId) {
        timer.start("identitySync");

        // Fire-and-forget: preferred tenant upsert (non-critical)
        convex.mutation(api.customerMemories.upsertPreferredTenant, {
          customerPhone: job.customerPhone,
          preferredTenantId: conversation.tenantId,
        }).catch((memErr) => {
          console.warn(`[${correlationId}] ⚠️ customerMemories upsert failed (non-fatal):`, memErr);
        });

        try {
          const identity = await syncCustomerIdentity(convex, {
            tenantId: conversation.tenantId,
            customerPhone: job.customerPhone,
            contactName: job.contactName,
          });
          if (identity.customerName) {
            job.customerName = identity.customerName;
          }
          customerProfile = identity.profile;
        } catch (idErr) {
          console.warn(`[${correlationId}] ⚠️ syncCustomerIdentity failed (non-fatal):`, idErr);
        }

        timer.end("identitySync");

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
              conversationId: conversation._id,
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
      // Pass timer and pre-fetched customerProfile to avoid duplicate queries
      const agentResult = await runAgentLoop(convex, job, conversation, { timer, customerProfile });
      const agentResponse = agentResult.response;
      const agentDebugInfo = agentResult.debugInfo;

      // 🔓 ADMIN MODE ACTIVATION
      if (agentResponse === "__ADMIN_MODE_ACTIVATE__") {
        console.log(`[${correlationId}] 🔓 Admin mode activated for conversation ${conversation._id}`);

        // Update conversation with admin mode flag
        await convex.mutation(api.conversations.update, {
          id: conversation._id,
          adminMode: true,
        });

        const activationMessage = ADMIN_MODE.activationMessage;

        await convex.mutation(api.messages.create, {
          conversationId: conversation._id,
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

      // 6. Parse agent response for interactive blocks (<<BUTTONS>>, <<LIST>>)
      const parsed = parseInteractiveResponse(agentResponse);
      const storageContent = buildStorageContent(parsed);

      // 6a+7. Save agent response + Send WhatsApp reply — PARALLEL
      timer.start("responseSave");
      timer.start("whatsappSend");

      const waOpts = {
        phoneNumberId: job.outboundPhoneNumberId || job.phoneNumberId,
        accessToken: job.outboundAccessToken,
      };

      const savePromise = convex.mutation(api.messages.create, {
        conversationId: conversation._id,
        role: "agent",
        content: storageContent,
        status: "done",
      });

      const sendPromise = (async () => {
        try {
          if (parsed.type === "buttons") {
            console.log(`[${correlationId}] 📤 Sending BUTTONS (${parsed.buttons.length}) to ${job.customerPhone}`);
            await sendWhatsAppInteractive(
              job.customerPhone,
              parsed.body,
              parsed.buttons,
              waOpts
            );
          } else if (parsed.type === "list") {
            console.log(`[${correlationId}] 📤 Sending LIST to ${job.customerPhone}`);
            await sendWhatsAppListMessage(
              job.customerPhone,
              parsed.body,
              parsed.button,
              parsed.sections,
              waOpts
            );
          } else {
            await sendWhatsAppMessage(job.customerPhone, agentResponse, waOpts);
          }
        } catch (sendErr) {
          if (parsed.type !== "text") {
            console.warn(`[${correlationId}] ⚠️ Interactive message failed, falling back:`, (sendErr as Error).message);
            await sendWhatsAppMessage(job.customerPhone, parsed.body, waOpts);
          } else {
            throw sendErr;
          }
        }
      })();

      const [agentMessageId] = await Promise.all([savePromise, sendPromise]);
      timer.end("responseSave");
      timer.end("whatsappSend");

      // 8. Mark done + save debug info — PARALLEL
      const finalOps: Promise<any>[] = [
        convex.mutation(api.messages.updateStatus, {
          id: job.id as any,
          status: "done",
        }),
      ];

      if (agentDebugInfo) {
        const report = timer.report();
        agentDebugInfo.timingBreakdown = report.breakdown;
        agentDebugInfo.correlationId = correlationId;

        finalOps.push(
          convex.mutation(api.messages.updateDebugInfo, {
            id: agentMessageId as any,
            debugInfo: agentDebugInfo,
          }).catch((debugErr) => {
            console.warn(`[${correlationId}] ⚠️ Could not save debugInfo:`, (debugErr as Error).message);
          })
        );
      }

      await Promise.all(finalOps);

      // Record latency for health endpoint stats
      const finalReport = timer.report();
      latencyTracker.record({
        totalMs: finalReport.totalMs,
        breakdown: finalReport.breakdown,
        correlationId,
        tenantId: conversation.tenantId,
      });

      console.log(`[${correlationId}] ✅ Job ${job.id} completed in ${finalReport.totalMs}ms`);
    } catch (err) {
      console.error(`[${correlationId}] ❌ Job ${job.id} failed:`, err);

      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorType = err instanceof Error ? err.name : 'UnknownError';
      const errorStack = err instanceof Error ? err.stack : undefined;

      const maxRetries = 3;
      if (job.retryCount >= maxRetries - 1) {
        await convex.mutation(api.messages.updateStatus, {
          id: job.id as any,
          status: "failed",
        });

        try {
          await convex.mutation(api.messages.updateDebugInfo, {
            id: job.id as any,
            debugInfo: {
              responseTimeMs: 0,
              model: 'error',
              errorMessage,
              errorType,
              errorStack: errorStack?.slice(0, 2000),
              correlationId,
            },
          });
        } catch (debugErr) {
          console.warn(`[${correlationId}] ⚠️ Failed to store error debugInfo:`, debugErr);
        }
      }

      throw err;
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
): Promise<{ customerName: string | null; profile: any }> {
  const candidateName =
    args.contactName && isLikelyRealName(args.contactName)
      ? args.contactName
      : null;

  const [customer, profile] = await Promise.all([
    ensureCustomerRecord({
      tenantId: args.tenantId,
      customerPhone: args.customerPhone,
      customerName: candidateName,
    }),
    convex.query(api.customerProfiles.getByPhone, {
      tenantId: args.tenantId,
      customerPhone: args.customerPhone,
    }),
  ]);

  const resolvedName = customer?.name || candidateName || null;
  if (!resolvedName) {
    return { customerName: null, profile };
  }

  const nextPreferences = {
    ...(profile?.preferences || {}),
    customerName: resolvedName,
  };

  await convex.mutation(api.customerProfiles.upsert, {
    tenantId: args.tenantId,
    customerPhone: args.customerPhone,
    preferences: nextPreferences,
  });

  return { customerName: resolvedName, profile };
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
