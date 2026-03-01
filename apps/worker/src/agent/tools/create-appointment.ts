import { SUPABASE_CONFIG } from "../../config.js";
import {
  createCustomer,
  getCustomerByPhone,
  updateCustomerName,
} from "../../services/customers.js";
import { validateToolArgs, CREATE_APPOINTMENT_FIELDS } from "./validate.js";

interface ToolContext {
  tenantId: string;
  conversationId: string;
  customerPhone: string;
  customerName?: string;
}

/**
 * create_appointment - Creates a new appointment via Supabase.
 *
 * IMPORTANT: Agent MUST get explicit customer confirmation before calling this.
 * The confirmation flow is enforced in the system prompt.
 */
export async function createAppointment(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const validation = validateToolArgs(args, CREATE_APPOINTMENT_FIELDS);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const serviceId = validation.data.service_id as string;
  const staffId = validation.data.staff_id as string;
  const startTime = validation.data.start_time as string;
  const customerName =
    (validation.data.customer_name as string | undefined)?.trim() || ctx.customerName;

  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_CONFIG.serviceKey,
    Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
    Prefer: "return=representation",
  };

  // 1. Find or create customer by phone
  const existingCustomer = await getCustomerByPhone(ctx.tenantId, ctx.customerPhone);
  let customerId: string;

  if (existingCustomer) {
    customerId = existingCustomer.id;

    if (!existingCustomer.name && !customerName) {
      return {
        error:
          "Randevuyu tamamlamadan önce adınızı ekleyebilir miyim? Adınızı paylaşır mısınız?",
        code: "missing_customer_name",
      };
    }

    if (
      customerName &&
      (!existingCustomer.name ||
        existingCustomer.name.toLocaleLowerCase("tr-TR") !==
          customerName.toLocaleLowerCase("tr-TR"))
    ) {
      await updateCustomerName(existingCustomer.id, customerName);
    }
  } else {
    if (!customerName) {
      return {
        error:
          "Randevuyu tamamlamadan önce adınızı ekleyebilir miyim? Adınızı paylaşır mısınız?",
        code: "missing_customer_name",
      };
    }

    const created = await createCustomer(
      ctx.tenantId,
      ctx.customerPhone,
      customerName
    );
    if (!created) {
      return { error: "Müşteri kaydı oluşturulamadı." };
    }
    customerId = created.id;
  }

  // 2. Get service duration for end_time calculation
  const svcUrl = new URL(`${SUPABASE_CONFIG.url}/rest/v1/services`);
  svcUrl.searchParams.set("id", `eq.${serviceId}`);
  svcUrl.searchParams.set("select", "duration_minutes,name");

  const svcRes = await fetch(svcUrl.toString(), { headers });
  const services = await svcRes.json();
  const service = services[0];

  if (!service) {
    return { error: "Hizmet bulunamadı." };
  }

  const duration = service.duration_minutes || 30;
  const startDate = new Date(startTime);
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  // 3. Create appointment
  const apptRes = await fetch(
    `${SUPABASE_CONFIG.url}/rest/v1/appointments`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        tenant_id: ctx.tenantId,
        service_id: serviceId,
        staff_id: staffId,
        customer_id: customerId,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        status: "booked",
        source: "whatsapp",
        notes: `WhatsApp üzerinden oluşturuldu (${ctx.customerPhone})`,
      }),
    }
  );

  if (!apptRes.ok) {
    const errText = await apptRes.text();
    console.error("Appointment creation failed:", errText);
    
    // Check if error is due to slot conflict (duplicate booking, overlapping appointments, etc.)
    const isSlotConflict = 
      errText.toLowerCase().includes("conflict") ||
      errText.toLowerCase().includes("overlap") ||
      errText.toLowerCase().includes("duplicate") ||
      errText.toLowerCase().includes("already booked") ||
      apptRes.status === 409; // Conflict HTTP status
    
    if (isSlotConflict) {
      return { 
        error: "Bu saat artık dolu görünüyor. Lütfen başka bir saat seçin.",
        code: "slot_taken"
      };
    }
    
    return { error: "Randevu oluşturulamadı. Lütfen tekrar deneyin." };
  }

  const appointment = await apptRes.json();

  // Validate that the appointment was actually created
  if (!Array.isArray(appointment) || appointment.length === 0 || !appointment[0]?.id) {
    console.error("Appointment creation returned empty/invalid response:", JSON.stringify(appointment));
    return { error: "Randevu oluşturulamadı. Sunucu boş yanıt döndü. Lütfen tekrar deneyin." };
  }

  return {
    success: true,
    appointmentId: appointment[0].id,
    serviceName: service.name,
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
    message: `Randevunuz başarıyla oluşturuldu: ${service.name}, ${startDate.toLocaleDateString("tr-TR")} ${startDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
  };
}
