import type { ConvexHttpClient } from "convex/browser";
import type { AgentJob } from "@musait/shared";
import { api } from "../../../../convex/_generated/api.js";
import { routeMessage } from "./routing.js";
import { runAgentLoop } from "./llm.js";
import { sendWhatsAppMessage } from "../lib/whatsapp.js";

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
      const conversation = await convex.query(api.conversations.getById, {
        id: job.conversationId as any,
      });

      if (!conversation) {
        throw new Error(`Conversation ${job.conversationId} not found`);
      }

      // 3. Check if agent is disabled (handoff mode)
      if (
        conversation.agentDisabledUntil &&
        Date.now() < conversation.agentDisabledUntil
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

      // 5. Run agent loop (LLM + tool calls)
      const agentResponse = await runAgentLoop(convex, job, conversation);

      // 6. Save agent response as message
      await convex.mutation(api.messages.create, {
        conversationId: job.conversationId as any,
        role: "agent",
        content: agentResponse,
        status: "done",
      });

      // 7. Send WhatsApp reply
      await sendWhatsAppMessage(job.customerPhone, agentResponse);

      // 8. Mark original message as done
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
