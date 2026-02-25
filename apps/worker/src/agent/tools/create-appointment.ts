import { SUPABASE_CONFIG } from "../../config.js";
import {
  createCustomer,
  getCustomerByPhone,
  updateCustomerName,
} from "../../services/customers.js";

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
  const serviceId = args.service_id as string;
  const staffId = args.staff_id as string;
  const startTime = args.start_time as string;
  const customerName =
    (args.customer_name as string | undefined)?.trim() || ctx.customerName;

  if (!serviceId || !staffId || !startTime) {
    return { error: "Hizmet, personel ve başlangıç zamanı gereklidir." };
  }

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
    return { error: "Randevu oluşturulamadı. Lütfen tekrar deneyin." };
  }

  const appointment = await apptRes.json();

  return {
    success: true,
    appointmentId: appointment[0]?.id,
    serviceName: service.name,
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
    message: `Randevunuz başarıyla oluşturuldu: ${service.name}, ${startDate.toLocaleDateString("tr-TR")} ${startDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
  };
}
