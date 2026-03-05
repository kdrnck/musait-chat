import type { SupabaseConfig } from "./customers";
import { validateToolArgs, VIEW_SLOTS_FIELDS } from "./validate";

interface ToolContext {
    tenantId: string;
    conversationId?: string;
    customerPhone?: string;
}

/**
 * view_available_slots - Query Supabase for available appointment slots.
 *
 * Tries the `get_available_slots` RPC first; falls back to manual calculation.
 * Uses sandwich scoring to surface smart recommendations.
 */
export async function viewAvailableSlots(
    config: SupabaseConfig,
    args: Record<string, unknown>,
    ctx: ToolContext
): Promise<unknown> {
    const validation = validateToolArgs(args, VIEW_SLOTS_FIELDS);
    if (!validation.valid) {
        return { error: validation.error };
    }

    const date = validation.data.date as string;
    const serviceId = validation.data.service_id as string | undefined;
    const staffId = validation.data.staff_id as string | undefined;
    const showAll = validation.data.show_all === true;

    let serviceDurationForRpc: number | undefined;
    if (serviceId) {
        try {
            const svcUrl = new URL(`${config.url}/rest/v1/services`);
            svcUrl.searchParams.set("id", `eq.${serviceId}`);
            svcUrl.searchParams.set("select", "duration_minutes");
            const svcRes = await fetch(svcUrl.toString(), {
                headers: {
                    apikey: config.serviceKey,
                    Authorization: `Bearer ${config.serviceKey}`,
                },
            });
            if (svcRes.ok) {
                const svcJson = await svcRes.json();
                if (Array.isArray(svcJson) && svcJson[0]) {
                    serviceDurationForRpc = svcJson[0].duration_minutes;
                }
            }
        } catch {
            // ignore â€” fallback will be used
        }
    }

    const response = await fetch(
        `${config.url}/rest/v1/rpc/get_available_slots`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: config.serviceKey,
                Authorization: `Bearer ${config.serviceKey}`,
            },
            body: JSON.stringify({
                p_tenant_id: ctx.tenantId,
                p_date: date,
                ...(serviceDurationForRpc
                    ? { p_duration_minutes: serviceDurationForRpc }
                    : {}),
                ...(staffId ? { p_staff_id: staffId } : {}),
            }),
        }
    );

    if (!response.ok) {
        const fallbackResult = await manualSlotQuery(
            config,
            ctx.tenantId,
            date,
            serviceId,
            staffId
        );
        return attachRecommendedSlots(fallbackResult, showAll);
    }

    const rpcData = (await response.json()) as Record<string, unknown>;
    const rpcSlots = rpcData.availableSlots;
    if (Array.isArray(rpcSlots) && rpcSlots.length > 0 && rpcSlots[0]?.time) {
        const available = rpcSlots
            .filter((s: any) => s.isAvailable !== false)
            .map((s: any) => ({ time: String(s.time) }));
        return attachRecommendedSlots({ date, availableSlots: available }, showAll);
    }

    const fallbackResult = await manualSlotQuery(
        config,
        ctx.tenantId,
        date,
        serviceId,
        staffId
    );
    return attachRecommendedSlots(fallbackResult, showAll);
}

