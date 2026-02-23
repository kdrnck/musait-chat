// Bootstrap Service
// Registers the WhatsApp phone number into Convex whatsappNumbers table at startup.
// This is idempotent — safe to run every startup.

import type { ConvexHttpClient } from "convex/browser";
import { api } from "../lib/convex-api.js";

/**
 * Bootstrap: Register WhatsApp phone number in Convex.
 *
 * Reads env vars:
 *   WHATSAPP_PHONE_NUMBER_ID  — Meta's phone_number_id from webhook metadata
 *   WHATSAPP_DISPLAY_NUMBER   — Human-readable number (e.g. +905001234567)
 *   IS_MASTER_NUMBER          — "true" if this is the shared musait master number
 *   WHATSAPP_TENANT_ID        — tenantId if this is a dedicated tenant number (optional)
 *
 * If WHATSAPP_PHONE_NUMBER_ID is not set, logs a warning and skips.
 */
export async function bootstrapWhatsAppNumber(
    convex: ConvexHttpClient
): Promise<void> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const displayNumber = process.env.WHATSAPP_DISPLAY_NUMBER || "";
    const isMasterNumber = process.env.IS_MASTER_NUMBER === "true";
    const tenantId = process.env.WHATSAPP_TENANT_ID || null;

    if (!phoneNumberId) {
        console.warn(
            "⚠️ WHATSAPP_PHONE_NUMBER_ID not set — skipping WhatsApp number registration.\n" +
            "   Set this env var to the phone_number_id from Meta webhook metadata."
        );
        return;
    }

    try {
        await convex.mutation(api.whatsappNumbers.register, {
            phoneNumberId,
            tenantId: isMasterNumber ? null : tenantId,
            displayNumber,
            isMasterNumber,
        });

        const label = isMasterNumber
            ? "master number"
            : `tenant number (tenantId: ${tenantId ?? "unbound"})`;

        console.log(
            `✅ WhatsApp number registered in Convex: ${phoneNumberId} (${label})`
        );
    } catch (err) {
        console.error("❌ Failed to register WhatsApp number in Convex:", err);
    }
}
