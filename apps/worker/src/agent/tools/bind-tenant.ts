import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../lib/convex-api.js";

export async function bindTenant(
  convex: ConvexHttpClient,
  args: { tenant_id: string },
  ctx: { conversationId: string }
): Promise<{ success: boolean; message?: string }> {
  if (!args.tenant_id || typeof args.tenant_id !== "string") {
    return { success: false, message: "Geçersiz tenant_id." };
  }

  try {
    await convex.mutation(api.conversations.bindToTenant, {
      id: ctx.conversationId as any,
      tenantId: args.tenant_id,
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "İşletme bağlama başarısız.",
    };
  }
}
