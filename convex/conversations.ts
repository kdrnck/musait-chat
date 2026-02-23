import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ===== QUERIES =====

/** Get active conversation by customer phone */
export const getActiveByPhone = query({
  args: { customerPhone: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversations")
      .withIndex("by_customer_phone", (q) =>
        q.eq("customerPhone", args.customerPhone).eq("status", "active")
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

/** List conversations for a tenant */
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
    let q = ctx.db
      .query("conversations")
      .withIndex("by_tenant", (q) => {
        const base = q.eq("tenantId", args.tenantId);
        return args.status ? base.eq("status", args.status) : base;
      });
    return await q.collect();
  },
});

/** List all conversations (admin/master view) */
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
    if (args.status) {
      return await ctx.db
        .query("conversations")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }
    // Return all non-archived by default
    const active = await ctx.db
      .query("conversations")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const handoff = await ctx.db
      .query("conversations")
      .withIndex("by_status", (q) => q.eq("status", "handoff"))
      .collect();
    return [...active, ...handoff];
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
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("conversations", {
      tenantId: args.tenantId,
      customerPhone: args.customerPhone,
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

/** Update last message timestamp */
export const touchLastMessage = mutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastMessageAt: Date.now() });
  },
});
