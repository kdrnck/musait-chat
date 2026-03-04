import type { ConvexHttpClient } from "convex/browser";
import type { AgentJob } from "@musait/shared";
import { api } from "../lib/convex-api.js";
import { SUPABASE_CONFIG } from "../config.js";
import { createAppointment } from "./tools/create-appointment.js";
import { BOOKING_FLOW_PROMPTS } from "./prompts/booking-flow-prompts.js";
import { extractPossibleName } from "./customer-name.js";

type FlowStep =
  | "awaiting_service"
  | "awaiting_staff"
  | "awaiting_date"
  | "awaiting_time"
  | "awaiting_customer_name";

interface BookingFlowState {
  version: 1;
  step: FlowStep;
  tenantId: string;
  serviceId?: string;
  serviceName?: string;
  serviceDurationMinutes?: number;
  staffId?: string;
  staffName?: string;
  date?: string; // YYYY-MM-DD
  pendingTime?: string; // HH:mm (used when waiting for customer name)
}

interface BookingServiceOption {
  id: string;
  name: string;
  durationMinutes: number;
  staff: Array<{ id: string; name: string }>;
}

interface BookingFlowResult {
  handled: boolean;
  reply?: string;
}

const FLOW_STATE_MARKER = "__BOOKING_FLOW_STATE__:";
const TURKEY_TIMEZONE = "Europe/Istanbul";

export async function initializeBookingFlow(
  convex: ConvexHttpClient,
  conversationId: string,
  tenantId: string
): Promise<string> {
  const services = await fetchTenantServices(tenantId);
  const serviceList = formatServiceList(services);

  await saveFlowState(convex, conversationId, {
    version: 1,
    step: "awaiting_service",
    tenantId,
  });

  return BOOKING_FLOW_PROMPTS.serviceQuestion(serviceList);
}

