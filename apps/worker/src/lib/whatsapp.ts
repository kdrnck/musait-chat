import { WHATSAPP_CONFIG } from "../config.js";

/**
 * Send a text message via WhatsApp Cloud API.
 *
 * Rate limiting should be enforced at the worker level.
 * This function is a simple API call wrapper.
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string,
  opts?: { phoneNumberId?: string; accessToken?: string }
): Promise<void> {
  const phoneNumberId = opts?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = opts?.accessToken || WHATSAPP_CONFIG.accessToken;

  if (!phoneNumberId) {
    console.error("❌ WHATSAPP_PHONE_NUMBER_ID not configured");
    return;
  }

  const url = `${WHATSAPP_CONFIG.baseUrl}/${WHATSAPP_CONFIG.apiVersion}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ WhatsApp send failed (${response.status}):`, errorText);
    throw new Error(`WhatsApp API error: ${response.status}`);
  }

  console.log(`📤 WhatsApp message sent to ${to}`);
}

/**
 * Send a WhatsApp message with quick reply buttons.
 * Useful for confirmation flows.
 */
export async function sendWhatsAppInteractive(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  opts?: { phoneNumberId?: string; accessToken?: string }
): Promise<void> {
  const phoneNumberId = opts?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = opts?.accessToken || WHATSAPP_CONFIG.accessToken;

  if (!phoneNumberId) {
    console.error("❌ WHATSAPP_PHONE_NUMBER_ID not configured");
    return;
  }

  const url = `${WHATSAPP_CONFIG.baseUrl}/${WHATSAPP_CONFIG.apiVersion}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `❌ WhatsApp interactive send failed (${response.status}):`,
      errorText
    );
    throw new Error(`WhatsApp API error: ${response.status}`);
  }

  console.log(`📤 WhatsApp interactive message sent to ${to}`);
}
