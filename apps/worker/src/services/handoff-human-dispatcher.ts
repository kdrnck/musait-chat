import type { ConvexHttpClient } from "convex/browser";
import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "../lib/convex-api.js";
import { sendWhatsAppMessage } from "../lib/whatsapp.js";
import { resolveOutboundRoute } from "./outbound-route.js";

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
  let warnedMissingPendingFn = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const pending = await fetchPendingHumanMessages();
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

        const route = await resolveHandoffOutboundRoute({
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

  async function fetchPendingHumanMessages(): Promise<any[]> {
    try {
      return await convex.query(api.messages.getPendingHumanMessages, {});
    } catch (error) {
      if (!isMissingPublicFunctionError(error, "messages:getPendingHumanMessages")) {
        throw error;
      }

      if (!warnedMissingPendingFn) {
        warnedMissingPendingFn = true;
        console.warn(
          "⚠️ Convex function messages:getPendingHumanMessages bulunamadı. " +
            "Handoff dispatcher fallback modunda çalışıyor; Convex deploy gerekli."
        );
      }

      try {
        const fallback = await convex.query(api.messages.getPendingMessages, {});
        return (fallback || []).filter((message: any) => message.role === "human");
      } catch {
        return [];
      }
    }
  }
}

async function resolveHandoffOutboundRoute(args: {
  supabase: SupabaseClient;
  conversation: any;
}): Promise<{ phoneNumberId: string; accessToken: string }> {
  const resolved = await resolveOutboundRoute({
    supabase: args.supabase,
    tenantId: args.conversation.tenantId,
    inboundPhoneNumberId: args.conversation.inboundPhoneNumberId,
    inboundAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  });

  return {
    phoneNumberId: resolved.phoneNumberId,
    accessToken: resolved.accessToken,
  };
}

function isMissingPublicFunctionError(error: unknown, fnName: string): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Could not find public function") &&
    error.message.includes(fnName)
  );
}