export async function handleStructuredBookingFlow(
  convex: ConvexHttpClient,
  job: AgentJob,
  conversation: { _id: string; tenantId: string | null }
): Promise<BookingFlowResult> {
  if (!conversation.tenantId) {
    return { handled: false };
  }

  const text = job.messageContent.trim();
  const normalized = normalizeText(text);

  if (
    normalized.includes("iptal") ||
    normalized.includes("operat") ||
    normalized.includes("yetkili") ||
    normalized.includes("insan")
  ) {
    return { handled: false };
  }

  const services = await fetchTenantServices(conversation.tenantId);
  if (services.length === 0) {
    return { handled: true, reply: "Bu işletme için aktif hizmet bulunamadı." };
  }

  let state = await getLatestFlowState(convex, conversation._id);
  if (!state || state.tenantId !== conversation.tenantId) {
    state = {
      version: 1,
      step: "awaiting_service",
      tenantId: conversation.tenantId,
    };
    await saveFlowState(convex, conversation._id, state);
  }

  if (state.step === "awaiting_service") {
    const selectedService = resolveService(text, services);
    if (!selectedService) {
      return {
        handled: true,
        reply: BOOKING_FLOW_PROMPTS.serviceQuestion(formatServiceList(services)),
      };
    }

    const nextState: BookingFlowState = {
      ...state,
      step: "awaiting_staff",
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      serviceDurationMinutes: selectedService.durationMinutes,
      staffId: undefined,
      staffName: undefined,
      date: undefined,
      pendingTime: undefined,
    };
    await saveFlowState(convex, conversation._id, nextState);

    return {
      handled: true,
      reply: BOOKING_FLOW_PROMPTS.staffQuestion(
        selectedService.name,
        formatStaffList(selectedService.staff)
      ),
    };
  }

  const activeService = services.find((svc) => svc.id === state.serviceId);
  if (!activeService) {
    const resetState: BookingFlowState = {
      version: 1,
      step: "awaiting_service",
      tenantId: conversation.tenantId,
      pendingTime: undefined,
    };
    await saveFlowState(convex, conversation._id, resetState);
    return {
      handled: true,
      reply: BOOKING_FLOW_PROMPTS.serviceQuestion(formatServiceList(services)),
    };
  }

  if (state.step === "awaiting_staff") {
    const selectedStaff = resolveStaff(text, activeService.staff);
    if (!selectedStaff) {
      return {
        handled: true,
        reply: BOOKING_FLOW_PROMPTS.staffQuestion(
          activeService.name,
          formatStaffList(activeService.staff)
        ),
      };
    }

    const nextState: BookingFlowState = {
      ...state,
      step: "awaiting_date",
      serviceId: activeService.id,
      serviceName: activeService.name,
      serviceDurationMinutes: activeService.durationMinutes,
      staffId: selectedStaff.id,
      staffName: selectedStaff.name,
      date: undefined,
      pendingTime: undefined,
    };
    await saveFlowState(convex, conversation._id, nextState);

    return {
      handled: true,
      reply: BOOKING_FLOW_PROMPTS.dateQuestion(activeService.name, selectedStaff.name),
    };
  }

  if (!state.staffId || !state.staffName || !state.serviceDurationMinutes) {
    const resetState: BookingFlowState = {
      version: 1,
      step: "awaiting_service",
      tenantId: conversation.tenantId,
      pendingTime: undefined,
    };
    await saveFlowState(convex, conversation._id, resetState);
    return {
      handled: true,
      reply: BOOKING_FLOW_PROMPTS.serviceQuestion(formatServiceList(services)),
    };
  }

  if (state.step === "awaiting_date") {
    const parsedDate = parseFutureDate(text);
    if (!parsedDate) {
      return { handled: true, reply: BOOKING_FLOW_PROMPTS.dateParseFailed };
    }
    return await buildDateAndSlotsReply(convex, conversation._id, state, parsedDate);
  }

  if (state.step === "awaiting_time") {
    const parsedTime = parseTimeInput(text);
    if (!parsedTime) {
      const maybeDate = parseFutureDate(text);
      if (maybeDate) {
        return await buildDateAndSlotsReply(convex, conversation._id, state, maybeDate);
      }
      const slotsReply = await buildSlotsReminder(state);
      return { handled: true, reply: `${BOOKING_FLOW_PROMPTS.timeParseFailed}\n\n${slotsReply}` };
    }

    const availability = await getAvailabilityForDate({
      tenantId: state.tenantId,
      staffId: state.staffId,
      durationMinutes: state.serviceDurationMinutes,
      date: state.date!,
    });

    if (!availability.availableTimes.includes(parsedTime)) {
      const slots = formatSlotList(availability.suggestedTimes);
      const dateLabel = formatDateLabel(state.date!);
      return {
        handled: true,
        reply:
          `${BOOKING_FLOW_PROMPTS.timeUnavailable}\n\n` +
          BOOKING_FLOW_PROMPTS.timeQuestion(
            state.serviceName!,
            state.staffName,
            dateLabel,
            slots
          ),
      };
    }

    const startTime = `${state.date}T${parsedTime}:00+03:00`;
    const appointmentResult = (await createAppointment(
      {
        service_id: state.serviceId!,
        staff_id: state.staffId,
        start_time: startTime,
        customer_name: job.customerName,
      },
      {
        tenantId: state.tenantId,
        conversationId: conversation._id,
        customerPhone: job.customerPhone,
        customerName: job.customerName,
      }
    )) as { success?: boolean; error?: string; code?: string };

    if (!appointmentResult.success) {
      if ((appointmentResult as any).code === "missing_customer_name") {
        await saveFlowState(convex, conversation._id, {
          ...state,
          step: "awaiting_customer_name",
          pendingTime: parsedTime,
        });
      }
      return {
        handled: true,
        reply:
          appointmentResult.error ||
          "Randevu oluşturulamadı. Lütfen birazdan tekrar deneyin.",
      };
    }

    await saveFlowState(convex, conversation._id, {
      version: 1,
      step: "awaiting_service",
      tenantId: state.tenantId,
      pendingTime: undefined,
    });

    return {
      handled: true,
      reply: BOOKING_FLOW_PROMPTS.bookingSuccess(
        state.serviceName!,
        state.staffName,
        formatDateLabel(state.date!),
        parsedTime,
        job.customerName
      ),
    };
  }

  if (state.step === "awaiting_customer_name") {
    if (!state.date || !state.pendingTime) {
      await saveFlowState(convex, conversation._id, {
        version: 1,
        step: "awaiting_service",
        tenantId: state.tenantId,
        pendingTime: undefined,
      });
      return {
        handled: true,
        reply: BOOKING_FLOW_PROMPTS.serviceQuestion(formatServiceList(services)),
      };
    }

    const parsedName = extractPossibleName(text);
    if (!parsedName) {
      return {
        handled: true,
        reply:
          "Randevuyu tamamlamak için adınızı da ekleyelim. Adınızı yazar mısınız?",
      };
    }

    const startTime = `${state.date}T${state.pendingTime}:00+03:00`;
    const appointmentResult = (await createAppointment(
      {
        service_id: state.serviceId!,
        staff_id: state.staffId,
        start_time: startTime,
        customer_name: parsedName,
      },
      {
        tenantId: state.tenantId,
        conversationId: conversation._id,
        customerPhone: job.customerPhone,
        customerName: parsedName,
      }
    )) as { success?: boolean; error?: string };

    if (!appointmentResult.success) {
      return {
        handled: true,
        reply:
          appointmentResult.error ||
          "Randevu oluşturulamadı. Lütfen birazdan tekrar deneyin.",
      };
    }

    await saveFlowState(convex, conversation._id, {
      version: 1,
      step: "awaiting_service",
      tenantId: state.tenantId,
      pendingTime: undefined,
    });

    return {
      handled: true,
      reply: BOOKING_FLOW_PROMPTS.bookingSuccess(
        state.serviceName!,
        state.staffName!,
        formatDateLabel(state.date),
        state.pendingTime,
        parsedName
      ),
    };
  }

  return { handled: false };
}

