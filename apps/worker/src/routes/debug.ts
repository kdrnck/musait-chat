import { Router, type Request, type Response } from "express";
import { SUPABASE_CONFIG } from "../config.js";

/**
 * /debug/booking — Randevu slot hesaplama debug endpoint'i.
 *
 * Her Supabase sorgusunu ve ara hesaplama adımını açık şekilde döndürür.
 * Bu sayede neden slotların "dolu" göründüğünü tespit edebilirsiniz.
 *
 * Kullanım:
 *   GET /debug/booking?tenant_id=...&staff_id=...&service_id=...&date=2026-03-05
 *
 * Korunma: DEBUG_SECRET env değişkeni tanımlanmışsa ?secret=... parametresi zorunludur.
 */
export function createDebugRouter(): Router {
  const router = Router();

  router.get("/booking", async (req: Request, res: Response) => {
    // Optional secret guard
    const debugSecret = process.env.DEBUG_SECRET;
    if (debugSecret && req.query.secret !== debugSecret) {
      res.status(401).json({ error: "Unauthorized. Pass ?secret=<DEBUG_SECRET>" });
      return;
    }

    const { tenant_id, staff_id, service_id, date } = req.query as Record<string, string>;

    if (!tenant_id || !staff_id || !date) {
      res.status(400).json({
        error: "Zorunlu parametreler: tenant_id, staff_id, date (YYYY-MM-DD). service_id opsiyonel.",
        example: "/debug/booking?tenant_id=X&staff_id=Y&service_id=Z&date=2026-03-05",
      });
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "date formatı YYYY-MM-DD olmalı" });
      return;
    }

    const report = await runBookingDebug({ tenant_id, staff_id, service_id, date });
    res.json(report);
  });

  /**
   * /debug/slots — view_available_slots tool'unun yaptığı sorguların debug'u
   * (manualSlotQuery path'ini takip eder)
   */
  router.get("/slots", async (req: Request, res: Response) => {
    const debugSecret = process.env.DEBUG_SECRET;
    if (debugSecret && req.query.secret !== debugSecret) {
      res.status(401).json({ error: "Unauthorized. Pass ?secret=<DEBUG_SECRET>" });
      return;
    }

    const { tenant_id, staff_id, service_id, date } = req.query as Record<string, string>;

    if (!tenant_id || !date) {
      res.status(400).json({
        error: "Zorunlu parametreler: tenant_id, date. staff_id ve service_id opsiyonel.",
        example: "/debug/slots?tenant_id=X&staff_id=Y&service_id=Z&date=2026-03-05",
      });
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "date formatı YYYY-MM-DD olmalı" });
      return;
    }

    const report = await runSlotsDebug({ tenant_id, staff_id, service_id, date });
    res.json(report);
  });

  return router;
}

// ─── booking-flow.ts getAvailabilityForDate debug path ──────────────────────

