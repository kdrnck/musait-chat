import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ===== QUERIES =====

/** Get active conversation by customer phone (lobby or by inbound number) */
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

/** NEW: Get active conversation for a specific customer+tenant combo (tenant-scoped immutable binding) */
export const getActiveByPhoneAndTenant = query({
  args: {
    customerPhone: v.string(),
    tenantId: v.string(),
    inboundPhoneNumberId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversations")
      .withIndex("by_customer_phone_tenant", (q) =>
        q
          .eq("customerPhone", args.customerPhone)
          .eq("tenantId", args.tenantId)
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

/** List conversations for a tenant (denormalized lastMessage, no N+1 queries) */
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
    
    // Filter out archived by default (if no status provided)
    const filtered = args.status 
      ? conversations 
      : conversations.filter(c => c.status !== "archived");
    
    // Sort by lastMessageAt descending (newest first)
    // No N+1 queries — use denormalized lastMessageContent/lastMessageRole
    return filtered.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  },
});

/** List all conversations (admin/master view) - no N+1 queries */
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
    
    // Sort by lastMessageAt descending (newest first)
    // Use denormalized lastMessageContent/lastMessageRole - no N+1 queries
    return conversations.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  },
});

/** List unbound conversations (tenantId=null) - routing agent admin view, no N+1 */
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

    // Sort by lastMessageAt descending (newest first)
    // Use denormalized fields - no N+1 queries
    return conversations.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
  },
});

/** List ALL conversations for a specific tenant (admin view — includes archived), no N+1 */
export const listByTenantAdmin = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Sort by lastMessageAt descending (newest first)
    // Use denormalized lastMessageContent/lastMessageRole - no N+1 queries
    return conversations.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
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
      lastMessageContent: undefined, // Denormalized field for efficient listing
      lastMessageRole: undefined,    // Denormalized field for efficient listing
      rollingSummary: "",
      personNotes: "",
      retryState: { count: 0, lastAttempt: null },
      agentDisabledUntil: null,
      createdAt: now,
    });
  },
});

/** DEPRECATED: Use bindToTenantAndCreateNew instead - Bind an unbound conversation to a tenant */
export const bindToTenant = mutation({
  args: {
    id: v.id("conversations"),
    tenantId: v.string(),
  },
  handler: async (ctx, args) => {
    // DEPRECATED - this violates immutability. Use bindToTenantAndCreateNew instead.
    // Kept for backward compatibility only.
    await ctx.db.patch(args.id, { tenantId: args.tenantId });
  },
});

/** NEW: Bind unbound conversation to tenant by archiving lobby and creating new tenant-scoped conversation */
export const bindToTenantAndCreateNew = mutation({
  args: {
    oldConversationId: v.id("conversations"),
    tenantId: v.string(),
    customerPhone: v.string(),
    inboundPhoneNumberId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Archive the old lobby conversation
    await ctx.db.patch(args.oldConversationId, { status: "archived" });

    // 2. Create new tenant-scoped conversation
    const now = Date.now();
    return await ctx.db.insert("conversations", {
      tenantId: args.tenantId,
      customerPhone: args.customerPhone,
      inboundPhoneNumberId: args.inboundPhoneNumberId,
      status: "active",
      lastMessageAt: now,
      lastMessageContent: undefined,
      lastMessageRole: undefined,
      rollingSummary: "",
      personNotes: "",
      retryState: { count: 0, lastAttempt: null },
      agentDisabledUntil: null,
      createdAt: now,
    });
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
 * Reset session (for /bitir command) - NOW JUST ARCHIVES.
 * With tenant-scoped-immutable conversations, session reset means
 * archiving the current conversation. Next message starts a new lobby conversation.
 * DEPRECATED: Use archiveAndReset directly instead.
 */
export const resetSession = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    // Archive the conversation - this ends the session
    await ctx.db.patch(args.id, {
      status: "archived",
      agentDisabledUntil: null,
      adminMode: false,
      retryState: { count: 0, lastAttempt: null },
      rollingSummary: "",
      // DEPRECATED: sessionStartedAt no longer used in new architecture
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