async function buildDateAndSlotsReply(
  convex: ConvexHttpClient,
  conversationId: string,
  state: BookingFlowState,
  date: string
): Promise<BookingFlowResult> {
  const availability = await getAvailabilityForDate({
    tenantId: state.tenantId,
    staffId: state.staffId!,
    durationMinutes: state.serviceDurationMinutes!,
    date,
  });

  const dateLabel = formatDateLabel(date);
  if (availability.suggestedTimes.length === 0) {
    await saveFlowState(convex, conversationId, {
      ...state,
      step: "awaiting_date",
      date: undefined,
      pendingTime: undefined,
    });
    return {
      handled: true,
      reply: BOOKING_FLOW_PROMPTS.noSlotsForDate(dateLabel),
    };
  }

  await saveFlowState(convex, conversationId, {
    ...state,
    step: "awaiting_time",
    date,
    pendingTime: undefined,
  });

  return {
    handled: true,
    reply: BOOKING_FLOW_PROMPTS.timeQuestion(
      state.serviceName!,
      state.staffName!,
      dateLabel,
      formatSlotList(availability.suggestedTimes)
    ),
  };
}

async function buildSlotsReminder(state: BookingFlowState): Promise<string> {
  const availability = await getAvailabilityForDate({
    tenantId: state.tenantId,
    staffId: state.staffId!,
    durationMinutes: state.serviceDurationMinutes!,
    date: state.date!,
  });
  const dateLabel = formatDateLabel(state.date!);
  return BOOKING_FLOW_PROMPTS.timeQuestion(
    state.serviceName!,
    state.staffName!,
    dateLabel,
    formatSlotList(availability.suggestedTimes)
  );
}

async function getLatestFlowState(
  convex: ConvexHttpClient,
  conversationId: string
): Promise<BookingFlowState | null> {
  const messages = await convex.query(api.messages.listByConversation, {
    conversationId: conversationId as any,
    limit: 80,
  });

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as any;
    if (msg.role !== "human") continue;
    if (typeof msg.content !== "string") continue;
    if (!msg.content.startsWith(FLOW_STATE_MARKER)) continue;
    const json = msg.content.slice(FLOW_STATE_MARKER.length);
    try {
      return JSON.parse(json) as BookingFlowState;
    } catch {
      continue;
    }
  }

  return null;
}

async function saveFlowState(
  convex: ConvexHttpClient,
  conversationId: string,
  state: BookingFlowState
): Promise<void> {
  await convex.mutation(api.messages.create, {
    conversationId: conversationId as any,
    role: "human",
    content: `${FLOW_STATE_MARKER}${JSON.stringify(state)}`,
    status: "done",
  });
}