async function runBookingDebug(args: {
  tenant_id: string;
  staff_id: string;
  service_id?: string;
  date: string;
}): Promise<Record<string, unknown>> {
  const TURKEY_TIMEZONE = "Europe/Istanbul";
  const headers = {
    apikey: SUPABASE_CONFIG.serviceKey,
    Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
  };

  const dateObj = new Date(`${args.date}T00:00:00+03:00`);
  const dayOfWeek = dateObj.getDay();
  const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const dayStart = `${args.date}T00:00:00+03:00`;
  const dayEnd = `${args.date}T23:59:59+03:00`;

  const step: Record<string, unknown> = {
    input: { ...args, dayOfWeek, dayName: dayNames[dayOfWeek] },
    urls: {},
    rawResponses: {},
    httpStatuses: {},
    errors: [],
    parsed: {},
    slotCalculation: {},
    finalResult: {},
  };
  const urls = step.urls as Record<string, string>;
  const rawResponses = step.rawResponses as Record<string, unknown>;
  const httpStatuses = step.httpStatuses as Record<string, number>;
  const errors = step.errors as string[];
  const parsed = step.parsed as Record<string, unknown>;

  // ── 1. tenant_working_hours ──────────────────────────────────────────────
  const tenantWhUrl = `${SUPABASE_CONFIG.url}/rest/v1/tenant_working_hours?tenant_id=eq.${args.tenant_id}&select=day_of_week,start_time,end_time,is_closed`;
  urls.tenantWorkingHours = tenantWhUrl;

  let tenantWH: any[] = [];
  try {
    const r = await fetch(tenantWhUrl, { headers });
    httpStatuses.tenantWorkingHours = r.status;
    const body = await r.json();
    rawResponses.tenantWorkingHours = body;
    tenantWH = Array.isArray(body) ? body : [];
  } catch (e: any) {
    errors.push(`tenantWorkingHours fetch failed: ${e.message}`);
  }

  // ── 2. staff_working_hours ───────────────────────────────────────────────
  const staffWhUrl = `${SUPABASE_CONFIG.url}/rest/v1/staff_working_hours?staff_id=eq.${args.staff_id}&select=day_of_week,start_time,end_time,is_off`;
  urls.staffWorkingHours = staffWhUrl;

  let staffWH: any[] = [];
  try {
    const r = await fetch(staffWhUrl, { headers });
    httpStatuses.staffWorkingHours = r.status;
    const body = await r.json();
    rawResponses.staffWorkingHours = body;
    staffWH = Array.isArray(body) ? body : [];
  } catch (e: any) {
    errors.push(`staffWorkingHours fetch failed: ${e.message}`);
  }

  // ── 3. appointments (CRITICAL — date filter encoding test) ───────────────
  const apptUrlRaw = `${SUPABASE_CONFIG.url}/rest/v1/appointments?staff_id=eq.${args.staff_id}&start_time=gte.${encodeURIComponent(dayStart)}&start_time=lte.${encodeURIComponent(dayEnd)}&status=in.(booked,confirmed,completed,upcoming)&select=start_time,end_time,status`;
  urls.appointments = apptUrlRaw;
  urls.appointmentsDecoded = decodeURIComponent(apptUrlRaw); // For readability

  let appointments: any[] = [];
  let apptHttpStatus = 0;
  try {
    const r = await fetch(apptUrlRaw, { headers });
    apptHttpStatus = r.status;
    httpStatuses.appointments = r.status;
    const body = await r.json();
    rawResponses.appointments = body;
    appointments = Array.isArray(body) ? body : [];
  } catch (e: any) {
    errors.push(`appointments fetch failed: ${e.message}`);
  }

  // Also test without status filter to see ALL appointments for the day
  const apptAllUrl = `${SUPABASE_CONFIG.url}/rest/v1/appointments?staff_id=eq.${args.staff_id}&start_time=gte.${encodeURIComponent(dayStart)}&start_time=lte.${encodeURIComponent(dayEnd)}&select=start_time,end_time,status`;
  urls.appointmentsAllStatuses = apptAllUrl;
  try {
    const r = await fetch(apptAllUrl, { headers });
    httpStatuses.appointmentsAllStatuses = r.status;
    const body = await r.json();
    rawResponses.appointmentsAllStatuses = body;
  } catch (e: any) {
    errors.push(`appointmentsAllStatuses fetch failed: ${e.message}`);
  }

  // ── 4. staff_time_blocks ─────────────────────────────────────────────────
  const blockUrl = `${SUPABASE_CONFIG.url}/rest/v1/staff_time_blocks?staff_id=eq.${args.staff_id}&or=${encodeURIComponent(`(and(start_at.lte.${dayEnd},end_at.gte.${dayStart}))`)}&select=start_at,end_at`;
  urls.timeBlocks = blockUrl;

  let blocks: any[] = [];
  try {
    const r = await fetch(blockUrl, { headers });
    httpStatuses.timeBlocks = r.status;
    const body = await r.json();
    rawResponses.timeBlocks = body;
    blocks = Array.isArray(body) ? body : [];
  } catch (e: any) {
    errors.push(`timeBlocks fetch failed: ${e.message}`);
  }

  // ── 5. service duration (if service_id provided) ─────────────────────────
  let serviceDuration = 30;
  if (args.service_id) {
    const svcUrl = `${SUPABASE_CONFIG.url}/rest/v1/services?id=eq.${args.service_id}&select=id,name,duration_minutes`;
    urls.service = svcUrl;
    try {
      const r = await fetch(svcUrl, { headers });
      httpStatuses.service = r.status;
      const body = await r.json();
      rawResponses.service = body;
      if (Array.isArray(body) && body[0]) {
        serviceDuration = body[0].duration_minutes || 30;
      }
    } catch (e: any) {
      errors.push(`service fetch failed: ${e.message}`);
    }
  }

  // ── 6. Parse working hours ───────────────────────────────────────────────
  const tenantDay = tenantWH.find((h: any) => h.day_of_week === dayOfWeek && !h.is_closed);
  const staffDay = staffWH.find((h: any) => h.day_of_week === dayOfWeek && !h.is_off);

  parsed.tenantDayRecord = tenantDay ?? null;
  parsed.staffDayRecord = staffDay ?? null;

  if (!tenantDay) errors.push(`⚠️ tenant_working_hours: ${dayNames[dayOfWeek]} için kayıt yok veya is_closed=true`);
  if (!staffDay) errors.push(`⚠️ staff_working_hours: ${dayNames[dayOfWeek]} için kayıt yok veya is_off=true`);

  if (!tenantDay || !staffDay) {
    step.finalResult = { availableTimes: [], reason: "Çalışma saati bulunamadı" };
    return step;
  }

  function timeToMinutes(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
  function minutesToTime(m: number) { return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }
  function isoToTurkeyMinutes(iso: string) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: TURKEY_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
    return Number(parts.find(p => p.type === "hour")?.value || 0) * 60 + Number(parts.find(p => p.type === "minute")?.value || 0);
  }

  const workStart = Math.max(timeToMinutes(tenantDay.start_time), timeToMinutes(staffDay.start_time));
  const workEnd = Math.min(timeToMinutes(tenantDay.end_time), timeToMinutes(staffDay.end_time));

  parsed.effectiveWorkStart = minutesToTime(workStart);
  parsed.effectiveWorkEnd = minutesToTime(workEnd);
  parsed.serviceDurationMinutes = serviceDuration;

  const intervals = [
    ...appointments
      .filter((a: any) => a.status !== "cancelled" && a.status !== "no_show")
      .map((a: any) => ({
        source: "appointment",
        status: a.status,
        startIso: a.start_time,
        endIso: a.end_time,
        startMin: isoToTurkeyMinutes(a.start_time),
        endMin: a.end_time ? isoToTurkeyMinutes(a.end_time) : isoToTurkeyMinutes(a.start_time),
        startFormatted: minutesToTime(isoToTurkeyMinutes(a.start_time)),
        endFormatted: a.end_time ? minutesToTime(isoToTurkeyMinutes(a.end_time)) : "(end_time=null)",
      })),
    ...blocks.map((b: any) => ({
      source: "time_block",
      startIso: b.start_at,
      endIso: b.end_at,
      startMin: isoToTurkeyMinutes(b.start_at),
      endMin: isoToTurkeyMinutes(b.end_at),
      startFormatted: minutesToTime(isoToTurkeyMinutes(b.start_at)),
      endFormatted: minutesToTime(isoToTurkeyMinutes(b.end_at)),
    })),
  ];
  parsed.blockedIntervals = intervals;

  // ── 7. Slot calculation (same logic as getAvailabilityForDate) ───────────
  const slotCalc = step.slotCalculation as Record<string, unknown>;
  const availableTimes: string[] = [];
  const blockedTimes: Array<{ time: string; blockedBy: unknown }> = [];

  for (let start = workStart; start + serviceDuration <= workEnd; start += 15) {
    const end = start + serviceDuration;
    const slotStart = minutesToTime(start);
    const slotEnd = minutesToTime(end);
    const conflictingInterval = intervals.find(
      (int: any) => start < int.endMin && end > int.startMin
    );
    if (conflictingInterval) {
      blockedTimes.push({ time: slotStart, blockedBy: conflictingInterval });
    } else {
      availableTimes.push(slotStart);
    }
  }

  slotCalc.totalSlotsCandidates = Math.floor((workEnd - workStart - serviceDuration) / 15) + 1;
  slotCalc.availableCount = availableTimes.length;
  slotCalc.blockedCount = blockedTimes.length;
  slotCalc.availableTimes = availableTimes;
  slotCalc.blockedTimes = blockedTimes;

  step.finalResult = {
    availableTimes,
    blockedTimes,
    summary: availableTimes.length === 0
      ? "❌ SORUN: Hiç müsait saat yok! Yukarıdaki blocked intervals veya working hours sorununa bakın."
      : `✅ ${availableTimes.length} müsait saat bulundu`,
  };

  return step;
}

