import type { SupabaseConfig } from "./customers";

/**
 * check_specific_slot
 *
 * MÃ¼ÅŸteri spesifik bir saat istediÄŸinde (Ã¶r. "11:40'da gelmek istiyorum")
 * view_available_slots yerine bu tool kullanÄ±lÄ±r.
 *
 * Â± tolerance_minutes penceresi iÃ§indeki boÅŸ slotlarÄ± bulur,
 * en yakÄ±n seÃ§eneÄŸi Ã¶nerir.
 */
export async function checkSpecificSlot(
    config: SupabaseConfig,
    args: Record<string, unknown>,
    ctx: { tenantId: string }
): Promise<unknown> {
    const date = typeof args.date === "string" ? args.date : "";
    const requestedRaw =
        typeof args.requested_time === "string" ? args.requested_time : "";
    const serviceId =
        typeof args.service_id === "string" ? args.service_id : undefined;
    const staffId =
        typeof args.staff_id === "string" ? args.staff_id : undefined;
    const tolerance =
        typeof args.tolerance_minutes === "number" ? args.tolerance_minutes : 30;

    if (!date || !requestedRaw) {
        return { error: "date ve requested_time zorunludur" };
    }

    const requestedTime = normalizeTime(requestedRaw);
    if (!requestedTime) {
        return {
            error: `Saat formatÄ± anlaÅŸÄ±lamadÄ±: "${requestedRaw}". HH:MM formatÄ±nda girin.`,
        };
    }

    const headers = {
        "Content-Type": "application/json",
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
    };

    let durationMinutes = 30;
    if (serviceId) {
        try {
            const svcUrl = new URL(`${config.url}/rest/v1/services`);
            svcUrl.searchParams.set("id", `eq.${serviceId}`);
            svcUrl.searchParams.set("select", "duration_minutes");
            const res = await fetch(svcUrl.toString(), { headers });
            if (res.ok) {
                const json = await res.json();
                if (Array.isArray(json) && json[0]?.duration_minutes) {
                    durationMinutes = json[0].duration_minutes;
                }
            }
        } catch {
            /* ignore */
        }
    }

    const [year, month, day] = date.split("-").map(Number);
    const localDate = new Date(year, month - 1, day);
    const dayOfWeek = localDate.getDay();

    const whUrl = new URL(`${config.url}/rest/v1/staff_working_hours`);
    whUrl.searchParams.set("tenant_id", `eq.${ctx.tenantId}`);
    whUrl.searchParams.set("day_of_week", `eq.${dayOfWeek}`);
    whUrl.searchParams.set("is_off", "eq.false");
    if (staffId) whUrl.searchParams.set("staff_id", `eq.${staffId}`);
    whUrl.searchParams.set("select", "staff_id,start_time,end_time");

    const whRes = await fetch(whUrl.toString(), { headers });
    const workingHours: Array<{
        staff_id: string;
        start_time: string;
        end_time: string;
    }> = whRes.ok ? await whRes.json() : [];

    if (workingHours.length === 0) {
        return {
            requested: requestedTime,
            slot_unavailable: true,
            reason: "Bu tarih iÃ§in Ã§alÄ±ÅŸma saati tanÄ±mlÄ± deÄŸil.",
        };
    }

    const startOfDay = `${date}T00:00:00+03:00`;
    const endOfDay = `${date}T23:59:59+03:00`;

    const apptUrl = new URL(`${config.url}/rest/v1/appointments`);
    apptUrl.searchParams.set("tenant_id", `eq.${ctx.tenantId}`);
    apptUrl.searchParams.set(
        "and",
        `(start_time.gte.${startOfDay},start_time.lt.${endOfDay})`
    );
    apptUrl.searchParams.set("status", "in.(booked,upcoming)");
    apptUrl.searchParams.set("select", "staff_id,start_time,end_time");
    const apptRes = await fetch(apptUrl.toString(), { headers });
    const appointments: Array<any> = apptRes.ok ? await apptRes.json() : [];

    const blockUrl = new URL(`${config.url}/rest/v1/staff_time_blocks`);
    blockUrl.searchParams.set("tenant_id", `eq.${ctx.tenantId}`);
    blockUrl.searchParams.set(
        "or",
        `(and(start_at.lte.${endOfDay},end_at.gte.${startOfDay}))`
    );
    if (staffId) blockUrl.searchParams.set("staff_id", `eq.${staffId}`);
    blockUrl.searchParams.set("select", "staff_id,start_at,end_at");
    const blockRes = await fetch(blockUrl.toString(), { headers });
    const blocks: Array<any> = blockRes.ok ? await blockRes.json() : [];

    const requestedMin = parseTimeMin(requestedTime);
    const windowStart = requestedMin - tolerance;
    const windowEnd = requestedMin + tolerance;

    type SlotCandidate = { staffId: string; time: string; distanceMin: number };
    const candidates: SlotCandidate[] = [];

    for (const wh of workingHours) {
        const whStart = parseTimeMin(wh.start_time);
        const whEnd = parseTimeMin(wh.end_time);

        for (let t = whStart; t + durationMinutes <= whEnd; t += 15) {
            if (t < windowStart || t > windowEnd) continue;

            const timeStr = formatTimeMin(t);
            const slotStart = `${date}T${timeStr}:00+03:00`;
            const slotEndTs = `${date}T${formatTimeMin(t + durationMinutes)}:00+03:00`;

            const conflict = appointments.some(
                (a: any) =>
                    a.staff_id === wh.staff_id &&
                    new Date(a.start_time) < new Date(slotEndTs) &&
                    new Date(a.end_time || a.start_time) > new Date(slotStart)
            );
            if (conflict) continue;

            const blocked = blocks.some(
                (b: any) =>
                    b.staff_id === wh.staff_id &&
                    new Date(b.start_at) < new Date(slotEndTs) &&
                    new Date(b.end_at) > new Date(slotStart)
            );
            if (blocked) continue;

            candidates.push({
                staffId: wh.staff_id,
                time: timeStr,
                distanceMin: Math.abs(t - requestedMin),
            });
        }
    }

    if (candidates.length === 0) {
        return {
            requested: requestedTime,
            slot_unavailable: true,
            reason: `${requestedTime} Â±${tolerance} dakika iÃ§inde boÅŸ saat yok.`,
            suggestion:
                "MÃ¼ÅŸteriye farklÄ± bir saat veya gÃ¼n Ã¶nerin, ya da view_available_slots ile geniÅŸ Ã¶neriler alÄ±n.",
        };
    }

    candidates.sort((a, b) =>
        a.distanceMin !== b.distanceMin
            ? a.distanceMin - b.distanceMin
            : a.time.localeCompare(b.time)
    );

    const exactMatch = candidates.find((c) => c.distanceMin === 0);
    const nearest = candidates[0];
    const alternatives = candidates
        .filter((c) => c.time !== nearest.time)
        .slice(0, 3)
        .map((c) => enrichSlot({ staffId: c.staffId, time: c.time }));

    return {
        requested: requestedTime,
        exact_match: !!exactMatch,
        nearest_available: enrichSlot({
            staffId: nearest.staffId,
            time: nearest.time,
        }),
        alternatives,
        slot_unavailable: false,
        guide: exactMatch
            ? `${requestedTime} saati uygun! Onay gelirse randevu oluÅŸturabilirsin.`
            : `${requestedTime} dolu. En yakÄ±n: ${nearest.time}. MÃ¼ÅŸteriye sor.`,
    };
}

function parseTimeMin(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

function formatTimeMin(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function enrichSlot(slot: { staffId: string; time: string }) {
    return { ...slot, id: `${slot.staffId}|${slot.time}` };
}

function normalizeTime(raw: string): string | null {
    const trimmed = raw.trim();
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
        const [h, m] = trimmed.split(":").map(Number);
        if (h >= 0 && h < 24 && m >= 0 && m < 60) {
            return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        }
    }
    if (/^\d{1,2}$/.test(trimmed)) {
        const h = Number(trimmed);
        if (h >= 0 && h < 24) return `${String(h).padStart(2, "0")}:00`;
    }
    if (/^\d{4}$/.test(trimmed)) {
        const h = Number(trimmed.slice(0, 2));
        const m = Number(trimmed.slice(2));
        if (h >= 0 && h < 24 && m >= 0 && m < 60) {
            return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        }
    }
    return null;
}