async function fetchTenantServices(
  tenantId: string
): Promise<BookingServiceOption[]> {
  const url = new URL(`${SUPABASE_CONFIG.url}/rest/v1/services`);
  url.searchParams.set("tenant_id", `eq.${tenantId}`);
  url.searchParams.set("is_active", "eq.true");
  url.searchParams.set(
    "select",
    "id,name,duration_minutes,duration_blocks,service_staff(staff:staff(id,name,is_active))"
  );
  url.searchParams.set("order", "name.asc");

  const response = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_CONFIG.serviceKey,
      Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
    },
  });

  if (!response.ok) {
    return [];
  }

  const rows = (await response.json()) as Array<any>;
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    durationMinutes:
      s.duration_minutes || (typeof s.duration_blocks === "number"
        ? s.duration_blocks * 15
        : 30),
    staff: (s.service_staff || [])
      .filter((ss: any) => ss.staff?.is_active)
      .map((ss: any) => ({
        id: ss.staff.id,
        name: ss.staff.name,
      })),
  }));
}

function resolveService(
  input: string,
  services: BookingServiceOption[]
): BookingServiceOption | null {
  const byIndex = resolveByIndex(input, services);
  if (byIndex) return byIndex;

  const best = resolveBestMatch(
    input,
    services.map((s) => ({ id: s.id, name: s.name }))
  );
  if (!best) return null;
  return services.find((s) => s.id === best.id) || null;
}

function resolveStaff(
  input: string,
  staff: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  const byIndex = resolveByIndex(input, staff);
  if (byIndex) return byIndex;

  return resolveBestMatch(input, staff);
}

function resolveBestMatch<T extends { id: string; name: string }>(
  input: string,
  options: T[]
): T | null {
  const normalizedInput = normalizeText(input);
  if (!normalizedInput) return null;

  let best: { option: T; score: number } | null = null;

  for (const option of options) {
    const score = scoreMatch(normalizedInput, normalizeText(option.name));
    if (!best || score > best.score) {
      best = { option, score };
    }
  }

  if (!best || best.score < 55) {
    return null;
  }

  return best.option;
}

function scoreMatch(input: string, candidate: string): number {
  if (input === candidate) return 100;
  if (candidate.includes(input)) return 90;
  if (input.includes(candidate)) return 80;

  const inputTokens = input.split(" ").filter(Boolean);
  const candidateTokens = candidate.split(" ").filter(Boolean);

  let score = 0;
  for (const it of inputTokens) {
    for (const ct of candidateTokens) {
      if (it === ct) score = Math.max(score, 85);
      if (ct.startsWith(it) || it.startsWith(ct)) score = Math.max(score, 75);
      if (it.length >= 2 && ct.startsWith(it.slice(0, 2))) {
        score = Math.max(score, 65);
      }
    }
  }

  if (candidate.startsWith(input.slice(0, 2))) {
    score = Math.max(score, 60);
  }

  return score;
}

function normalizeText(input: string): string {
  return input
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveByIndex<T extends { id: string }>(
  input: string,
  options: T[]
): T | null {
  const cleaned = input.trim().replace(/[\[\]().]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const idx = Number(cleaned) - 1;
  if (idx < 0 || idx >= options.length) return null;
  return options[idx];
}

function parseFutureDate(input: string): string | null {
  const normalized = normalizeText(input);
  const today = getTurkeyTodayDate();

  if (normalized.includes("bugun")) {
    return today;
  }
  if (normalized.includes("yarin")) {
    return addDays(today, 1);
  }

  const weekdayMap: Array<{ keys: string[]; day: number }> = [
    { keys: ["pazar"], day: 0 },
    { keys: ["pazartesi", "pzt"], day: 1 },
    { keys: ["sali", "sal"], day: 2 },
    { keys: ["carsamba", "car"], day: 3 },
    { keys: ["persembe", "per"], day: 4 },
    { keys: ["cuma", "cum"], day: 5 },
    { keys: ["cumartesi", "cmt"], day: 6 },
  ];

  const todayDate = new Date(`${today}T00:00:00+03:00`);
  for (const row of weekdayMap) {
    if (row.keys.some((k) => normalized.includes(k))) {
      const current = todayDate.getDay();
      let diff = (row.day - current + 7) % 7;
      if (diff === 0) diff = 7;
      return addDays(today, diff);
    }
  }

  const numericMatch = normalized.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
  if (numericMatch) {
    const day = Number(numericMatch[1]);
    const month = Number(numericMatch[2]);
    let year = numericMatch[3] ? Number(numericMatch[3]) : getTurkeyYear();
    if (year < 100) year += 2000;
    let date = buildIsoDate(year, month, day);
    if (!date) return null;
    if (date <= today) {
      date = buildIsoDate(year + 1, month, day);
    }
    return date;
  }

  const monthMap: Record<string, number> = {
    ocak: 1,
    subat: 2,
    mart: 3,
    nisan: 4,
    mayis: 5,
    haziran: 6,
    temmuz: 7,
    agustos: 8,
    eylul: 9,
    ekim: 10,
    kasim: 11,
    aralik: 12,
  };

  const wordMatch = normalized.match(
    /\b(\d{1,2})\s+(ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)\b/
  );
  if (wordMatch) {
    const day = Number(wordMatch[1]);
    const month = monthMap[wordMatch[2]];
    const currentYear = getTurkeyYear();
    let date = buildIsoDate(currentYear, month, day);
    if (!date) return null;
    if (date <= today) {
      date = buildIsoDate(currentYear + 1, month, day);
    }
    return date;
  }

  return null;
}

function parseTimeInput(input: string): string | null {
  const normalized = input.replace(",", ".").trim();
  const hmMatch = normalized.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (hmMatch) {
    return `${hmMatch[1].padStart(2, "0")}:${hmMatch[2]}`;
  }

  const hourMatch = normalized.match(/\b([01]?\d|2[0-3])\b/);
  if (hourMatch) {
    return `${hourMatch[1].padStart(2, "0")}:00`;
  }

  return null;
}

function formatServiceList(services: BookingServiceOption[]): string {
  return services
    .map((service, idx) => `[${idx + 1}] ${service.name} (${service.durationMinutes} dk)`)
    .join("\n");
}

function formatStaffList(staff: Array<{ id: string; name: string }>): string {
  return staff.map((s, idx) => `[${idx + 1}] ${s.name}`).join("\n");
}

function formatSlotList(slots: string[]): string {
  return slots.map((slot) => `[${slot}]`).join("\n");
}

function getTurkeyTodayDate(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: TURKEY_TIMEZONE,
  });
}

