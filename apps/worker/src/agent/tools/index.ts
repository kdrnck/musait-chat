import type { ConvexHttpClient } from "convex/browser";
import type { ToolCallRequest, ToolCallResult, AgentToolName } from "@musait/shared";
import { viewAvailableSlots } from "./view-slots.js";
import { createAppointment } from "./create-appointment.js";
import { createAppointmentsBatch } from "./create-appointments-batch.js";
import { cancelAppointment } from "./cancel-appointment.js";
import { askHuman } from "./ask-human.js";
import { endSession } from "./end-session.js";
import { suggestLeastBusyStaff } from "./suggest-staff.js";
import { bindTenant } from "./bind-tenant.js";
import { listServices, listStaff, getBusinessInfo } from "./list-business-data.js";
import { listCustomerAppointments } from "./list-customer-appointments.js";
import { listBusinesses } from "./list-businesses.js";
import { takeNotesForUser } from "./take-notes.js";
import { updateCustomerName } from "./update-customer-name.js";
import { composeInteractiveMessage } from "./compose-interactive-message.js";

const TOOL_TIMEOUT_MS = 10_000;

interface ToolContext {
  tenantId: string | null;
  conversationId: string;
  customerPhone: string;
  customerName?: string;
}

/**
 * Execute a tool call with a 10s timeout per tool.
 * All tool calls are server-side only.
 * All respect tenant isolation.
 */
export async function executeToolCall(
  convex: ConvexHttpClient,
  toolCall: ToolCallRequest,
  ctx: ToolContext
): Promise<ToolCallResult> {
  const timeoutPromise: Promise<ToolCallResult> = new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          toolCallId: toolCall.id,
          name: toolCall.name,
          result: null,
          error: `Tool '${toolCall.name}' timed out after ${TOOL_TIMEOUT_MS}ms`,
        }),
      TOOL_TIMEOUT_MS
    )
  );

  return Promise.race([executeToolCallInner(convex, toolCall, ctx), timeoutPromise]);
}

