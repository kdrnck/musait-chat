import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../lib/convex-api.js";

interface ToolContext {
  tenantId: string;
  conversationId: string;
  customerPhone: string;
}

/**
 * takeNotes-forUser - Saves notes about the customer for future sessions.
 *
 * Use this tool to record important information about the customer that
 * should persist across sessions:
 * - Staff preferences ("prefers working with Ayşe")
 * - Service preferences ("always gets haircut + beard trim")
 * - Personal notes ("allergic to certain products", "prefers morning appointments")
 * - Communication preferences ("doesn't like phone calls")
 *
 * These notes will be available in future sessions to provide personalized service.
 */
export async function takeNotesForUser(
  convex: ConvexHttpClient,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const note = args.note as string | undefined;

  if (!note?.trim()) {
    return {
      success: false,
      message: "Not içeriği boş olamaz.",
    };
  }

  if (!ctx.tenantId) {
    return {
      success: false,
      message: "Müşteri henüz bir işletmeye bağlı değil. Not kaydedilemez.",
    };
  }

  try {
    // Append note with timestamp
    const timestampedNote = `[${new Date().toLocaleDateString("tr-TR")}] ${note.trim()}`;
    
    await convex.mutation(api.customerProfiles.appendNotes, {
      tenantId: ctx.tenantId,
      customerPhone: ctx.customerPhone,
      note: timestampedNote,
    });

    console.log(`📝 Note saved for customer ${ctx.customerPhone}: ${note.slice(0, 50)}...`);

    return {
      success: true,
      message: "Not başarıyla kaydedildi.",
    };
  } catch (error) {
    console.error(`❌ Failed to save note:`, error);
    return {
      success: false,
      message: "Not kaydedilemedi. Teknik bir hata oluştu.",
    };
  }
}