function getTurkeyYear(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TURKEY_TIMEZONE,
      year: "numeric",
    }).format(new Date())
  );
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00+03:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-CA", { timeZone: TURKEY_TIMEZONE });
}

function buildIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+03:00`);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toLocaleDateString("en-CA", { timeZone: TURKEY_TIMEZONE });
  const [y, m, d] = iso.split("-").map(Number);
  if (y !== year || m !== month || d !== day) return null;
  return iso;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00+03:00`);
  const weekday = new Intl.DateTimeFormat("tr-TR", {
    timeZone: TURKEY_TIMEZONE,
    weekday: "long",
  }).format(date);
  const day = new Intl.DateTimeFormat("tr-TR", {
    timeZone: TURKEY_TIMEZONE,
    day: "numeric",
  }).format(date);
  const month = new Intl.DateTimeFormat("tr-TR", {
    timeZone: TURKEY_TIMEZONE,
    month: "long",
  }).format(date);
  return `${day} ${capitalizeFirst(month)} ${capitalizeFirst(weekday)}`;
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function getAvailabilityForDate(args: {
  tenantId: string;
  staffId: string;
  durationMinutes: number;
  date: string; // YYYY-MM-DD
}): Promise<{ availableTimes: string[]; suggestedTimes: string[] }> {
  const headers = {
    apikey: SUPABASE_CONFIG.serviceKey,
    Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
  };

  const dateObj = new Date(`${args.date}T00:00:00+03:00`);
  const dayOfWeek = dateObj.getDay();
  const dayStart = `${args.date}T00:00:00+03:00`;
  const dayEnd = `${args.date}T23:59:59+03:00`;

  const [businessHoursRes, staffHoursRes, apptRes, blockRes] = await Promise.all([
    fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/tenant_working_hours?tenant_id=eq.${args.tenantId}&select=day_of_week,start_time,end_time,is_closed`,
      { headers }
    ),
    fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/staff_working_hours?staff_id=eq.${args.staffId}&select=day_of_week,start_time,end_time,is_off`,
      { headers }
    ),
    fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/appointments?staff_id=eq.${args.staffId}&start_time=gte.${encodeURIComponent(dayStart)}&start_time=lte.${encodeURIComponent(dayEnd)}&status=in.(booked,confirmed,completed)&select=start_time,end_time,status`,
      { headers }
    ),
    fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/staff_time_blocks?staff_id=eq.${args.staffId}&or=${encodeURIComponent(`(and(start_at.lte.${dayEnd},end_at.gte.${dayStart}))`)}&select=start_at,end_at`,
      { headers }
    ),
  ]);

  if (!businessHoursRes.ok || !staffHoursRes.ok || !apptRes.ok || !blockRes.ok) {
    return { availableTimes: [], suggestedTimes: [] };
  }

  const businessHours = (await businessHoursRes.json()) as Array<any>;
  const staffHours = (await staffHoursRes.json()) as Array<any>;
  const appointments = (await apptRes.json()) as Array<any>;
  const blocks = (await blockRes.json()) as Array<any>;

  const businessDay = businessHours.find(
    (h) => h.day_of_week === dayOfWeek && !h.is_closed
  );
  const staffDay = staffHours.find((h) => h.day_of_week === dayOfWeek && !h.is_off);

  if (!businessDay || !staffDay) {
    return { availableTimes: [], suggestedTimes: [] };
  }

  const workStart = Math.max(
    timeToMinutes(businessDay.start_time),
    timeToMinutes(staffDay.start_time)
  );
  const workEnd = Math.min(
    timeToMinutes(businessDay.end_time),
    timeToMinutes(staffDay.end_time)
  );

  if (workEnd <= workStart || args.durationMinutes <= 0) {
    return { availableTimes: [], suggestedTimes: [] };
  }

  const intervals = [
    ...appointments
      .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
      .map((a) => ({ start: isoToTurkeyMinutes(a.start_time), end: isoToTurkeyMinutes(a.end_time) })),
    ...blocks.map((b) => ({ start: isoToTurkeyMinutes(b.start_at), end: isoToTurkeyMinutes(b.end_at) })),
  ];

  const availableTimes: string[] = [];
  let minStart = workStart;
  if (args.date === getTurkeyTodayDate()) {
    minStart = Math.max(minStart, roundToNextQuarterHour(getTurkeyCurrentMinutes()));
  }

  for (let start = minStart; start + args.durationMinutes <= workEnd; start += 15) {
    const end = start + args.durationMinutes;
    const hasConflict = intervals.some(
      (int) => start < int.end && end > int.start
    );
    if (!hasConflict) {
      availableTimes.push(minutesToTime(start));
    }
  }

  const suggestedTimes = calculateSuggestedTimes(
    availableTimes,
    intervals,
    workStart,
    workEnd,
    args.durationMinutes
  );

  return { availableTimes, suggestedTimes };
}

