import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ===== QUERIES =====

/** Get tenant by code */
export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tenantCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

/** List all active tenant codes */
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("tenantCodes").collect();
    return all.filter((tc) => tc.isActive);
  },
});

/** Build selection message for master number */
export const buildSelectionMessage = query({
  args: {},
  handler: async (ctx) => {
    const codes = await ctx.db.query("tenantCodes").collect();
    const active = codes.filter((tc) => tc.isActive);

    if (active.length === 0) {
      return "Şu anda aktif işletme bulunmamaktadır.";
    }

    const lines = active.map(
      (tc) => `${tc.tenantName} için '${tc.code}' yazın.`
    );

    return `Hoş geldiniz! Hangi işletmeye bağlanmak istiyorsunuz?\n\n${lines.join("\n")}`;
  },
});

// ===== MUTATIONS =====

/** Create or update a tenant code */
export const upsert = mutation({
  args: {
    code: v.string(),
    tenantId: v.string(),
    tenantName: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tenantCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tenantId: args.tenantId,
        tenantName: args.tenantName,
        isActive: args.isActive,
      });
      return existing._id;
    }

    return await ctx.db.insert("tenantCodes", {
      code: args.code,
      tenantId: args.tenantId,
      tenantName: args.tenantName,
      isActive: args.isActive,
    });
  },
});
