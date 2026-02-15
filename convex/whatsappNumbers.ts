import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ===== QUERIES =====

/** Get mapping by phone_number_id */
export const getByPhoneNumberId = query({
  args: { phoneNumberId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("whatsappNumbers")
      .withIndex("by_phone_number_id", (q) =>
        q.eq("phoneNumberId", args.phoneNumberId)
      )
      .first();
  },
});

/** Get all active numbers for a tenant */
export const getByTenant = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("whatsappNumbers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect()
      .then((numbers) => numbers.filter((n) => n.isActive));
  },
});

/** Get master number */
export const getMasterNumber = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("whatsappNumbers").collect();
    return all.find((n) => n.isMasterNumber && n.isActive) ?? null;
  },
});

/** List all active numbers */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("whatsappNumbers").collect();
    return all.filter((n) => n.isActive);
  },
});

// ===== MUTATIONS =====

/** Register a WhatsApp number mapping */
export const register = mutation({
  args: {
    phoneNumberId: v.string(),
    tenantId: v.union(v.string(), v.null()),
    displayNumber: v.string(),
    isMasterNumber: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("whatsappNumbers")
      .withIndex("by_phone_number_id", (q) =>
        q.eq("phoneNumberId", args.phoneNumberId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tenantId: args.tenantId,
        displayNumber: args.displayNumber,
        isMasterNumber: args.isMasterNumber,
        isActive: true,
      });
      return existing._id;
    }

    return await ctx.db.insert("whatsappNumbers", {
      phoneNumberId: args.phoneNumberId,
      tenantId: args.tenantId,
      displayNumber: args.displayNumber,
      isMasterNumber: args.isMasterNumber,
      isActive: true,
    });
  },
});

/** Deactivate a number */
export const deactivate = mutation({
  args: { phoneNumberId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("whatsappNumbers")
      .withIndex("by_phone_number_id", (q) =>
        q.eq("phoneNumberId", args.phoneNumberId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { isActive: false });
    }
  },
});