/**
 * Smart slot suggestion algorithm.
 *
 * 1. Score each available slot based on proximity to existing appointments
 *    (sandwich / adjacency logic) and gap-waste penalty.
 * 2. When the day is empty (no existing appointments) use a "spread" strategy:
 *    divide the working window into 3 time zones and pick 2 from each.
 * 3. Final selection ensures diversity: the 6 returned slots are spread
 *    across the day, avoiding 3+ consecutive 15-min slots.
 */
function calculateSuggestedTimes(
  availableTimes: string[],
  intervals: Array<{ start: number; end: number }>,
  workingStart: number,
  workingEnd: number,
  durationMinutes: number
): string[] {
  if (availableTimes.length === 0) return [];

  // If very few slots (<=6), return all — no need to filter
  if (availableTimes.length <= 6) return [...availableTimes];

  // --- EMPTY DAY: Smart spread ---
  if (intervals.length === 0) {
    return spreadAcrossDay(availableTimes, workingStart, workingEnd, 6);
  }

  // --- BUSY DAY: Score-based selection ---
  const sorted = [...intervals].sort((a, b) => a.start - b.start);

  const scored = availableTimes.map((time) => {
    const start = timeToMinutes(time);
    const end = start + durationMinutes;
    let score = 0;

    for (const block of sorted) {
      // Exact adjacency (sandwich) — highest value
      const exactBefore = end === block.start;
      const exactAfter = start === block.end;

      if (exactBefore) score += 10;
      if (exactAfter) score += 10;

      // Close proximity bonus — only if NOT exact (no double-count)
      if (!exactBefore && Math.abs(end - block.start) <= 30) score += 3;
      if (!exactAfter && Math.abs(start - block.end) <= 30) score += 3;
    }

    // Gap-waste penalty: would this slot create a tiny unusable gap?
    score += gapWastePenalty(start, end, sorted, workingStart, workingEnd, durationMinutes);

    // Edge-of-day penalty
    if (start === workingStart) score -= 2;
    if (end >= workingEnd - 15) score -= 2;

    return { time, start, score };
  });

  // Sort by score desc, then chronological
  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.start - b.start));

  // Pick top 6 with diversity (avoid clustering)
  return diversePick(scored, 6, durationMinutes);
}

