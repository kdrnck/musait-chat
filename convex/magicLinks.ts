import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ===== QUERIES =====

/** Validate a magic link token */
export const validate = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("magicLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!link) return { valid: false, reason: "not_found" as const };
    if (link.isUsed) return { valid: false, reason: "already_used" as const };
    if (Date.now() > link.expiresAt)
      return { valid: false, reason: "expired" as const };

    return {
      valid: true,
      conversationId: link.conversationId,
    };
  },
});

// ===== MUTATIONS =====

/** Create a magic link */
export const create = mutation({
  args: {
    conversationId: v.id("conversations"),
    token: v.string(),
    createdBy: v.string(),
    expiresInMs: v.optional(v.number()), // default: 1 hour
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + (args.expiresInMs ?? 60 * 60 * 1000); // 1 hour default

    return await ctx.db.insert("magicLinks", {
      conversationId: args.conversationId,
      token: args.token,
      createdBy: args.createdBy,
      expiresAt,
      usedAt: null,
      isUsed: false,
    });
  },
});

/** Mark magic link as used (one-time) */
export const markUsed = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("magicLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!link) throw new Error("Magic link not found");
    if (link.isUsed) throw new Error("Magic link already used");
    if (Date.now() > link.expiresAt) throw new Error("Magic link expired");

    await ctx.db.patch(link._id, {
      isUsed: true,
      usedAt: Date.now(),
    });

    return link.conversationId;
  },
});
