// WhatsApp Cloud API types (Meta)

/** Incoming webhook payload from Meta WhatsApp Cloud API */
export interface WhatsAppWebhookPayload {
  object: "whatsapp_business_account";
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string; // WhatsApp Business Account ID
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  value: WhatsAppChangeValue;
  field: "messages";
}

export interface WhatsAppChangeValue {
  messaging_product: "whatsapp";
  metadata: {
    display_phone_number: string;
    phone_number_id: string; // This is the key for tenant routing
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

export interface WhatsAppContact {
  profile: { name: string };
  wa_id: string; // Customer's WhatsApp ID (phone number)
}

export interface WhatsAppMessage {
  from: string; // Customer phone number
  id: string; // Message ID
  timestamp: string;
  type: "text" | "image" | "audio" | "video" | "document" | "location" | "interactive" | "button";
  text?: { body: string };
  // Future: handle other message types
}

export interface WhatsAppStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
}

/** Outgoing message to WhatsApp Cloud API */
export interface WhatsAppSendMessageRequest {
  messaging_product: "whatsapp";
  to: string;
  type: "text" | "interactive";
  text?: { body: string };
  interactive?: WhatsAppInteractiveMessage;
}

export interface WhatsAppInteractiveMessage {
  type: "button" | "list";
  body: { text: string };
  action: {
    buttons?: Array<{
      type: "reply";
      reply: { id: string; title: string };
    }>;
  };
}

/** WhatsApp number to tenant mapping */
export interface WhatsAppNumberMapping {
  phoneNumberId: string;
  tenantId: string | null; // null = Musait master number
  displayNumber: string;
  isMasterNumber: boolean;
}