/** Spread N slots evenly across the working window when no appointments exist. */
function spreadAcrossDay(
  availableTimes: string[],
  workingStart: number,
  workingEnd: number,
  count: number
): string[] {
  const totalWindow = workingEnd - workingStart;
  const zoneCount = Math.min(count, 3); // 3 zones: morning / midday / evening
  const zoneSize = Math.floor(totalWindow / zoneCount);
  const perZone = Math.ceil(count / zoneCount);

  const zones: string[][] = Array.from({ length: zoneCount }, () => []);
  for (const time of availableTimes) {
    const m = timeToMinutes(time);
    const zoneIdx = Math.min(Math.floor((m - workingStart) / zoneSize), zoneCount - 1);
    zones[zoneIdx].push(time);
  }

  // From each zone pick evenly-spaced slots
  const result: string[] = [];
  for (const zone of zones) {
    if (zone.length === 0) continue;
    const step = Math.max(1, Math.floor(zone.length / perZone));
    for (let i = 0; i < zone.length && result.length < count; i += step) {
      result.push(zone[i]);
    }
  }

  // Fill remaining from largest zone if needed
  if (result.length < count) {
    const used = new Set(result);
    for (const time of availableTimes) {
      if (result.length >= count) break;
      if (!used.has(time)) {
        result.push(time);
        used.add(time);
      }
    }
  }

  return result.sort((a, b) => a.localeCompare(b)).slice(0, count);
}

/**
 * Penalize slots that create tiny unusable gaps between themselves and
 * the nearest occupied block. A gap shorter than durationMinutes can't
 * fit any appointment → wasted time.
 */
function gapWastePenalty(
  slotStart: number,
  slotEnd: number,
  sorted: Array<{ start: number; end: number }>,
  workingStart: number,
  workingEnd: number,
  durationMinutes: number
): number {
  let penalty = 0;

  // Gap before this slot (from previous block end or day start)
  let prevEnd = workingStart;
  for (const block of sorted) {
    if (block.end <= slotStart) prevEnd = Math.max(prevEnd, block.end);
  }
  const gapBefore = slotStart - prevEnd;
  if (gapBefore > 0 && gapBefore < durationMinutes) penalty -= 4;

  // Gap after this slot (to next block start or day end)
  let nextStart = workingEnd;
  for (const block of sorted) {
    if (block.start >= slotEnd) { nextStart = block.start; break; }
  }
  const gapAfter = nextStart - slotEnd;
  if (gapAfter > 0 && gapAfter < durationMinutes) penalty -= 4;

  return penalty;
}

/**
 * Pick `count` items from a score-sorted list while ensuring diversity.
 * Avoids selecting 3+ slots within a 45-min window.
 */
function diversePick(
  scored: Array<{ time: string; start: number; score: number }>,
  count: number,
  _durationMinutes: number
): string[] {
  const picked: Array<{ time: string; start: number }> = [];
  const MIN_GAP = 45; // minimum gap between any two selected suggestions

  for (const item of scored) {
    if (picked.length >= count) break;
    // Check clustering: allow max 2 slots within any MIN_GAP window
    const nearby = picked.filter((p) => Math.abs(p.start - item.start) < MIN_GAP);
    if (nearby.length >= 2) continue;
    picked.push({ time: item.time, start: item.start });
  }

  // If diversity filter was too strict, fill remaining by score
  if (picked.length < count) {
    const usedTimes = new Set(picked.map((p) => p.time));
    for (const item of scored) {
      if (picked.length >= count) break;
      if (!usedTimes.has(item.time)) {
        picked.push({ time: item.time, start: item.start });
        usedTimes.add(item.time);
      }
    }
  }

  return picked
    .sort((a, b) => a.start - b.start)
    .map((p) => p.time);
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isoToTurkeyMinutes(iso: string): number {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TURKEY_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value || "0");
  return hour * 60 + minute;
}

function getTurkeyCurrentMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TURKEY_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value || "0");
  return hour * 60 + minute;
}

function roundToNextQuarterHour(minutes: number): number {
  if (minutes % 15 === 0) return minutes;
  return Math.ceil(minutes / 15) * 15;
}