async function executeToolCallInner(
  convex: ConvexHttpClient,
  toolCall: ToolCallRequest,
  ctx: ToolContext
): Promise<ToolCallResult> {
  try {
    let result: unknown;
    const tenantRequiredTools = new Set([
      "list_services",
      "list_staff",
      "get_business_info",
      "list_customer_appointments",
      "view_available_slots",
      "create_appointment",
      "create_appointments_batch",
      "cancel_appointment",
      "suggest_least_busy_staff",
      "take_notes_for_user",
      "update_customer_name",
    ]);

    if (tenantRequiredTools.has(toolCall.name) && !ctx.tenantId) {
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        result: null,
        error: "Bu işlem için önce işletme bağlamam gerekiyor.",
      };
    }

    switch (toolCall.name) {
      case "list_services":
        result = await listServices(toolCall.arguments, { tenantId: ctx.tenantId! });
        break;
      case "list_staff":
        result = await listStaff(toolCall.arguments, { tenantId: ctx.tenantId! });
        break;
      case "get_business_info":
        result = await getBusinessInfo(toolCall.arguments, { tenantId: ctx.tenantId! });
        break;
      case "list_customer_appointments":
        result = await listCustomerAppointments(toolCall.arguments, {
          tenantId: ctx.tenantId!,
          customerPhone: ctx.customerPhone,
        });
        break;
      case "view_available_slots":
        result = await viewAvailableSlots(toolCall.arguments, { ...ctx, tenantId: ctx.tenantId! });
        break;
      case "create_appointment":
        result = await createAppointment(toolCall.arguments, { ...ctx, tenantId: ctx.tenantId! });
        break;
      case "create_appointments_batch":
        result = await createAppointmentsBatch(toolCall.arguments, {
          ...ctx,
          tenantId: ctx.tenantId!,
        });
        break;
      case "cancel_appointment":
        result = await cancelAppointment(toolCall.arguments, { ...ctx, tenantId: ctx.tenantId! });
        break;
      case "ask_human":
      case "handOff":
        result = await askHuman(convex, toolCall.arguments, { ...ctx, tenantId: ctx.tenantId! });
        break;
      case "end_session":
        result = await endSession(convex, toolCall.arguments, { ...ctx, tenantId: ctx.tenantId! });
        break;
      case "suggest_least_busy_staff":
        result = await suggestLeastBusyStaff(toolCall.arguments, { ...ctx, tenantId: ctx.tenantId! });
        break;
      case "list_businesses":
        result = await listBusinesses(convex);
        break;
      case "bind_tenant":
        result = await bindTenant(convex, toolCall.arguments as { tenant_id: string }, {
          conversationId: ctx.conversationId,
          customerPhone: ctx.customerPhone,
        });
        break;
      case "take_notes_for_user":
        result = await takeNotesForUser(convex, toolCall.arguments, {
          tenantId: ctx.tenantId!,
          conversationId: ctx.conversationId,
          customerPhone: ctx.customerPhone,
        });
        break;
      case "update_customer_name":
        result = await updateCustomerName(convex, toolCall.arguments, {
          tenantId: ctx.tenantId!,
          conversationId: ctx.conversationId,
          customerPhone: ctx.customerPhone,
        });
        break;
      case "compose_interactive_message":
        result = await composeInteractiveMessage(toolCall.arguments);
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
        name: "list_customer_appointments",
        description:
          "Konuşmadaki müşterinin mevcut/gelecek randevularını listeler. İptal/değişiklik akışından önce kullan.",
        parameters: {
          type: "object",
          properties: {
            only_future: {
              type: "boolean",
              description: "Sadece gelecek randevuları döndür (varsayılan: true)",
            },
            include_cancelled: {
              type: "boolean",
              description: "İptal edilmiş randevuları da dahil et (varsayılan: false)",
            },
            limit: {
              type: "number",
              description: "Maksimum randevu sayısı (varsayılan: 10, max: 20)",
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_businesses",
        description:
          "Aktif işletmelerin listesini döndürür. Her işletme için tenantId, tenantName ve code bilgisi içerir. " +
          "İşletme seçimi veya değiştirme öncesinde MUTLAKA çağır — bind_tenant'a geçerli tenant_id vermek için bu listeye ihtiyacın var. " +
          "Kullanıcıya işletme adlarını göster, tenant_id'yi asla gösterme.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "bind_tenant",
        description:
          "Konuşmayı belirtilen işletmeye bağlar. İşletme değiştirme, ilk bağlantı veya yeniden bağlantı için kullan. " +
          "MUTLAKA önce list_businesses çağrılmalı — oradan gelen tenant_id kullanılmalı. " +
          "Başarılı olursa konuşma artık bu işletme kapsamında çalışır ve tüm randevu/hizmet/personel verileri bu işletmeye ait olur. " +
          "Önceki işletmenin verileri geçersiz olur. Kullanıcıya tenant_id gösterme, sadece işletme adını kullan.",
        parameters: {
          type: "object",
          properties: {
            tenant_id: {
              type: "string",
              description: "Bağlanacak işletmenin tenant ID'si (list_businesses'tan alınmalı)",
            },
          },
          required: ["tenant_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "view_available_slots",
        description:
          "Belirtilen tarih için müsait randevu slotlarını gösterir. Varsayılan olarak optimize edilmiş önerilen slotları döner (slots alanı). Müşteri daha fazla saat istediğinde show_all: true geçin.",
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
            show_all: {
              type: "boolean",
              description: "true geçilirse tüm boş saatler döner. Sadece müşteri \"başka saat var mı\" veya \"diğer saatler\" gibi bir şey söylediğinde kullanın. Aksi halde false/eksik bırakın.",
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
              description: "Başlangıç zamanı — ISO 8601, İstanbul timezone ile: YYYY-MM-DDTHH:MM:SS+03:00 (örnek: 2026-03-05T14:00:00+03:00). Timezone suffix (+03:00) ZORUNLUDUR, eksik bırakma.",
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
        name: "create_appointments_batch",
        description:
          "Birden fazla hizmet için tek personel ve tek başlangıç saatine göre ardışık randevuları atomik biçimde oluşturur.",
        parameters: {
          type: "object",
          properties: {
            service_names: {
              type: "array",
              items: { type: "string" },
              description: "Hizmet isimleri listesi (sıraya göre uygulanır)",
            },
            date: {
              type: "string",
              description: "Tarih (YYYY-MM-DD)",
            },
            start_time: {
              type: "string",
              description: "Başlangıç saati (HH:MM)",
            },
            staff_id: {
              type: "string",
              description: "Personel ID (opsiyonel)",
            },
            staff_name: {
              type: "string",
              description: "Personel adı (staff_id yoksa kullanılabilir)",
            },
            customer_name: {
              type: "string",
              description: "Müşteri adı (opsiyonel)",
            },
            require_atomic: {
              type: "boolean",
              description: "Varsayılan true. Bir adım hata verirse tamamını geri al.",
            },
          },
          required: ["service_names", "date", "start_time"],
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
        name: "suggest_least_busy_staff",
        description:
          "Hizmet ve tarih için, son 30 günde en az randevu almış uygun personeli önerir.",
        parameters: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "Tarih (YYYY-MM-DD formatında)",
            },
            service_id: {
              type: "string",
              description: "Hizmet ID",
            },
          },
          required: ["date", "service_id"],
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
    {
      type: "function",
      function: {
        name: "take_notes_for_user",
        description:
          "Müşteri hakkında önemli bilgileri not olarak kaydeder. Bir sonraki oturumda bu notlar agent'a sunulur. Personel tercihi, hizmet tercihi, özel istekler gibi bilgiler için kullan.",
        parameters: {
          type: "object",
          properties: {
            note: {
              type: "string",
              description: "Kaydedilecek not içeriği (Türkçe)",
            },
          },
          required: ["note"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_customer_name",
        description:
          "Müşterinin kayıtlı adını ve/veya soyadını günceller. Müşteri adının yanlış olduğunu söylediğinde, adını/soyadını bildirmek istediğinde ya da daha önce kaydedilmemiş ad bilgisi eklemek istediğinde kullan. Her iki alan da opsiyoneldir; sadece değiştirilmek istenen kısmı gönder.",
        parameters: {
          type: "object",
          properties: {
            first_name: {
              type: "string",
              description: "Müşterinin yeni adı (opsiyonel, sadece ad değişiyorsa gönder)",
            },
            last_name: {
              type: "string",
              description: "Müşterinin yeni soyadı (opsiyonel, sadece soyad değişiyorsa gönder)",
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "compose_interactive_message",
        description:
          "WhatsApp interaktif liste veya buton mesajı üretir. Dönüşte renderedMessage alanını aynen kullanıcıya ilet.",
        parameters: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: ["buttons", "list"],
              description: "Mesaj türü",
            },
            body: {
              type: "string",
              description: "Mesaj gövde metni",
            },
            buttons: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                },
                required: ["id", "title"],
              },
              description: "kind=buttons için butonlar (max 3)",
            },
            button_text: {
              type: "string",
              description: "kind=list için açılır liste buton yazısı",
            },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  rows: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["id", "title"],
                    },
                  },
                },
                required: ["title", "rows"],
              },
              description: "kind=list için bölüm ve satırlar",
            },
          },
          required: ["kind", "body"],
        },
      },
    },
  ];
}
