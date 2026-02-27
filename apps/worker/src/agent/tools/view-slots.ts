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
    const fallbackResult = await manualSlotQuery(ctx.tenantId, date, serviceId, staffId);
    return attachRecommendedSlots(fallbackResult);
  }

  const slots = (await response.json()) as unknown;
  return attachRecommendedSlots({ date, slots });
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
): Promise<Record<string, unknown>> {
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
  const whJson = whRes.ok ? await whRes.json() : [];
  const workingHours: Array<{ staff_id: string; start_time: string; end_time: string }> =
    Array.isArray(whJson) ? whJson : [];

  if (workingHours.length === 0) {
    return { date, availableSlots: [], recommendedSlots: [], reason: "Çalışma saati tanımlı değil" };
  }

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
  const apptJson = apptRes.ok ? await apptRes.json() : [];
  const appointments: Array<any> = Array.isArray(apptJson) ? apptJson : [];
  
  // Get staff time blocks for this date
  const blockUrl = new URL(`${SUPABASE_CONFIG.url}/rest/v1/staff_time_blocks`);
  blockUrl.searchParams.set("tenant_id", `eq.${tenantId}`);
  blockUrl.searchParams.set(
    "or",
    `(and(start_at.lte.${endOfDay},end_at.gte.${startOfDay}))`
  );
  if (staffId) blockUrl.searchParams.set("staff_id", `eq.${staffId}`);
  blockUrl.searchParams.set("select", "staff_id,start_at,end_at");

  const blockRes = await fetch(blockUrl.toString(), { headers });
  const blockJson = blockRes.ok ? await blockRes.json() : [];
  const blocks: Array<any> = Array.isArray(blockJson) ? blockJson : [];

  // Get services if filtering
  let serviceDuration = 30; // default 30 min
  if (serviceId) {
    const svcUrl = new URL(`${SUPABASE_CONFIG.url}/rest/v1/services`);
    svcUrl.searchParams.set("id", `eq.${serviceId}`);
    svcUrl.searchParams.set("select", "duration_minutes,name");

    const svcRes = await fetch(svcUrl.toString(), { headers });
    const svcJson = svcRes.ok ? await svcRes.json() : [];
    const services = Array.isArray(svcJson) ? svcJson : [];
    if (services[0]) serviceDuration = services[0].duration_minutes || 30;
  }

  // Calculate available slots (15-min increments)
  const available: Array<{
    staffId: string;
    time: string;
  }> = [];
  const staffWorkingWindows = new Map<string, { start: number; end: number }>();

  for (const wh of workingHours) {
    const start = parseTime(wh.start_time);
    const end = parseTime(wh.end_time);
    staffWorkingWindows.set(wh.staff_id, { start, end });

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
        const blockedByTimeBlock = blocks.some(
          (block: any) =>
            block.staff_id === wh.staff_id &&
            new Date(block.start_at) < new Date(`${date}T${formatTime(t + serviceDuration)}:00+03:00`) &&
            new Date(block.end_at) > new Date(slotStart)
        );
        if (blockedByTimeBlock) continue;

        available.push({
          staffId: wh.staff_id,
          time: timeStr,
        });
      }
    }
  }

  const recommendedSlots = calculateSandwichSuggestions(
    available,
    appointments,
    blocks,
    staffWorkingWindows,
    serviceDuration
  );

  return {
    date,
    serviceDurationMinutes: serviceDuration,
    availableSlots: available,
    recommendedSlots,
  };
}

function attachRecommendedSlots(payload: Record<string, unknown>): Record<string, unknown> {
  const recommendedSlots = getTopRecommendedSlots(payload);
  return {
    ...payload,
    recommendedSlots,
  };
}