async function manualSlotQuery(
    config: SupabaseConfig,
    tenantId: string,
    date: string,
    serviceId?: string,
    staffId?: string
): Promise<Record<string, unknown>> {
    const headers = {
        "Content-Type": "application/json",
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
    };

    const [year, month, day] = date.split("-").map(Number);
    const localDate = new Date(year, month - 1, day);
    const dayOfWeek = localDate.getDay();

    const whUrl = new URL(`${config.url}/rest/v1/staff_working_hours`);
    whUrl.searchParams.set("tenant_id", `eq.${tenantId}`);
    whUrl.searchParams.set("day_of_week", `eq.${dayOfWeek}`);
    whUrl.searchParams.set("is_off", "eq.false");
    if (staffId) whUrl.searchParams.set("staff_id", `eq.${staffId}`);
    whUrl.searchParams.set("select", "staff_id,start_time,end_time");

    const whRes = await fetch(whUrl.toString(), { headers });
    const whJson = whRes.ok ? await whRes.json() : [];
    const workingHours: Array<{
        staff_id: string;
        start_time: string;
        end_time: string;
    }> = Array.isArray(whJson) ? whJson : [];

    if (workingHours.length === 0) {
        return {
            date,
            availableSlots: [],
            recommendedSlots: [],
            reason: "Ã‡alÄ±ÅŸma saati tanÄ±mlÄ± deÄŸil",
        };
    }

    const startOfDay = `${date}T00:00:00+03:00`;
    const endOfDay = `${date}T23:59:59+03:00`;

    const apptUrl = new URL(`${config.url}/rest/v1/appointments`);
    apptUrl.searchParams.set("tenant_id", `eq.${tenantId}`);
    apptUrl.searchParams.set(
        "and",
        `(start_time.gte.${startOfDay},start_time.lt.${endOfDay})`
    );
    apptUrl.searchParams.set("status", "in.(booked,upcoming)");
    apptUrl.searchParams.set("select", "staff_id,start_time,end_time");

    const apptRes = await fetch(apptUrl.toString(), { headers });
    const apptJson = apptRes.ok ? await apptRes.json() : [];
    const appointments: Array<any> = Array.isArray(apptJson) ? apptJson : [];

    const blockUrl = new URL(`${config.url}/rest/v1/staff_time_blocks`);
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

    let serviceDuration = 30;
    if (serviceId) {
        const svcUrl = new URL(`${config.url}/rest/v1/services`);
        svcUrl.searchParams.set("id", `eq.${serviceId}`);
        svcUrl.searchParams.set("select", "duration_minutes,name");

        const svcRes = await fetch(svcUrl.toString(), { headers });
        const svcJson = svcRes.ok ? await svcRes.json() : [];
        const services = Array.isArray(svcJson) ? svcJson : [];
        if (services[0]) serviceDuration = services[0].duration_minutes || 30;
    }

    const available: Array<{ staffId: string; time: string }> = [];
    const staffWorkingWindows = new Map<
        string,
        { start: number; end: number }
    >();

    for (const wh of workingHours) {
        const start = parseTime(wh.start_time);
        const end = parseTime(wh.end_time);
        staffWorkingWindows.set(wh.staff_id, { start, end });

        for (let t = start; t + serviceDuration <= end; t += 15) {
            const timeStr = formatTime(t);
            const slotStart = `${date}T${timeStr}:00+03:00`;

            const hasConflict = appointments.some(
                (appt: any) =>
                    appt.staff_id === wh.staff_id &&
                    new Date(appt.start_time) <
                    new Date(
                        `${date}T${formatTime(t + serviceDuration)}:00+03:00`
                    ) &&
                    new Date(appt.end_time || appt.start_time) > new Date(slotStart)
            );

            if (!hasConflict) {
                const blockedByTimeBlock = blocks.some(
                    (block: any) =>
                        block.staff_id === wh.staff_id &&
                        new Date(block.start_at) <
                        new Date(
                            `${date}T${formatTime(t + serviceDuration)}:00+03:00`
                        ) &&
                        new Date(block.end_at) > new Date(slotStart)
                );
                if (blockedByTimeBlock) continue;

                available.push({ staffId: wh.staff_id, time: timeStr });
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
        availableSlots: available.map(enrichSlot),
        recommendedSlots: recommendedSlots.map(enrichSlot),
        _totalAvailable: available.length,
    };
}

function enrichSlot(slot: {
    staffId?: string;
    time: string;
}): { staffId?: string; time: string; id: string } {
    const id = slot.staffId ? `${slot.staffId}|${slot.time}` : slot.time;
    return { ...slot, id };
}

function attachRecommendedSlots(
    payload: Record<string, unknown>,
    showAll = false
): Record<string, unknown> {
    const recommended = getTopRecommendedSlots(payload).map(enrichSlot);

    const rawAvailable = payload.availableSlots;
    const allSlots: Array<{
        staffId?: string;
        time: string;
        id: string;
        label: string;
    }> = Array.isArray(rawAvailable)
            ? rawAvailable.map((s: any) =>
                s && typeof s === "object" && typeof s.time === "string"
                    ? enrichSlot(s)
                    : s
            )
            : [];

    const totalAvailable =
        (payload._totalAvailable as number | undefined) ?? allSlots.length;
    const slotsToShow = showAll ? allSlots : recommended;

    const note =
        !showAll && totalAvailable > slotsToShow.length
            ? `Toplam ${totalAvailable} boÅŸ saat var. Sadece Ã¶nerilen ${slotsToShow.length} saat gÃ¶steriliyor. MÃ¼ÅŸteri daha fazla isterse show_all: true kullanÄ±n.`
            : undefined;

    return {
        date: payload.date,
        serviceDurationMinutes: payload.serviceDurationMinutes,
        display_label: showAll ? "TÃ¼m BoÅŸ Saatler" : "Ã–nerilen Saatler",
        recommended_slots: slotsToShow,
        slots: slotsToShow,
        total_available_count: totalAvailable,
        mode: showAll ? "all" : "recommended",
        ...(note ? { note } : {}),
    };
}

function getTopRecommendedSlots(
    payload: Record<string, unknown>
): Array<{ staffId?: string; time: string }> {
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
    if (available.length <= 6) return [...available];

    const intervalsByStaff = new Map<
        string,
        Array<{ start: number; end: number }>
    >();
    for (const appt of appointments) {
        if (!appt?.staff_id || !appt?.start_time || !appt?.end_time) continue;
        const start = extractTurkeyMinutes(appt.start_time);
        const end = extractTurkeyMinutes(appt.end_time);
        if (!intervalsByStaff.has(appt.staff_id))
            intervalsByStaff.set(appt.staff_id, []);
        intervalsByStaff.get(appt.staff_id)!.push({ start, end });
    }
    for (const block of blocks) {
        if (!block?.staff_id || !block?.start_at || !block?.end_at) continue;
        const start = extractTurkeyMinutes(block.start_at);
        const end = extractTurkeyMinutes(block.end_at);
        if (!intervalsByStaff.has(block.staff_id))
            intervalsByStaff.set(block.staff_id, []);
        intervalsByStaff.get(block.staff_id)!.push({ start, end });
    }

    const totalIntervals = Array.from(intervalsByStaff.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
    );
    if (totalIntervals === 0) {
        return spreadSlots(available, staffWorkingWindows, 6);
    }

    const scored = available.map((slot) => {
        const slotStart = parseTime(slot.time);
        const slotEnd = slotStart + durationMinutes;
        const intervals = (intervalsByStaff.get(slot.staffId) || []).sort(
            (a, b) => a.start - b.start
        );
        const window = staffWorkingWindows.get(slot.staffId);
        let score = 0;

        for (const int of intervals) {
            const exactBefore = slotEnd === int.start;
            const exactAfter = slotStart === int.end;
            if (exactBefore) score += 10;
            if (exactAfter) score += 10;
            if (!exactBefore && Math.abs(slotEnd - int.start) <= 30) score += 3;
            if (!exactAfter && Math.abs(slotStart - int.end) <= 30) score += 3;
        }

        if (window && intervals.length > 0) {
            let prevEnd = window.start;
            for (const int of intervals) {
                if (int.end <= slotStart) prevEnd = Math.max(prevEnd, int.end);
            }
            const gapBefore = slotStart - prevEnd;
            if (gapBefore > 0 && gapBefore < durationMinutes) score -= 4;

            let nextStart = window.end;
            for (const int of intervals) {
                if (int.start >= slotEnd) {
                    nextStart = int.start;
                    break;
                }
            }
            const gapAfter = nextStart - slotEnd;
            if (gapAfter > 0 && gapAfter < durationMinutes) score -= 4;
        }

        if (window) {
            if (slotStart === window.start) score -= 2;
            if (slotEnd >= window.end - 15) score -= 2;
        }

        return { ...slot, slotStart, score };
    });

    scored.sort((a, b) =>
        b.score !== a.score ? b.score - a.score : a.slotStart - b.slotStart
    );

    const picked: Array<{
        staffId: string;
        time: string;
        slotStart: number;
    }> = [];
    for (const item of scored) {
        if (picked.length >= 6) break;
        const nearby = picked.filter(
            (p) =>
                p.staffId === item.staffId && Math.abs(p.slotStart - item.slotStart) < 45
        );
        if (nearby.length >= 2) continue;
        picked.push(item);
    }
    if (picked.length < 6) {
        const usedKeys = new Set(picked.map((p) => `${p.staffId}|${p.time}`));
        for (const item of scored) {
            if (picked.length >= 6) break;
            const key = `${item.staffId}|${item.time}`;
            if (!usedKeys.has(key)) {
                picked.push(item);
                usedKeys.add(key);
            }
        }
    }

    return picked
        .sort((a, b) => a.slotStart - b.slotStart)
        .map(({ staffId, time }) => ({ staffId, time }));
}

function spreadSlots(
    available: Array<{ staffId: string; time: string }>,
    staffWorkingWindows: Map<string, { start: number; end: number }>,
    count: number
): Array<{ staffId: string; time: string }> {
    let globalStart = 1440,
        globalEnd = 0;
    for (const w of staffWorkingWindows.values()) {
        globalStart = Math.min(globalStart, w.start);
        globalEnd = Math.max(globalEnd, w.end);
    }
    if (globalStart >= globalEnd) return available.slice(0, count);

    const zoneCount = 3;
    const zoneSize = Math.floor((globalEnd - globalStart) / zoneCount);
    const perZone = Math.ceil(count / zoneCount);

    const zones: Array<Array<{ staffId: string; time: string }>> = Array.from(
        { length: zoneCount },
        () => []
    );
    for (const slot of available) {
        const m = parseTime(slot.time);
        const zoneIdx = Math.min(
            Math.floor((m - globalStart) / zoneSize),
            zoneCount - 1
        );
        zones[zoneIdx].push(slot);
    }

    const result: Array<{ staffId: string; time: string }> = [];
    for (const zone of zones) {
        if (zone.length === 0) continue;
        const step = Math.max(1, Math.floor(zone.length / perZone));
        for (let i = 0; i < zone.length && result.length < count; i += step) {
            result.push(zone[i]);
        }
    }

    if (result.length < count) {
        const used = new Set(result.map((r) => `${r.staffId}|${r.time}`));
        for (const slot of available) {
            if (result.length >= count) break;
            const key = `${slot.staffId}|${slot.time}`;
            if (!used.has(key)) {
                result.push(slot);
                used.add(key);
            }
        }
    }

    return result.sort((a, b) => a.time.localeCompare(b.time)).slice(0, count);
}

function extractTurkeyMinutes(iso: string): number {
    const date = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Istanbul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);

    const hour = Number(
        parts.find((p) => p.type === "hour")?.value || "0"
    );
    const minute = Number(
        parts.find((p) => p.type === "minute")?.value || "0"
    );
    return hour * 60 + minute;
}

function extractSlotCandidates(
    payload: Record<string, unknown>
): Array<{ staffId?: string; time: string }> {
    for (const key of [
        "recommendedSlots",
        "suggestedSlots",
        "slots",
        "availableSlots",
    ] as const) {
        const arr = payload[key];
        if (Array.isArray(arr)) {
            const normalized = normalizeSlotArray(arr);
            if (normalized.length > 0) return normalized;
        }
    }
    return [];
}

function normalizeSlotArray(
    items: unknown[]
): Array<{ staffId?: string; time: string }> {
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
