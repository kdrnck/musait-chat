import { SUPABASE_CONFIG } from "../../config.js";

interface ToolContext {
  tenantId: string;
  conversationId: string;
  customerPhone: string;
}

/**
 * cancel_appointment - Cancels an existing appointment.
 * Enforces tenant isolation: only appointments belonging to ctx.tenantId can be cancelled.
 */
export async function cancelAppointment(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const appointmentId = args.appointment_id as string;
  const reason = args.reason as string | undefined;

  if (!appointmentId) {
    return { error: "Randevu ID gereklidir." };
  }

  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_CONFIG.serviceKey,
    Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
    Prefer: "return=representation",
  };

  // 1. Verify appointment exists and belongs to this tenant
  const checkUrl = new URL(`${SUPABASE_CONFIG.url}/rest/v1/appointments`);
  checkUrl.searchParams.set("id", `eq.${appointmentId}`);
  checkUrl.searchParams.set("tenant_id", `eq.${ctx.tenantId}`);
  checkUrl.searchParams.set("select", "id,status,start_time,service_id");

  const checkRes = await fetch(checkUrl.toString(), { headers });
  const appointments = await checkRes.json();

  if (appointments.length === 0) {
    return { error: "Randevu bulunamadı veya bu işletmeye ait değil." };
  }

  const appointment = appointments[0];

  if (appointment.status === "cancelled") {
    return { error: "Bu randevu zaten iptal edilmiş." };
  }

  // 2. Cancel the appointment
  const cancelRes = await fetch(
    `${SUPABASE_CONFIG.url}/rest/v1/appointments?id=eq.${appointmentId}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        status: "cancelled",
        notes: reason
          ? `WhatsApp iptal: ${reason}`
          : `WhatsApp üzerinden iptal edildi (${ctx.customerPhone})`,
      }),
    }
  );

  if (!cancelRes.ok) {
    return { error: "Randevu iptal edilemedi. Lütfen tekrar deneyin." };
  }

  return {
    success: true,
    appointmentId,
    message: "Randevunuz başarıyla iptal edildi.",
  };
}
