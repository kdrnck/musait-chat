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
 * Mark an incoming WhatsApp message as "read" (blue checkmarks).
 *
 * NOTE: WhatsApp Cloud API does NOT support sending typing indicators
 * (composing status) to users — that's a platform limitation.
 * Marking as "read" is the closest signal we can send to show the
 * business is aware of the message while AI processes.
 */
export async function markMessageAsRead(
  messageId: string,
  opts?: { phoneNumberId?: string; accessToken?: string }
): Promise<void> {
  const phoneNumberId = opts?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = opts?.accessToken || WHATSAPP_CONFIG.accessToken;

  if (!phoneNumberId || !messageId) return;

  const url = `${WHATSAPP_CONFIG.baseUrl}/${WHATSAPP_CONFIG.apiVersion}/${phoneNumberId}/messages`;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  } catch {
    // Non-fatal: read receipt is best-effort
  }
}

/**
 * Simulate "typing" by marking the message as read and waiting.
 *
 * WhatsApp Cloud API does NOT support real typing indicators.
 * This provides a natural delay: the user sees blue checkmarks (read)
 * then waits 1.5–2s before the reply arrives — mimicking human behavior.
 *
 * @param messageId - The WhatsApp message ID (wamid) to mark as read
 * @param opts - Optional phoneNumberId and accessToken overrides
 * @param delayMs - Delay in ms after marking read (default: 1500)
 */
export async function simulateTyping(
  messageId: string,
  opts?: { phoneNumberId?: string; accessToken?: string },
  delayMs = 1500
): Promise<void> {
  try {
    await markMessageAsRead(messageId, opts);
    console.log(`👁️ Marked ${messageId} as read, waiting ${delayMs}ms`);
  } catch {
    // Non-fatal — best effort
  }
  await delay(delayMs);
}

/** Async delay helper */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

/**
 * Send a WhatsApp interactive list message.
 * Useful for presenting multiple options (services, staff, time slots).
 * 
 * @param to - Recipient phone number
 * @param bodyText - Main body text
 * @param buttonText - Button label (e.g., "Seçiniz", "Hizmet Seç")
 * @param sections - Array of sections, each containing rows
 * @param opts - Optional phoneNumberId and accessToken
 * 
 * Example:
 * ```
 * await sendWhatsAppListMessage(
 *   "+905551234567",
 *   "Hangi hizmet için randevu oluşturmak istiyorsunuz?",
 *   "Hizmet Seç",
 *   [{
 *     title: "Hizmetler",
 *     rows: [
 *       { id: "service_1", title: "Saç Kesim", description: "30 dk - 150 TL" },
 *       { id: "service_2", title: "Sakal Traşlama", description: "15 dk - 80 TL" }
 *     ]
 *   }]
 * );
 * ```
 */
export async function sendWhatsAppListMessage(
  to: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>,
  opts?: { phoneNumberId?: string; accessToken?: string; headerText?: string }
): Promise<void> {
  const phoneNumberId = opts?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = opts?.accessToken || WHATSAPP_CONFIG.accessToken;

  if (!phoneNumberId) {
    console.error("❌ WHATSAPP_PHONE_NUMBER_ID not configured");
    return;
  }

  const url = `${WHATSAPP_CONFIG.baseUrl}/${WHATSAPP_CONFIG.apiVersion}/${phoneNumberId}/messages`;

  const payload: any = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: bodyText },
      action: {
        button: buttonText,
        sections: sections.map((section) => ({
          title: section.title,
          rows: section.rows.map((row) => ({
            id: row.id,
            title: row.title,
            ...(row.description ? { description: row.description } : {}),
          })),
        })),
      },
    },
  };

  // Optional header
  if (opts?.headerText) {
    payload.interactive.header = {
      type: "text",
      text: opts.headerText,
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `❌ WhatsApp list message send failed (${response.status}):`,
      errorText
    );
    throw new Error(`WhatsApp API error: ${response.status}`);
  }

  console.log(`📤 WhatsApp list message sent to ${to}`);
}

