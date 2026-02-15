import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ===== QUERIES =====

/** Get messages for a conversation (ordered by creation time) */
export const listByConversation = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .take(limit)
      .then((msgs) => msgs.reverse()); // Return in chronological order
  },
});

/** Get recent messages for agent context window */
export const getContextWindow = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20; // Last 20 messages for context
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .take(limit)
      .then((msgs) => msgs.reverse());
  },
});

/** Get pending/processing messages (for worker recovery) */
export const getPendingMessages = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("messages")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const processing = await ctx.db
      .query("messages")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();

    return [...pending, ...processing];
  },
});

// ===== MUTATIONS =====

/** Create a new message */
export const create = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.union(
      v.literal("customer"),
      v.literal("agent"),
      v.literal("human")
    ),
    content: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      status: args.status,
      retryCount: 0,
      createdAt: now,
    });

    // Touch conversation last message timestamp
    await ctx.db.patch(args.conversationId, { lastMessageAt: now });

    return messageId;
  },
});

/** Update message status */
export const updateStatus = mutation({
  args: {
    id: v.id("messages"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

/** Increment retry count and update status */
export const markRetry = mutation({
  args: {
    id: v.id("messages"),
    newStatus: v.union(
      v.literal("pending"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.id);
    if (!message) throw new Error("Message not found");

    await ctx.db.patch(args.id, {
      retryCount: message.retryCount + 1,
      status: args.newStatus,
    });
  },
});
