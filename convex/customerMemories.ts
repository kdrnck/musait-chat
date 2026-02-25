import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByPhone = query({
  args: { customerPhone: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customerMemories")
      .withIndex("by_customer_phone", (q) =>
        q.eq("customerPhone", args.customerPhone)
      )
      .first();
  },
});

export const upsertPreferredTenant = mutation({
  args: {
    customerPhone: v.string(),
    preferredTenantId: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customerMemories")
      .withIndex("by_customer_phone", (q) =>
        q.eq("customerPhone", args.customerPhone)
      )
      .first();

    const now = Date.now();
    const nextHistory =
      args.preferredTenantId === null
        ? existing?.tenantHistory ?? []
        : Array.from(
            new Set([...(existing?.tenantHistory ?? []), args.preferredTenantId])
          );

    if (existing) {
      await ctx.db.patch(existing._id, {
        preferredTenantId: args.preferredTenantId,
        tenantHistory: nextHistory,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("customerMemories", {
      customerPhone: args.customerPhone,
      preferredTenantId: args.preferredTenantId,
      tenantHistory: nextHistory,
      notes: "",
      updatedAt: now,
    });
  },
});

export const appendNote = mutation({
  args: {
    customerPhone: v.string(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customerMemories")
      .withIndex("by_customer_phone", (q) =>
        q.eq("customerPhone", args.customerPhone)
      )
      .first();

    const now = Date.now();

    if (!existing) {
      return await ctx.db.insert("customerMemories", {
        customerPhone: args.customerPhone,
        preferredTenantId: null,
        tenantHistory: [],
        notes: args.note.trim(),
        updatedAt: now,
      });
    }

    const base = existing.notes?.trim();
    const merged = base ? `${base}\n${args.note.trim()}` : args.note.trim();
    await ctx.db.patch(existing._id, { notes: merged, updatedAt: now });
    return existing._id;
  },
});
