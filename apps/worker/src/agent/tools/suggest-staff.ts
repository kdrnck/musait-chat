import { SUPABASE_CONFIG } from "../../config.js";

interface ToolContext {
  tenantId: string;
}

/**
 * suggest_least_busy_staff
 * Returns least-booked staff candidates for a given day + service.
 * Uses the last 30 days booking counts as the balancing metric.
 */
export async function suggestLeastBusyStaff(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const date = args.date as string;
  const serviceId = args.service_id as string;

  if (!date || !serviceId) {
    return { error: "Tarih ve hizmet bilgisi zorunludur." };
  }

  const response = await fetch(
    `${SUPABASE_CONFIG.url}/rest/v1/rpc/get_least_booked_staff_for_service_on_date`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_CONFIG.serviceKey,
        Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
      },
      body: JSON.stringify({
        p_tenant_id: ctx.tenantId,
        p_service_id: serviceId,
        p_date: date,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    return {
      error: "Personel önerisi alınamadı.",
      details: body.slice(0, 400),
    };
  }

  const rows = (await response.json()) as Array<{
    staff_id: string;
    staff_name: string;
    appointments_last_30d: number;
    rank_order: number;
  }>;

  const primary = rows[0] || null;
  return {
    date,
    serviceId,
    recommendedStaff: primary,
    alternatives: rows.slice(1, 4),
    candidates: rows,
  };
}
