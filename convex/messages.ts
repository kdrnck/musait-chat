import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ===== QUERIES =====

/** Get a single message by ID */
export const getById = query({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Get messages for a conversation (ordered by creation time)
 * 
 * Session visibility:
 * - isAdmin=true: Shows ALL messages (full history)
 * - isAdmin=false/undefined (tenant): Shows only current session messages (after sessionStartedAt)
 */
export const listByConversation = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
    isAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    // Get conversation to check sessionStartedAt
    const conversation = await ctx.db.get(args.conversationId);
    
    let messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .take(limit)
      .then((msgs) => msgs.reverse()); // Return in chronological order
    
    // If NOT admin and conversation has sessionStartedAt, filter to current session only
    // This means tenants only see messages from the active session
    if (!args.isAdmin && conversation?.sessionStartedAt) {
      messages = messages.filter(msg => msg.createdAt >= conversation.sessionStartedAt!);
    }
    
    return messages;
  },
});

/** Get recent messages for agent context window (simplified - no session filtering needed) */
export const getContextWindow = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
    // sessionStartedAt DEPRECATED: kept for backward compat, not used in new architecture
    sessionStartedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10; // Reduced to 10 since rolling summary will provide context
    
    // Simplified: just fetch the last N messages in chronological order
    // No session filtering needed because each conversation is already tenant-scoped and complete
    let messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .take(limit)
      .then((msgs) => msgs.reverse());
    
    // DEPRECATED: sessionStartedAt filtering no longer needed
    // The conversation architecture ensures message visibility naturally
    
    return messages;
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

    return [...pending, ...processing].filter((m) => m.role !== "human");
  },
});

/** Get pending human messages (for handoff outbound delivery) */
export const getPendingHumanMessages = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("messages")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return pending.filter((m) => m.role === "human");
  },
});

// ===== MUTATIONS =====

/** Create a new message and denormalize to conversation */
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
    debugInfo: v.optional(v.object({
      responseTimeMs: v.number(),
      model: v.string(),
      promptTokens: v.optional(v.number()),
      completionTokens: v.optional(v.number()),
      totalTokens: v.optional(v.number()),
      cacheReadTokens: v.optional(v.number()),
      cacheCreationTokens: v.optional(v.number()),
      thinkingContent: v.optional(v.string()),
      toolCallTrace: v.optional(v.string()),
      correlationId: v.optional(v.string()),
      timingBreakdown: v.optional(v.any()),
      errorMessage: v.optional(v.string()),
      errorType: v.optional(v.string()),
      errorStack: v.optional(v.string()),
    })),
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
      ...(args.debugInfo ? { debugInfo: args.debugInfo } : {}),
    });

    // Denormalize: update conversation's last message fields for efficient listing
    await ctx.db.patch(args.conversationId, { 
      lastMessageAt: now,
      lastMessageContent: args.content,
      lastMessageRole: args.role,
    });

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

/** Update debug info (for storing error details) */
export const updateDebugInfo = mutation({
  args: {
    id: v.id("messages"),
    debugInfo: v.object({
      responseTimeMs: v.number(),
      model: v.string(),
      promptTokens: v.optional(v.number()),
      completionTokens: v.optional(v.number()),
      totalTokens: v.optional(v.number()),
      cacheReadTokens: v.optional(v.number()),
      cacheCreationTokens: v.optional(v.number()),
      thinkingContent: v.optional(v.string()),
      toolCallTrace: v.optional(v.string()),
      correlationId: v.optional(v.string()),
      timingBreakdown: v.optional(v.any()),
      errorMessage: v.optional(v.string()),
      errorType: v.optional(v.string()),
      errorStack: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { debugInfo: args.debugInfo });
  },
});
