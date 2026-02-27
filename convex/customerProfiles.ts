import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ===== QUERIES =====

/** Get customer profile by tenant + phone */
export const getByPhone = query({
  args: {
    tenantId: v.string(),
    customerPhone: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customerProfiles")
      .withIndex("by_tenant_phone", (q) =>
        q.eq("tenantId", args.tenantId).eq("customerPhone", args.customerPhone)
      )
      .first();
  },
});

/** List all profiles for a tenant */
export const listByTenant = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customerProfiles")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  },
});

// ===== MUTATIONS =====

/** Create or update customer profile */
export const upsert = mutation({
  args: {
    tenantId: v.string(),
    customerPhone: v.string(),
    personNotes: v.optional(v.string()),
    lastServices: v.optional(v.array(v.string())),
    lastStaff: v.optional(v.array(v.string())),
    preferences: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customerProfiles")
      .withIndex("by_tenant_phone", (q) =>
        q.eq("tenantId", args.tenantId).eq("customerPhone", args.customerPhone)
      )
      .first();

    const now = Date.now();

    if (existing) {
      const updates: Record<string, unknown> = { updatedAt: now };
      if (args.personNotes !== undefined) updates.personNotes = args.personNotes;
      if (args.lastServices !== undefined) updates.lastServices = args.lastServices;
      if (args.lastStaff !== undefined) updates.lastStaff = args.lastStaff;
      if (args.preferences !== undefined) updates.preferences = args.preferences;

      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    return await ctx.db.insert("customerProfiles", {
      tenantId: args.tenantId,
      customerPhone: args.customerPhone,
      personNotes: args.personNotes ?? "",
      lastServices: args.lastServices ?? [],
      lastStaff: args.lastStaff ?? [],
      preferences: args.preferences ?? {},
      updatedAt: now,
    });
  },
});

/** Append to person notes */
export const appendNotes = mutation({
  args: {
    tenantId: v.string(),
    customerPhone: v.string(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("customerProfiles")
      .withIndex("by_tenant_phone", (q) =>
        q.eq("tenantId", args.tenantId).eq("customerPhone", args.customerPhone)
      )
      .first();

    if (!profile) return;

    const updated = profile.personNotes
      ? `${profile.personNotes}\n${args.note}`
      : args.note;

    await ctx.db.patch(profile._id, {
      personNotes: updated,
      updatedAt: Date.now(),
    });
  },
});

/** Update person notes (replace entire content) */
export const updatePersonNotes = mutation({
  args: {
    tenantId: v.string(),
    customerPhone: v.string(),
    personNotes: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("customerProfiles")
      .withIndex("by_tenant_phone", (q) =>
        q.eq("tenantId", args.tenantId).eq("customerPhone", args.customerPhone)
      )
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        personNotes: args.personNotes,
        updatedAt: Date.now(),
      });
    } else {
      // Create new profile if doesn't exist
      await ctx.db.insert("customerProfiles", {
        tenantId: args.tenantId,
        customerPhone: args.customerPhone,
        personNotes: args.personNotes,
        lastServices: [],
        lastStaff: [],
        preferences: {},
        updatedAt: Date.now(),
      });
    }
  },
});
