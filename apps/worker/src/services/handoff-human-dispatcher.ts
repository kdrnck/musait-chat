import type { ConvexHttpClient } from "convex/browser";
import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "../lib/convex-api.js";
import { sendWhatsAppMessage } from "../lib/whatsapp.js";

interface DispatcherDeps {
  convex: ConvexHttpClient;
  supabase: SupabaseClient;
  intervalMs?: number;
}

export function startHandoffHumanDispatcher({
  convex,
  supabase,
  intervalMs = 2000,
}: DispatcherDeps): () => void {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const pending = await convex.query(api.messages.getPendingHumanMessages, {});
      if (!pending || pending.length === 0) return;

      for (const message of pending) {
        await convex.mutation(api.messages.updateStatus, {
          id: message._id,
          status: "processing",
        });

        const conversation = await convex.query(api.conversations.getById, {
          id: message.conversationId,
        });

        if (!conversation || conversation.status !== "handoff") {
          await convex.mutation(api.messages.updateStatus, {
            id: message._id,
            status: "failed",
          });
          continue;
        }

        const route = await resolveOutboundRoute({
          convex,
          supabase,
          conversation,
        });

        if (!route.phoneNumberId) {
          await convex.mutation(api.messages.updateStatus, {
            id: message._id,
            status: "failed",
          });
          continue;
        }

        try {
          await sendWhatsAppMessage(conversation.customerPhone, message.content, {
            phoneNumberId: route.phoneNumberId,
            accessToken: route.accessToken,
          });

          await convex.mutation(api.messages.updateStatus, {
            id: message._id,
            status: "done",
          });
        } catch (err) {
          console.error(
            `❌ Failed to dispatch human message ${message._id}:`,
            err
          );
          await convex.mutation(api.messages.updateStatus, {
            id: message._id,
            status: "failed",
          });
        }
      }
    } catch (err) {
      console.error("❌ Handoff dispatcher tick failed:", err);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  tick().catch((err) => console.error("❌ Handoff dispatcher failed:", err));

  return () => clearInterval(timer);
}

async function resolveOutboundRoute(args: {
  convex: ConvexHttpClient;
  supabase: SupabaseClient;
  conversation: any;
}): Promise<{ phoneNumberId: string; accessToken?: string }> {
  const fallbackPhoneNumberId =
    args.conversation.inboundPhoneNumberId ||
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    "";
  let phoneNumberId = fallbackPhoneNumberId;
  let accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";

  if (!phoneNumberId) {
    return { phoneNumberId, accessToken };
  }

  const mapping = await args.convex.query(api.whatsappNumbers.getByPhoneNumberId, {
    phoneNumberId,
  });

  if (mapping?.isMasterNumber) {
    return { phoneNumberId, accessToken };
  }

  if (!mapping?.tenantId) {
    return { phoneNumberId, accessToken };
  }

  const { data: tenantCfg, error } = await args.supabase
    .from("tenants")
    .select("waba_phone_number_id, waba_access_token")
    .eq("id", mapping.tenantId)
    .single();

  if (!error && tenantCfg) {
    phoneNumberId = tenantCfg.waba_phone_number_id || phoneNumberId;
    accessToken = tenantCfg.waba_access_token || accessToken;
  }

  return { phoneNumberId, accessToken };
}
