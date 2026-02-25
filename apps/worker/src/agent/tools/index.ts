import type { ConvexHttpClient } from "convex/browser";
import type { ToolCallRequest, ToolCallResult, AgentToolName } from "@musait/shared";
import { viewAvailableSlots } from "./view-slots.js";
import { createAppointment } from "./create-appointment.js";
import { cancelAppointment } from "./cancel-appointment.js";
import { askHuman } from "./ask-human.js";
import { endSession } from "./end-session.js";

interface ToolContext {
  tenantId: string;
  conversationId: string;
  customerPhone: string;
  customerName?: string;
}

/**
 * Execute a tool call.
 * All tool calls are server-side only.
 * All respect tenant isolation.
 */
export async function executeToolCall(
  convex: ConvexHttpClient,
  toolCall: ToolCallRequest,
  ctx: ToolContext
): Promise<ToolCallResult> {
  try {
    let result: unknown;

    switch (toolCall.name) {
      case "view_available_slots":
        result = await viewAvailableSlots(toolCall.arguments, ctx);
        break;
      case "create_appointment":
        result = await createAppointment(toolCall.arguments, ctx);
        break;
      case "cancel_appointment":
        result = await cancelAppointment(toolCall.arguments, ctx);
        break;
      case "ask_human":
        result = await askHuman(convex, toolCall.arguments, ctx);
        break;
      case "end_session":
        result = await endSession(convex, toolCall.arguments, ctx);
        break;
      default:
        return {
          toolCallId: toolCall.id,
          name: toolCall.name,
          result: null,
          error: `Unknown tool: ${toolCall.name}`,
        };
    }

    return {
      toolCallId: toolCall.id,
      name: toolCall.name,
      result,
    };
  } catch (err) {
    console.error(`❌ Tool ${toolCall.name} failed:`, err);
    return {
      toolCallId: toolCall.id,
      name: toolCall.name,
      result: null,
      error: err instanceof Error ? err.message : "Tool execution failed",
    };
  }
}

/**
 * OpenRouter/OpenAI-compatible tool definitions.
 * These are sent with every LLM call.
 */
export function getToolDefinitions() {
  return [
    {
      type: "function",
      function: {
        name: "view_available_slots",
        description:
          "Belirtilen tarih için müsait randevu slotlarını gösterir. Hizmet ve personel filtresi opsiyoneldir.",
        parameters: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "Tarih (YYYY-MM-DD formatında)",
            },
            service_id: {
              type: "string",
              description: "Hizmet ID (opsiyonel)",
            },
            staff_id: {
              type: "string",
              description: "Personel ID (opsiyonel)",
            },
          },
          required: ["date"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_appointment",
        description:
          "Yeni bir randevu oluşturur. Müşteriden açık onay ALDIKTAN SONRA kullanılmalıdır.",
        parameters: {
          type: "object",
          properties: {
            service_id: {
              type: "string",
              description: "Hizmet ID",
            },
            staff_id: {
              type: "string",
              description: "Personel ID",
            },
            start_time: {
              type: "string",
              description: "Başlangıç zamanı (ISO 8601 formatında)",
            },
            customer_name: {
              type: "string",
              description: "Müşteri adı (opsiyonel)",
            },
          },
          required: ["service_id", "staff_id", "start_time"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "cancel_appointment",
        description: "Mevcut bir randevuyu iptal eder.",
        parameters: {
          type: "object",
          properties: {
            appointment_id: {
              type: "string",
              description: "İptal edilecek randevu ID",
            },
            reason: {
              type: "string",
              description: "İptal sebebi (opsiyonel)",
            },
          },
          required: ["appointment_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "ask_human",
        description:
          "Konuşmayı bir insan operatöre devreder. Karmaşık veya yanıtlanamayan durumlar için kullanılır.",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Devir sebebi",
            },
          },
          required: ["reason"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "end_session",
        description:
          "Konuşma oturumunu sonlandırır ve arşivler. Müşteri işini bitirdiğinde kullanılır.",
        parameters: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "Konuşma özeti (opsiyonel)",
            },
          },
          required: [],
        },
      },
    },
  ];
}
