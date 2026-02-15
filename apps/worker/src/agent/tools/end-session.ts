import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api.js";

interface ToolContext {
  tenantId: string;
  conversationId: string;
  customerPhone: string;
}

/**
 * end_session - Archives the conversation and resets binding.
 *
 * When called:
 * 1. Updates rolling summary (if provided)
 * 2. Archives the conversation
 * 3. Resets tenant binding (for master number flow)
 *
 * After this, a new message from the same phone will create a new conversation.
 */
export async function endSession(
  convex: ConvexHttpClient,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const summary = args.summary as string | undefined;

  // 1. Update rolling summary if provided
  if (summary) {
    await convex.mutation(api.conversations.updateSummary, {
      id: ctx.conversationId as any,
      rollingSummary: summary,
    });
  }

  // 2. Archive conversation
  await convex.mutation(api.conversations.archiveAndReset, {
    id: ctx.conversationId as any,
  });

  console.log(`📦 Session ended for conversation ${ctx.conversationId}`);

  return {
    success: true,
    message: "Oturum sonlandırıldı. İyi günler!",
  };
}
