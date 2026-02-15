import { SUPABASE_CONFIG } from "../../config.js";

interface ToolContext {
  tenantId: string;
  conversationId: string;
  customerPhone: string;
}

/**
 * view_available_slots - Query Supabase for available appointment slots.
 *
 * This queries:
 * - staff_working_hours for the given date's day_of_week
 * - existing appointments to find occupied slots
 * - staff_time_blocks for blocked periods
 * - services for duration info
 *
 * Returns available time slots grouped by staff.
 */
export async function viewAvailableSlots(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const date = args.date as string;
  const serviceId = args.service_id as string | undefined;
  const staffId = args.staff_id as string | undefined;

  if (!date) {
    return { error: "Tarih belirtilmedi" };
  }

  // Call Supabase via service role to get availability
  // This uses the same logic as musait.app's availability calculation
  const response = await fetch(
    `${SUPABASE_CONFIG.url}/rest/v1/rpc/get_available_slots`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_CONFIG.serviceKey,
        Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
      },
      body: JSON.stringify({
        p_tenant_id: ctx.tenantId,
        p_date: date,
        ...(serviceId ? { p_service_id: serviceId } : {}),
        ...(staffId ? { p_staff_id: staffId } : {}),
      }),
    }
  );

  if (!response.ok) {
    // Fallback: manual slot calculation if RPC doesn't exist
    return await manualSlotQuery(ctx.tenantId, date, serviceId, staffId);
  }

  const slots = await response.json();
  return { date, slots };
}

/**
 * Fallback: Manually calculate available slots from raw tables.
 * Used if the RPC function doesn't exist yet.
 */
async function manualSlotQuery(
  tenantId: string,
  date: string,
  serviceId?: string,
  staffId?: string
): Promise<unknown> {
  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_CONFIG.serviceKey,
    Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
  };

  const dayOfWeek = new Date(date).getDay(); // 0=Sunday

  // Get working hours for this day
  const whUrl = new URL(
    `${SUPABASE_CONFIG.url}/rest/v1/staff_working_hours`
  );
  whUrl.searchParams.set("tenant_id", `eq.${tenantId}`);
  whUrl.searchParams.set("day_of_week", `eq.${dayOfWeek}`);
  whUrl.searchParams.set("is_off", "eq.false");
  if (staffId) whUrl.searchParams.set("staff_id", `eq.${staffId}`);
  whUrl.searchParams.set("select", "staff_id,start_time,end_time");

  const whRes = await fetch(whUrl.toString(), { headers });
  const workingHours = await whRes.json();

  // Get existing appointments for this date
  const startOfDay = `${date}T00:00:00+03:00`;
  const endOfDay = `${date}T23:59:59+03:00`;

  const apptUrl = new URL(`${SUPABASE_CONFIG.url}/rest/v1/appointments`);
  apptUrl.searchParams.set("tenant_id", `eq.${tenantId}`);
  apptUrl.searchParams.set("start_time", `gte.${startOfDay}`);
  apptUrl.searchParams.set("start_time", `lt.${endOfDay}`);
  apptUrl.searchParams.set("status", "in.(booked,upcoming)");
  apptUrl.searchParams.set("select", "staff_id,start_time,end_time");

  const apptRes = await fetch(apptUrl.toString(), { headers });
  const appointments = await apptRes.json();

  // Get services if filtering
  let serviceDuration = 30; // default 30 min
  if (serviceId) {
    const svcUrl = new URL(`${SUPABASE_CONFIG.url}/rest/v1/services`);
    svcUrl.searchParams.set("id", `eq.${serviceId}`);
    svcUrl.searchParams.set("select", "duration_minutes,name");

    const svcRes = await fetch(svcUrl.toString(), { headers });
    const services = await svcRes.json();
    if (services[0]) serviceDuration = services[0].duration_minutes || 30;
  }

  // Calculate available slots (15-min increments)
  const available: Array<{
    staffId: string;
    time: string;
  }> = [];

  for (const wh of workingHours) {
    const start = parseTime(wh.start_time);
    const end = parseTime(wh.end_time);

    for (let t = start; t + serviceDuration <= end; t += 15) {
      const timeStr = formatTime(t);
      const slotStart = `${date}T${timeStr}:00+03:00`;

      // Check if slot conflicts with existing appointment
      const hasConflict = appointments.some(
        (appt: any) =>
          appt.staff_id === wh.staff_id &&
          new Date(appt.start_time) < new Date(`${date}T${formatTime(t + serviceDuration)}:00+03:00`) &&
          new Date(appt.end_time || appt.start_time) > new Date(slotStart)
      );

      if (!hasConflict) {
        available.push({
          staffId: wh.staff_id,
          time: timeStr,
        });
      }
    }
  }

  return {
    date,
    serviceDurationMinutes: serviceDuration,
    availableSlots: available,
  };
}

function parseTime(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
