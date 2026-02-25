import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ===== CONVERSATIONS =====
  // Core conversation entity. One per customer phone per active session.
  // tenant_id is nullable for master number unbound state.
  conversations: defineTable({
    tenantId: v.union(v.string(), v.null()),
    customerPhone: v.string(),
    inboundPhoneNumberId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("handoff")
    ),
    lastMessageAt: v.number(),
    rollingSummary: v.string(),
    personNotes: v.string(),
    retryState: v.object({
      count: v.number(),
      lastAttempt: v.union(v.number(), v.null()),
    }),
    // Agent disabled until this timestamp (for handoff)
    agentDisabledUntil: v.union(v.number(), v.null()),
    createdAt: v.number(),
  })
    .index("by_customer_phone", ["customerPhone", "status"])
    .index("by_customer_phone_inbound", [
      "customerPhone",
      "inboundPhoneNumberId",
      "status",
    ])
    .index("by_tenant", ["tenantId", "status"])
    .index("by_status", ["status"]),

  // ===== MESSAGES =====
  // Individual messages within a conversation.
  // status tracks the processing pipeline: pending → processing → done/failed
  messages: defineTable({
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
    retryCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId", "createdAt"])
    .index("by_status", ["status"])
    .index("by_conversation_status", ["conversationId", "status"]),

  // ===== CUSTOMER PROFILES =====
  // Per-tenant customer profile for personalization.
  // Stores preferences, notes, history for agent context.
  customerProfiles: defineTable({
    tenantId: v.string(),
    customerPhone: v.string(),
    personNotes: v.string(),
    lastServices: v.array(v.string()),
    lastStaff: v.array(v.string()),
    preferences: v.any(), // flexible JSON for future fields
    updatedAt: v.number(),
  })
    .index("by_tenant_phone", ["tenantId", "customerPhone"])
    .index("by_tenant", ["tenantId"]),

  // ===== CUSTOMER MEMORIES (GLOBAL, CROSS-TENANT) =====
  // Stores cross-tenant hints such as preferred last tenant and tenant history.
  customerMemories: defineTable({
    customerPhone: v.string(),
    preferredTenantId: v.union(v.string(), v.null()),
    tenantHistory: v.array(v.string()),
    notes: v.string(),
    updatedAt: v.number(),
  }).index("by_customer_phone", ["customerPhone"]),

  // ===== WHATSAPP NUMBER MAPPINGS =====
  // Maps WhatsApp phone_number_id to tenant.
  // Master number has tenantId = null and isMasterNumber = true.
  whatsappNumbers: defineTable({
    phoneNumberId: v.string(),
    tenantId: v.union(v.string(), v.null()),
    displayNumber: v.string(),
    isMasterNumber: v.boolean(),
    isActive: v.boolean(),
  })
    .index("by_phone_number_id", ["phoneNumberId"])
    .index("by_tenant", ["tenantId"]),

  // ===== TENANT CODES =====
  // Dynamic codes for master number tenant selection.
  // e.g., "001" → tenant_abc, "002" → tenant_xyz
  tenantCodes: defineTable({
    code: v.string(),
    tenantId: v.string(),
    tenantName: v.string(),
    isActive: v.boolean(),
  })
    .index("by_code", ["code"])
    .index("by_tenant", ["tenantId"]),

  // ===== MAGIC LINKS =====
  // One-time links for human override access.
  // Generated when ask_human tool is called.
  magicLinks: defineTable({
    conversationId: v.id("conversations"),
    token: v.string(),
    createdBy: v.string(), // "system" or user_id
    expiresAt: v.number(),
    usedAt: v.union(v.number(), v.null()),
    isUsed: v.boolean(),
  })
    .index("by_token", ["token"])
    .index("by_conversation", ["conversationId"]),
});
