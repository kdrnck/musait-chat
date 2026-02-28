import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../lib/convex-api.js";

export async function bindTenant(
  convex: ConvexHttpClient,
  args: { tenant_id: string },
  ctx: { conversationId: string; customerPhone?: string }
): Promise<{ success: boolean; message?: string }> {
  if (!args.tenant_id || typeof args.tenant_id !== "string") {
    return { success: false, message: "Geçersiz tenant_id." };
  }

  try {
    await convex.mutation(api.conversations.bindToTenant, {
      id: ctx.conversationId as any,
      tenantId: args.tenant_id,
    });

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

    return { success: true };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "İşletme bağlama başarısız.",
    };
  }
}
