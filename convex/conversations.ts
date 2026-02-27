import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ===== QUERIES =====

/** Get active conversation by customer phone */
export const getActiveByPhone = query({
  args: {
    customerPhone: v.string(),
    inboundPhoneNumberId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversations")
      .withIndex("by_customer_phone_inbound", (q) =>
        q
          .eq("customerPhone", args.customerPhone)
          .eq("inboundPhoneNumberId", args.inboundPhoneNumberId)
          .eq("status", "active")
      )
      .first();
  },
});

/** Get conversation by ID */
export const getById = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** List conversations for a tenant with last message */
export const listByTenant = query({
  args: {
    tenantId: v.string(),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("archived"),
        v.literal("handoff")
      )
    ),
  },
  handler: async (ctx, args) => {
    // Fetch conversations
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_tenant", (q) => {
        const base = q.eq("tenantId", args.tenantId);
        return args.status ? base.eq("status", args.status) : base;
      })
      .collect();
    
    // Filter out archived by default
    const filtered = args.status 
      ? conversations 
      : conversations.filter(c => c.status !== "archived");
    
    // Enrich with last message for each conversation
    const enriched = await Promise.all(
      filtered.map(async (conv) => {
        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
          .order("desc")
          .first();
        return {
          ...conv,
          lastMessage: lastMessage?.content ?? null,
          lastMessageRole: lastMessage?.role ?? null,
        };
      })
    );
    
    // Sort by lastMessageAt descending (newest first)
    return enriched.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  },
});

/** List all conversations (admin/master view) with last message */
export const listAll = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("archived"),
        v.literal("handoff")
      )
    ),
  },
  handler: async (ctx, args) => {
    let conversations;
    if (args.status) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      // Return all non-archived by default
      const active = await ctx.db
        .query("conversations")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect();
      const handoff = await ctx.db
        .query("conversations")
        .withIndex("by_status", (q) => q.eq("status", "handoff"))
        .collect();
      conversations = [...active, ...handoff];
    }
    
    // Enrich with last message for each conversation
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
          .order("desc")
          .first();
        return {
          ...conv,
          lastMessage: lastMessage?.content ?? null,
          lastMessageRole: lastMessage?.role ?? null,
        };
      })
    );
    
    // Sort by lastMessageAt descending (newest first)
    return enriched.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  },
});

/** List unbound conversations (tenantId=null) - routing agent admin view */
export const listUnbound = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("conversations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", null).eq("status", "active"))
      .collect();
    const handoff = await ctx.db
      .query("conversations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", null).eq("status", "handoff"))
      .collect();

    const conversations = [...active, ...handoff];

    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
          .order("desc")
          .first();
        return {
          ...conv,
          lastMessage: lastMessage?.content ?? null,
          lastMessageRole: lastMessage?.role ?? null,
        };
      })
    );

    return enriched.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  },
});

/** List ALL conversations for a specific tenant (admin view — includes archived) */
export const listByTenantAdmin = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
          .order("desc")
          .first();
        return {
          ...conv,
          lastMessage: lastMessage?.content ?? null,
          lastMessageRole: lastMessage?.role ?? null,
        };
      })
    );

    return enriched.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  },
});

/** List conversations in handoff status (for staff dashboard) */
export const listHandoffs = query({
  args: { tenantId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_status", (q) => q.eq("status", "handoff"))
      .collect();

    // If tenantId provided, filter by tenant
    if (args.tenantId) {
      return conversations.filter((c) => c.tenantId === args.tenantId);
    }
    return conversations;
  },
});

// ===== MUTATIONS =====

/** Create a new conversation */
export const create = mutation({
  args: {
    tenantId: v.union(v.string(), v.null()),
    customerPhone: v.string(),
    inboundPhoneNumberId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("conversations", {
      tenantId: args.tenantId,
      customerPhone: args.customerPhone,
      inboundPhoneNumberId: args.inboundPhoneNumberId,
      status: "active",
      lastMessageAt: now,
      rollingSummary: "",
      personNotes: "",
      retryState: { count: 0, lastAttempt: null },
      agentDisabledUntil: null,
      createdAt: now,
    });
  },
});

/** Bind an unbound conversation to a tenant */
export const bindToTenant = mutation({
  args: {
    id: v.id("conversations"),
    tenantId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { tenantId: args.tenantId });
  },
});

/** Update conversation status */
export const updateStatus = mutation({
  args: {
    id: v.id("conversations"),
    status: v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("handoff")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

/** Generic update mutation for conversations */
export const update = mutation({
  args: {
    id: v.id("conversations"),
    tenantId: v.optional(v.union(v.string(), v.null())),
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("handoff")
    )),
    rollingSummary: v.optional(v.string()),
    personNotes: v.optional(v.string()),
    adminMode: v.optional(v.boolean()),
    agentDisabledUntil: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(id, filteredUpdates);
    }
  },
});

/** Update rolling summary */
export const updateSummary = mutation({
  args: {
    id: v.id("conversations"),
    rollingSummary: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { rollingSummary: args.rollingSummary });
  },
});

/** Set agent disabled (for handoff) */
export const disableAgent = mutation({
  args: {
    id: v.id("conversations"),
    disabledUntilMs: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "handoff",
      agentDisabledUntil: args.disabledUntilMs,
    });
  },
});

/** Re-enable agent (staff manually re-enables) */
export const enableAgent = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "active",
      agentDisabledUntil: null,
    });
  },
});

/** Archive conversation and reset binding (for end_session) */
export const archiveAndReset = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "archived",
      agentDisabledUntil: null,
    });
  },
});

/**
 * Reset session without archiving (for /bitir command).
 * Clears tenant binding and resets agent state so the next message
 * starts a fresh routing flow - but keeps the conversation visible
 * in the admin panel with all its messages intact.
 */
export const resetSession = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      tenantId: null,
      status: "active",
      agentDisabledUntil: null,
      adminMode: false,
      retryState: { count: 0, lastAttempt: null },
      rollingSummary: "",
      // Mark session boundary - agent will only see messages after this timestamp
      sessionStartedAt: Date.now(),
    });
  },
});

/** Update last message timestamp */
export const touchLastMessage = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastMessageAt: Date.now() });
  },
});
