import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../lib/convex-api.js";

interface BindTenantContext {
  conversationId: string;
  customerPhone?: string;
  inboundPhoneNumberId?: string;
}

interface BindTenantResult {
  success: boolean;
  message?: string;
  /** New conversation ID after tenant switch (used for side-effect propagation) */
  newConversationId?: string;
}

/**
 * bind_tenant — Archives the current conversation and creates a new tenant-scoped one.
 *
 * This ensures complete context isolation: the new conversation starts with
 * empty message history, empty rolling summary, and fresh context cache.
 * Old tenant data never leaks into the new tenant's session.
 */
export async function bindTenant(
  convex: ConvexHttpClient,
  args: { tenant_id: string },
  ctx: BindTenantContext
): Promise<BindTenantResult> {
  if (!args.tenant_id || typeof args.tenant_id !== "string") {
    return { success: false, message: "Geçersiz tenant_id." };
  }

  try {
    // Archive old conversation and create a new tenant-scoped one.
    // This is the same pattern used by routing.ts/performTenantSwitch.
    const newConversationId = await convex.mutation(
      api.conversations.bindToTenantAndCreateNew,
      {
        oldConversationId: ctx.conversationId as any,
        tenantId: args.tenant_id,
        customerPhone: ctx.customerPhone || "",
        inboundPhoneNumberId: ctx.inboundPhoneNumberId || "",
      }
    );

    // Persist preferred tenant so warm-start fires on the next session.
    if (ctx.customerPhone) {
      try {
        await convex.mutation(api.customerMemories.upsertPreferredTenant, {
          customerPhone: ctx.customerPhone,
          preferredTenantId: args.tenant_id,
        });
      } catch (memErr) {
        console.warn(`⚠️ bind_tenant: customerMemories upsert failed (non-fatal):`, memErr);
      }
    }

    return { success: true, newConversationId: newConversationId as string };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "İşletme bağlama başarısız.",
    };
  }
}