// ─── view-slots.ts manualSlotQuery debug path ───────────────────────────────

async function runSlotsDebug(args: {
  tenant_id: string;
  staff_id?: string;
  service_id?: string;
  date: string;
}): Promise<Record<string, unknown>> {
  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_CONFIG.serviceKey,
    Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
  };

  const [year, month, day] = args.date.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  const dayOfWeek = localDate.getDay();
  const startOfDay = `${args.date}T00:00:00+03:00`;
  const endOfDay = `${args.date}T23:59:59+03:00`;

  const step: Record<string, unknown> = {
    input: { ...args, dayOfWeek },
    urls: {},
    rawResponses: {},
    httpStatuses: {},
    errors: [],
  };
  const urls = step.urls as Record<string, string>;
  const rawResponses = step.rawResponses as Record<string, unknown>;
  const httpStatuses = step.httpStatuses as Record<string, number>;
  const errors = step.errors as string[];

  // ── working hours (same as manualSlotQuery) ──────────────────────────────
  const whUrl = new URL(`${SUPABASE_CONFIG.url}/rest/v1/staff_working_hours`);
  whUrl.searchParams.set("tenant_id", `eq.${args.tenant_id}`);
  whUrl.searchParams.set("day_of_week", `eq.${dayOfWeek}`);
  whUrl.searchParams.set("is_off", "eq.false");
  if (args.staff_id) whUrl.searchParams.set("staff_id", `eq.${args.staff_id}`);
  whUrl.searchParams.set("select", "staff_id,start_time,end_time");
  urls.staffWorkingHours = whUrl.toString();
  urls.staffWorkingHoursDecoded = decodeURIComponent(whUrl.toString());

  try {
    const r = await fetch(whUrl.toString(), { headers });
    httpStatuses.staffWorkingHours = r.status;
    rawResponses.staffWorkingHours = await r.json();
  } catch (e: any) {
    errors.push(`staffWorkingHours: ${e.message}`);
  }

  // ── appointments (URLSearchParams `and` filter — potential encoding issue) ──
  const apptUrl = new URL(`${SUPABASE_CONFIG.url}/rest/v1/appointments`);
  apptUrl.searchParams.set("tenant_id", `eq.${args.tenant_id}`);
  apptUrl.searchParams.set("and", `(start_time.gte.${startOfDay},start_time.lt.${endOfDay})`);
  apptUrl.searchParams.set("status", "in.(booked,upcoming)");
  apptUrl.searchParams.set("select", "staff_id,start_time,end_time");
  if (args.staff_id) apptUrl.searchParams.set("staff_id", `eq.${args.staff_id}`);

  urls.appointmentsViaAnd = apptUrl.toString();
  urls.appointmentsViaAndDecoded = decodeURIComponent(apptUrl.toString());

  // Also test the ALTERNATIVE approach (plain gte/lte params — more reliable)
  const apptUrlAlt = new URL(`${SUPABASE_CONFIG.url}/rest/v1/appointments`);
  apptUrlAlt.searchParams.set("tenant_id", `eq.${args.tenant_id}`);
  apptUrlAlt.searchParams.set("start_time", `gte.${startOfDay}`);
  apptUrlAlt.searchParams.set("start_time", `lte.${endOfDay}`); // NOTE: overwrites gte!
  apptUrlAlt.searchParams.set("status", "in.(booked,upcoming)");
  apptUrlAlt.searchParams.set("select", "staff_id,start_time,end_time");
  urls.appointmentsViaGteLte = apptUrlAlt.toString();
  urls.note_gteLte = "⚠️ URLSearchParams.set() ile iki kez start_time set edilirse ikinci yazılır, birinci silinir!";

  // Template literal URL (no encoding issue for gte/lte)
  const apptUrlTemplate = `${SUPABASE_CONFIG.url}/rest/v1/appointments?tenant_id=eq.${args.tenant_id}&start_time=gte.${encodeURIComponent(startOfDay)}&start_time=lte.${encodeURIComponent(endOfDay)}&status=in.(booked,upcoming)&select=staff_id,start_time,end_time${args.staff_id ? `&staff_id=eq.${args.staff_id}` : ""}`;
  urls.appointmentsViaTemplateLiteral = apptUrlTemplate;

  try {
    const r = await fetch(apptUrl.toString(), { headers });
    httpStatuses.appointmentsViaAnd = r.status;
    rawResponses.appointmentsViaAnd = await r.json();
  } catch (e: any) {
    errors.push(`appointmentsViaAnd: ${e.message}`);
  }

  try {
    const r = await fetch(apptUrlTemplate, { headers });
    httpStatuses.appointmentsViaTemplateLiteral = r.status;
    rawResponses.appointmentsViaTemplateLiteral = await r.json();
  } catch (e: any) {
    errors.push(`appointmentsViaTemplateLiteral: ${e.message}`);
  }

  // ── time blocks ──────────────────────────────────────────────────────────
  const blockUrl = new URL(`${SUPABASE_CONFIG.url}/rest/v1/staff_time_blocks`);
  blockUrl.searchParams.set("tenant_id", `eq.${args.tenant_id}`);
  blockUrl.searchParams.set("or", `(and(start_at.lte.${endOfDay},end_at.gte.${startOfDay}))`);
  if (args.staff_id) blockUrl.searchParams.set("staff_id", `eq.${args.staff_id}`);
  blockUrl.searchParams.set("select", "staff_id,start_at,end_at");
  urls.timeBlocks = blockUrl.toString();
  urls.timeBlocksDecoded = decodeURIComponent(blockUrl.toString());

  try {
    const r = await fetch(blockUrl.toString(), { headers });
    httpStatuses.timeBlocks = r.status;
    rawResponses.timeBlocks = await r.json();
  } catch (e: any) {
    errors.push(`timeBlocks: ${e.message}`);
  }

  // ── service duration ─────────────────────────────────────────────────────
  if (args.service_id) {
    const svcUrl = new URL(`${SUPABASE_CONFIG.url}/rest/v1/services`);
    svcUrl.searchParams.set("id", `eq.${args.service_id}`);
    svcUrl.searchParams.set("select", "id,name,duration_minutes");
    urls.service = svcUrl.toString();
    try {
      const r = await fetch(svcUrl.toString(), { headers });
      httpStatuses.service = r.status;
      rawResponses.service = await r.json();
    } catch (e: any) {
      errors.push(`service: ${e.message}`);
    }
  }

  step.analysis = {
    note: "appointmentsViaAnd ile appointmentsViaTemplateLiteral sonuçlarını karşılaştırın. " +
          "Eğer farklıysa, URLSearchParams `and` parametresi encoding hatası var demektir.",
  };

  return step;
}