function getTopRecommendedSlots(payload: Record<string, unknown>): Array<{ staffId?: string; time: string }> {
  const candidates = extractSlotCandidates(payload);
  const seen = new Set<string>();
  const unique: Array<{ staffId?: string; time: string }> = [];

  for (const c of candidates) {
    const key = `${c.staffId || ""}|${c.time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
    if (unique.length >= 6) break;
  }

  return unique;
}

function calculateSandwichSuggestions(
  available: Array<{ staffId: string; time: string }>,
  appointments: Array<any>,
  blocks: Array<any>,
  staffWorkingWindows: Map<string, { start: number; end: number }>,
  durationMinutes: number
): Array<{ staffId: string; time: string }> {
  if (available.length === 0) return [];

  const intervalsByStaff = new Map<string, Array<{ start: number; end: number }>>();
  for (const appt of appointments) {
    if (!appt?.staff_id || !appt?.start_time || !appt?.end_time) continue;
    const start = extractTurkeyMinutes(appt.start_time);
    const end = extractTurkeyMinutes(appt.end_time);
    if (!intervalsByStaff.has(appt.staff_id)) intervalsByStaff.set(appt.staff_id, []);
    intervalsByStaff.get(appt.staff_id)!.push({ start, end });
  }
  for (const block of blocks) {
    if (!block?.staff_id || !block?.start_at || !block?.end_at) continue;
    const start = extractTurkeyMinutes(block.start_at);
    const end = extractTurkeyMinutes(block.end_at);
    if (!intervalsByStaff.has(block.staff_id)) intervalsByStaff.set(block.staff_id, []);
    intervalsByStaff.get(block.staff_id)!.push({ start, end });
  }

  const scored = available.map((slot) => {
    const slotStart = parseTime(slot.time);
    const slotEnd = slotStart + durationMinutes;
    const intervals = intervalsByStaff.get(slot.staffId) || [];
    const window = staffWorkingWindows.get(slot.staffId);
    let score = 0;

    for (const int of intervals) {
      if (slotEnd === int.start) score += 10;
      if (slotStart === int.end) score += 10;
      if (Math.abs(slotEnd - int.start) <= 30) score += 5;
      if (Math.abs(slotStart - int.end) <= 30) score += 5;
    }

    if (window) {
      if (slotStart === window.start) score -= 2;
      if (slotEnd >= window.end - 30) score -= 2;
    }

    return { ...slot, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.time.localeCompare(b.time);
  });

  const positive = scored.filter((s) => s.score > 0).slice(0, 6);
  if (positive.length > 0) return positive.map(({ staffId, time }) => ({ staffId, time }));

  return scored.slice(0, 6).map(({ staffId, time }) => ({ staffId, time }));
}

function extractTurkeyMinutes(iso: string): number {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value || "0");
  return hour * 60 + minute;
}

function extractSlotCandidates(payload: Record<string, unknown>): Array<{ staffId?: string; time: string }> {
  const direct = payload.recommendedSlots;
  if (Array.isArray(direct)) {
    const normalized = normalizeSlotArray(direct);
    if (normalized.length > 0) return normalized;
  }

  const suggested = payload.suggestedSlots;
  if (Array.isArray(suggested)) {
    const normalized = normalizeSlotArray(suggested);
    if (normalized.length > 0) return normalized;
  }

  const slots = payload.slots;
  if (Array.isArray(slots)) {
    const normalized = normalizeSlotArray(slots);
    if (normalized.length > 0) return normalized;
  }

  const available = payload.availableSlots;
  if (Array.isArray(available)) {
    const normalized = normalizeSlotArray(available);
    if (normalized.length > 0) return normalized;
  }

  return [];
}

function normalizeSlotArray(items: unknown[]): Array<{ staffId?: string; time: string }> {
  const normalized: Array<{ staffId?: string; time: string }> = [];

  for (const item of items) {
    if (typeof item === "string" && /^\d{2}:\d{2}$/.test(item)) {
      normalized.push({ time: item });
      continue;
    }

    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const time =
      (typeof row.time === "string" && row.time) ||
      (typeof row.slot_time === "string" && row.slot_time) ||
      (typeof row.start_time === "string" && row.start_time.slice(11, 16)) ||
      "";

    if (!/^\d{2}:\d{2}$/.test(time)) continue;
    const staffId =
      (typeof row.staffId === "string" && row.staffId) ||
      (typeof row.staff_id === "string" && row.staff_id) ||
      undefined;

    normalized.push({ staffId, time });
  }

  return normalized.sort((a, b) => a.time.localeCompare(b.time));
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
