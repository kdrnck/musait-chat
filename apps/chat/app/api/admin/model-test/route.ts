import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveModelTestPromptContext } from "./prompt-context";
import {
    listServices,
    listStaff,
    getBusinessInfo,
    viewAvailableSlots,
    checkSpecificSlot,
    listCustomerAppointments,
    createAppointment,
    createAppointmentsBatch,
    cancelAppointment,
    suggestLeastBusyStaff,
    composeInteractiveMessage,
    type SupabaseConfig,
} from "@musait/tools";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

interface ToolResult {
    tool_call_id: string;
    role: "tool";
    name: string;
    content: string;
}

function getToolDefinitions() {
    return [
        {
            type: "function",
            function: {
                name: "list_customer_appointments",
                description: "Konuşmadaki müşterinin mevcut/gelecek randevularını listeler.",
                parameters: {
                    type: "object",
                    properties: {
                        only_future: { type: "boolean", description: "Sadece gelecek randevuları döndür (varsayılan: true)" },
                        include_cancelled: { type: "boolean", description: "İptal edilmiş randevuları da dahil et (varsayılan: false)" },
                        limit: { type: "number", description: "Maksimum randevu sayısı (varsayılan: 10, max: 20)" },
                    },
                    required: [],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "view_available_slots",
                description: "ÖNERİLEN randevu saatlerini gösterir (maks 6). Bu çıktı tüm boş saatler DEĞİL, algoritma tarafından seçilmiş akıllı önerilerdir. Müşteri 'sabah 10' veya '14:00' gibi SPESIFİK bir saat söylediğinde bu tool yerine check_specific_slot kullan. Müşteri 'başka saat var mı', 'diğer saatler' istediğinde show_all: true geç.",
                parameters: {
                    type: "object",
                    properties: {
                        date: { type: "string", description: "Tarih (YYYY-MM-DD formatında)" },
                        service_id: { type: "string", description: "Hizmet ID (opsiyonel)" },
                        staff_id: { type: "string", description: "Personel ID (opsiyonel)" },
                        show_all: { type: "boolean", description: "true geçilirse tüm boş saatler döner. Sadece müşteri 'başka saat var mı' veya 'diğer saatler' gibi bir şey söylediğinde kullanın. Aksi halde false/eksik bırakın." },
                    },
                    required: ["date"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "check_specific_slot",
                description: "Müşteri SPESIFİK bir saat istediğinde kullan ('11:40'da gelmek istiyorum', 'çarşamba 5' gibi). view_available_slots'u çağırmadan önce belirtilen saatin ±tolerance_minutes penceresi içindeki boş slotları kontrol eder. Tam eşleşme varsa direkt onayla. nearest_available varsa müşteriye sor. slot_unavailable ise başka saat öner.",
                parameters: {
                    type: "object",
                    properties: {
                        date: { type: "string", description: "Tarih (YYYY-MM-DD formatında)" },
                        requested_time: { type: "string", description: "Müşterinin istediği saat ('11:40', '14:00', '9', '1400' gibi formatlar desteklenir)" },
                        service_id: { type: "string", description: "Hizmet ID (opsiyonel, süre hesaplaması için)" },
                        staff_id: { type: "string", description: "Personel ID (opsiyonel)" },
                        tolerance_minutes: { type: "number", description: "Arama penceresi ± dakika (varsayılan: 30)" },
                    },
                    required: ["date", "requested_time"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "create_appointment",
                description: "Yeni bir randevu oluşturur. Müşteriden açık onay ALDIKTAN SONRA kullanılmalıdır.",
                parameters: {
                    type: "object",
                    properties: {
                        service_id: { type: "string", description: "Hizmet ID" },
                        staff_id: { type: "string", description: "Personel ID" },
                        start_time: { type: "string", description: "Başlangıç zamanı — YYYY-MM-DDTHH:MM:SS+03:00" },
                        customer_name: { type: "string", description: "Müşteri adı (opsiyonel)" },
                    },
                    required: ["service_id", "staff_id", "start_time"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "create_appointments_batch",
                description: "Birden fazla hizmet için ardışık randevu planını atomik biçimde oluşturur.",
                parameters: {
                    type: "object",
                    properties: {
                        service_names: {
                            type: "array",
                            items: { type: "string" },
                            description: "Hizmet isimleri sıralı listesi",
                        },
                        date: { type: "string", description: "Tarih (YYYY-MM-DD)" },
                        start_time: { type: "string", description: "Başlangıç saati (HH:MM)" },
                        staff_id: { type: "string", description: "Personel ID (opsiyonel)" },
                        staff_name: { type: "string", description: "Personel adı (opsiyonel)" },
                        customer_name: { type: "string", description: "Müşteri adı (opsiyonel)" },
                        require_atomic: { type: "boolean", description: "Varsayılan true" },
                    },
                    required: ["service_names", "date", "start_time"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "cancel_appointment",
                description: "Mevcut bir randevuyu iptal eder.",
                parameters: {
                    type: "object",
                    properties: {
                        appointment_id: { type: "string", description: "İptal edilecek randevu ID" },
                        reason: { type: "string", description: "İptal sebebi (opsiyonel)" },
                    },
                    required: ["appointment_id"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "suggest_least_busy_staff",
                description: "Hizmet ve tarih için daha az yoğun personeli önerir.",
                parameters: {
                    type: "object",
                    properties: {
                        date: { type: "string", description: "Tarih (YYYY-MM-DD)" },
                        service_id: { type: "string", description: "Hizmet ID" },
                    },
                    required: ["date", "service_id"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "list_businesses",
                description: "Aktif işletmeleri listeler.",
                parameters: { type: "object", properties: {}, required: [] },
            },
        },
        {
            type: "function",
            function: {
                name: "bind_tenant",
                description: "Konuşmayı tenant_id ile belirtilen işletmeye bağlar.",
                parameters: {
                    type: "object",
                    properties: {
                        tenant_id: { type: "string", description: "İşletme tenant ID" },
                    },
                    required: ["tenant_id"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "ask_human",
                description: "Konuşmayı bir insan operatöre devreder.",
                parameters: {
                    type: "object",
                    properties: { reason: { type: "string" } },
                    required: ["reason"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "end_session",
                description: "Oturumu sonlandırır.",
                parameters: {
                    type: "object",
                    properties: { summary: { type: "string" } },
                    required: [],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "take_notes_for_user",
                description: "Müşteri hakkında önemli bilgileri not olarak kaydeder.",
                parameters: {
                    type: "object",
                    properties: {
                        note: { type: "string", description: "Kaydedilecek not içeriği (Türkçe)" },
                    },
                    required: ["note"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "update_customer_name",
                description: "Müşterinin kayıtlı adını ve/veya soyadını günceller.",
                parameters: {
                    type: "object",
                    properties: {
                        first_name: { type: "string", description: "Müşterinin yeni adı (opsiyonel)" },
                        last_name: { type: "string", description: "Müşterinin yeni soyadı (opsiyonel)" },
                    },
                    required: [],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "compose_interactive_message",
                description: "WhatsApp interaktif liste/buton mesajını şemalı olarak üretir.",
                parameters: {
                    type: "object",
                    properties: {
                        kind: { type: "string", enum: ["buttons", "list"] },
                        body: { type: "string" },
                        buttons: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string" },
                                    title: { type: "string" },
                                },
                                required: ["id", "title"],
                            },
                        },
                        button_text: { type: "string" },
                        sections: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    rows: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string" },
                                                title: { type: "string" },
                                                description: { type: "string" },
                                            },
                                            required: ["id", "title"],
                                        },
                                    },
                                },
                                required: ["title", "rows"],
                            },
                        },
                    },
                    required: ["kind", "body"],
                },
            },
        },
    ];
}

function supportsReasoning(model: string): boolean {
    return /deepseek|gemini/i.test(model);
}

// ══════════════════════════════════════════════════════════════
//  Slot recommendation helpers (ported from worker/view-slots.ts)
// ══════════════════════════════════════════════════════════════

function parseTimeMin(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

function formatTimeMin(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function extractTurkeyMinutes(iso: string): number {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Istanbul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(d);
    const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value || "0");
    return hour * 60 + minute;
}

function enrichSlot(slot: { staffId?: string; time: string }): { staffId?: string; time: string; id: string; label: string } {
    const id = slot.staffId ? `${slot.staffId}|${slot.time}` : slot.time;
    return { ...slot, id, label: `🕑 ${slot.time}` };
}

function spreadSlots(
    available: Array<{ staffId: string; time: string }>,
    staffWindows: Map<string, { start: number; end: number }>,
    count: number
): Array<{ staffId: string; time: string }> {
    let globalStart = 1440, globalEnd = 0;
    for (const w of staffWindows.values()) {
        globalStart = Math.min(globalStart, w.start);
        globalEnd = Math.max(globalEnd, w.end);
    }
    if (globalStart >= globalEnd) return available.slice(0, count);

    const zoneCount = 3;
    const zoneSize = Math.floor((globalEnd - globalStart) / zoneCount);
    const perZone = Math.ceil(count / zoneCount);
    const zones: Array<Array<{ staffId: string; time: string }>> = Array.from({ length: zoneCount }, () => []);
    for (const slot of available) {
        const m = parseTimeMin(slot.time);
        const zi = Math.min(Math.floor((m - globalStart) / zoneSize), zoneCount - 1);
        zones[zi].push(slot);
    }
    const result: Array<{ staffId: string; time: string }> = [];
    for (const zone of zones) {
        if (zone.length === 0) continue;
        const step = Math.max(1, Math.floor(zone.length / perZone));
        for (let i = 0; i < zone.length && result.length < count; i += step) result.push(zone[i]);
    }
    if (result.length < count) {
        const used = new Set(result.map((r) => `${r.staffId}|${r.time}`));
        for (const slot of available) {
            if (result.length >= count) break;
            const key = `${slot.staffId}|${slot.time}`;
            if (!used.has(key)) { result.push(slot); used.add(key); }
        }
    }
    return result.sort((a, b) => a.time.localeCompare(b.time)).slice(0, count);
}

function sandwichSuggest(
    available: Array<{ staffId: string; time: string }>,
    appointments: Array<any>,
    blocks: Array<any>,
    staffWindows: Map<string, { start: number; end: number }>,
    durationMinutes: number
): Array<{ staffId: string; time: string }> {
    if (available.length === 0) return [];
    if (available.length <= 6) return [...available];

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

    const totalIntervals = Array.from(intervalsByStaff.values()).reduce((sum, arr) => sum + arr.length, 0);
    if (totalIntervals === 0) return spreadSlots(available, staffWindows, 6);

    const scored = available.map((slot) => {
        const slotStart = parseTimeMin(slot.time);
        const slotEnd = slotStart + durationMinutes;
        const intervals = (intervalsByStaff.get(slot.staffId) || []).sort((a, b) => a.start - b.start);
        const window = staffWindows.get(slot.staffId);
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
            for (const int of intervals) { if (int.end <= slotStart) prevEnd = Math.max(prevEnd, int.end); }
            if (slotStart - prevEnd > 0 && slotStart - prevEnd < durationMinutes) score -= 4;
            let nextStart = window.end;
            for (const int of intervals) { if (int.start >= slotEnd) { nextStart = int.start; break; } }
            if (nextStart - slotEnd > 0 && nextStart - slotEnd < durationMinutes) score -= 4;
        }
        if (window) {
            if (slotStart === window.start) score -= 2;
            if (slotEnd >= window.end - 15) score -= 2;
        }
        return { ...slot, slotStart, score };
    });

    scored.sort((a, b) => b.score !== a.score ? b.score - a.score : a.slotStart - b.slotStart);

    const picked: Array<{ staffId: string; time: string; slotStart: number }> = [];
    for (const item of scored) {
        if (picked.length >= 6) break;
        const nearby = picked.filter((p) => p.staffId === item.staffId && Math.abs(p.slotStart - item.slotStart) < 45);
        if (nearby.length >= 2) continue;
        picked.push(item);
    }
    if (picked.length < 6) {
        const usedKeys = new Set(picked.map((p) => `${p.staffId}|${p.time}`));
        for (const item of scored) {
            if (picked.length >= 6) break;
            const key = `${item.staffId}|${item.time}`;
            if (!usedKeys.has(key)) { picked.push(item); usedKeys.add(key); }
        }
    }
    return picked.sort((a, b) => a.slotStart - b.slotStart).map(({ staffId, time }) => ({ staffId, time }));
}

// ── View available slots: full sandwich implementation ─────────
async function executeViewAvailableSlots(
    supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
    args: any,
    tenantId: string
): Promise<string> {
    const date = args.date as string;
    if (!date) return JSON.stringify({ error: "date zorunludur" });
    const serviceId = args.service_id as string | undefined;
    const staffId = args.staff_id as string | undefined;
    const showAll = args.show_all === true;

    const [year, month, day] = date.split("-").map(Number);
    const localDate = new Date(year, month - 1, day);
    const dayOfWeek = localDate.getDay();

    // 1. Try real RPC first
    let durationMinutes = 30;
    if (serviceId) {
        const { data: svcRow } = await supabase
            .from("services")
            .select("duration_minutes")
            .eq("id", serviceId)
            .maybeSingle();
        if (svcRow?.duration_minutes) durationMinutes = svcRow.duration_minutes;
    }

    const rpcParams: Record<string, unknown> = { p_tenant_id: tenantId, p_date: date };
    if (durationMinutes !== 30) rpcParams.p_duration_minutes = durationMinutes;
    if (staffId) rpcParams.p_staff_id = staffId;

    const { data: rpcData, error: rpcErr } = await supabase.rpc("get_available_slots", rpcParams);

    // If RPC succeeded and returned proper slots, run sandwich on them
    if (!rpcErr && rpcData) {
        const rpcSlots = (rpcData as any).availableSlots;
        if (Array.isArray(rpcSlots) && rpcSlots.length > 0 && rpcSlots[0]?.time) {
            const available = rpcSlots
                .filter((s: any) => s.isAvailable !== false)
                .map((s: any) => ({ staffId: s.staff_id || "", time: String(s.time) }));

            // For RPC path we don't have appt/block data — use spread for now
            const staffWindows = new Map<string, { start: number; end: number }>();
            for (const s of available) {
                if (!staffWindows.has(s.staffId)) {
                    const times = available.filter((x) => x.staffId === s.staffId).map((x) => parseTimeMin(x.time));
                    staffWindows.set(s.staffId, { start: Math.min(...times), end: Math.max(...times) + durationMinutes });
                }
            }
            const recommended = available.length <= 6 ? available : spreadSlots(available as any, staffWindows, 6);
            const slotsToShow = showAll ? available : recommended;
            return JSON.stringify({
                date,
                serviceDurationMinutes: durationMinutes,
                slots: slotsToShow.map(enrichSlot),
                totalAvailable: available.length,
                mode: showAll ? "all" : "recommended",
                ...(!showAll && available.length > slotsToShow.length ? {
                    note: `Toplam ${available.length} boş saat var. Sadece önerilen ${slotsToShow.length} saat gösteriliyor. Müşteri daha fazla isterse show_all: true kullanın.`
                } : {}),
            });
        }
    }

    // 2. Manual fallback with full sandwich scoring
    let whQuery = supabase
        .from("staff_working_hours")
        .select("staff_id, start_time, end_time")
        .eq("tenant_id", tenantId)
        .eq("day_of_week", dayOfWeek)
        .eq("is_off", false);
    if (staffId) whQuery = whQuery.eq("staff_id", staffId);
    const { data: whRows } = await whQuery;
    const workingHours: Array<{ staff_id: string; start_time: string; end_time: string }> = Array.isArray(whRows) ? whRows : [];

    if (workingHours.length === 0) {
        return JSON.stringify({ date, slots: [], totalAvailable: 0, reason: "Çalışma saati tanımlı değil" });
    }

    const startOfDay = `${date}T00:00:00+03:00`;
    const endOfDay = `${date}T23:59:59+03:00`;

    const [{ data: apptRows }, { data: blockRows }] = await Promise.all([
        supabase
            .from("appointments")
            .select("staff_id, start_time, end_time")
            .eq("tenant_id", tenantId)
            .gte("start_time", startOfDay)
            .lt("start_time", endOfDay)
            .in("status", ["booked", "upcoming"]),
        supabase
            .from("staff_time_blocks")
            .select("staff_id, start_at, end_at")
            .eq("tenant_id", tenantId)
            .lte("start_at", endOfDay)
            .gte("end_at", startOfDay),
    ]);
    const appointments = Array.isArray(apptRows) ? apptRows : [];
    const blocks = Array.isArray(blockRows) ? blockRows : [];

    // Build available slot list
    const available: Array<{ staffId: string; time: string }> = [];
    const staffWindows = new Map<string, { start: number; end: number }>();

    for (const wh of workingHours) {
        const start = parseTimeMin(wh.start_time);
        const end = parseTimeMin(wh.end_time);
        staffWindows.set(wh.staff_id, { start, end });

        for (let t = start; t + durationMinutes <= end; t += 15) {
            const timeStr = formatTimeMin(t);
            const slotStart = `${date}T${timeStr}:00+03:00`;
            const slotEndTs = `${date}T${formatTimeMin(t + durationMinutes)}:00+03:00`;

            const conflict = appointments.some(
                (a: any) => a.staff_id === wh.staff_id &&
                    new Date(a.start_time) < new Date(slotEndTs) &&
                    new Date(a.end_time || a.start_time) > new Date(slotStart)
            );
            if (conflict) continue;

            const blocked = blocks.some(
                (b: any) => b.staff_id === wh.staff_id &&
                    new Date(b.start_at) < new Date(slotEndTs) &&
                    new Date(b.end_at) > new Date(slotStart)
            );
            if (blocked) continue;

            available.push({ staffId: wh.staff_id, time: timeStr });
        }
    }

    const recommended = sandwichSuggest(available, appointments, blocks, staffWindows, durationMinutes);
    const slotsToShow = showAll ? available : recommended;

    return JSON.stringify({
        date,
        serviceDurationMinutes: durationMinutes,
        slots: slotsToShow.map(enrichSlot),
        totalAvailable: available.length,
        mode: showAll ? "all" : "recommended",
        ...(!showAll && available.length > slotsToShow.length ? {
            note: `Toplam ${available.length} boş saat var. Sadece önerilen ${slotsToShow.length} saat gösteriliyor. Müşteri daha fazla isterse show_all: true kullanın.`
        } : {}),
    });
}

// ── Check specific slot: narrow tolerance window search ───────
async function executeCheckSpecificSlot(
    supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
    args: any,
    tenantId: string
): Promise<string> {
    const date = typeof args.date === "string" ? args.date : "";
    const requestedRaw = typeof args.requested_time === "string" ? args.requested_time : "";
    const serviceId = typeof args.service_id === "string" ? args.service_id : undefined;
    const staffId = typeof args.staff_id === "string" ? args.staff_id : undefined;
    const tolerance = typeof args.tolerance_minutes === "number" ? args.tolerance_minutes : 30;

    if (!date || !requestedRaw) {
        return JSON.stringify({ error: "date ve requested_time zorunludur" });
    }
    const requestedTime = normalizeSlotTime(requestedRaw);
    if (!requestedTime) {
        return JSON.stringify({ error: `Saat formatı anlaşılamadı: "${requestedRaw}". HH:MM formatında girin.` });
    }

    let durationMinutes = 30;
    if (serviceId) {
        const { data: svcRow } = await supabase.from("services").select("duration_minutes").eq("id", serviceId).maybeSingle();
        if (svcRow?.duration_minutes) durationMinutes = svcRow.duration_minutes;
    }

    const [year, month, day] = date.split("-").map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay();

    let whQuery = supabase
        .from("staff_working_hours")
        .select("staff_id, start_time, end_time")
        .eq("tenant_id", tenantId)
        .eq("day_of_week", dayOfWeek)
        .eq("is_off", false);
    if (staffId) whQuery = whQuery.eq("staff_id", staffId);
    const { data: whRows } = await whQuery;
    const workingHours: Array<{ staff_id: string; start_time: string; end_time: string }> = Array.isArray(whRows) ? whRows : [];

    if (workingHours.length === 0) {
        return JSON.stringify({ requested: requestedTime, slot_unavailable: true, reason: "Bu tarih için çalışma saati tanımlı değil." });
    }

    const startOfDay = `${date}T00:00:00+03:00`;
    const endOfDay = `${date}T23:59:59+03:00`;
    const [{ data: apptRows }, { data: blockRows }] = await Promise.all([
        supabase.from("appointments").select("staff_id, start_time, end_time")
            .eq("tenant_id", tenantId).gte("start_time", startOfDay).lt("start_time", endOfDay)
            .in("status", ["booked", "upcoming"]),
        supabase.from("staff_time_blocks").select("staff_id, start_at, end_at")
            .eq("tenant_id", tenantId).lte("start_at", endOfDay).gte("end_at", startOfDay),
    ]);
    const appointments = Array.isArray(apptRows) ? apptRows : [];
    const blocks = Array.isArray(blockRows) ? blockRows : [];

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
                (a: any) => a.staff_id === wh.staff_id &&
                    new Date(a.start_time) < new Date(slotEndTs) &&
                    new Date(a.end_time || a.start_time) > new Date(slotStart)
            );
            if (conflict) continue;
            const blocked = blocks.some(
                (b: any) => b.staff_id === wh.staff_id &&
                    new Date(b.start_at) < new Date(slotEndTs) &&
                    new Date(b.end_at) > new Date(slotStart)
            );
            if (blocked) continue;
            candidates.push({ staffId: wh.staff_id, time: timeStr, distanceMin: Math.abs(t - requestedMin) });
        }
    }

    if (candidates.length === 0) {
        return JSON.stringify({
            requested: requestedTime,
            slot_unavailable: true,
            reason: `${requestedTime} ±${tolerance} dakika içinde boş saat yok.`,
            suggestion: "Müşteriye farklı bir saat veya gün önerin, ya da view_available_slots ile geniş öneriler alın.",
        });
    }

    candidates.sort((a, b) => a.distanceMin !== b.distanceMin ? a.distanceMin - b.distanceMin : a.time.localeCompare(b.time));
    const exactMatch = candidates.find((c) => c.distanceMin === 0);
    const nearest = candidates[0];
    const alternatives = candidates
        .filter((c) => c.time !== nearest.time)
        .slice(0, 3)
        .map((c) => enrichSlot({ staffId: c.staffId, time: c.time }));

    return JSON.stringify({
        requested: requestedTime,
        exact_match: !!exactMatch,
        nearest_available: enrichSlot({ staffId: nearest.staffId, time: nearest.time }),
        alternatives,
        slot_unavailable: false,
        guide: exactMatch
            ? `${requestedTime} saati uygun! Onay gelirse randevu oluşturabilirsin.`
            : `${requestedTime} dolu. En yakın: ${nearest.time}. Müşteriye sor.`,
    });
}

function normalizeSlotTime(raw: string): string | null {
    const t = raw.trim();
    if (/^\d{1,2}:\d{2}$/.test(t)) {
        const [h, m] = t.split(":").map(Number);
        if (h >= 0 && h < 24 && m >= 0 && m < 60) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    if (/^\d{1,2}$/.test(t)) {
        const h = Number(t);
        if (h >= 0 && h < 24) return `${String(h).padStart(2, "0")}:00`;
    }
    if (/^\d{4}$/.test(t)) {
        const h = Number(t.slice(0, 2)), m = Number(t.slice(2));
        if (h >= 0 && h < 24 && m >= 0 && m < 60) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return null;
}

// ── Tool execution functions ────────────────────────────────
// Supabase config for @musait/tools (REST API, service role)
function getSupabaseConfig(): SupabaseConfig {
    return {
        url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "",
    };
}

async function executeToolCall(toolName: string, args: any, tenantId: string, customerPhone: string): Promise<string> {
    const supabase = await createClient();
    const sbConfig = getSupabaseConfig();

    try {
        switch (toolName) {
            // ── Delegated to @musait/tools (identical to Worker) ────────
            case "list_services": {
                const result = await listServices(sbConfig, args, { tenantId });
                return JSON.stringify(result);
            }
            case "list_staff": {
                const result = await listStaff(sbConfig, args, { tenantId });
                return JSON.stringify(result);
            }
            case "get_business_info": {
                const result = await getBusinessInfo(sbConfig, args, { tenantId });
                return JSON.stringify(result);
            }
            case "view_available_slots": {
                const result = await viewAvailableSlots(sbConfig, args, { tenantId, conversationId: "", customerPhone });
                return JSON.stringify(result);
            }
            case "check_specific_slot": {
                const result = await checkSpecificSlot(sbConfig, args, { tenantId });
                return JSON.stringify(result);
            }
            case "list_customer_appointments": {
                const result = await listCustomerAppointments(sbConfig, args, { tenantId, customerPhone });
                return JSON.stringify(result);
            }
            case "create_appointment": {
                const result = await createAppointment(sbConfig, args, {
                    tenantId,
                    conversationId: "",
                    customerPhone,
                    customerName: args.customer_name,
                });
                return JSON.stringify(result);
            }
            case "create_appointments_batch": {
                const result = await createAppointmentsBatch(sbConfig, args, { tenantId, customerPhone, customerName: args.customer_name });
                return JSON.stringify(result);
            }
            case "cancel_appointment": {
                const result = await cancelAppointment(sbConfig, args, { tenantId, conversationId: "", customerPhone });
                return JSON.stringify(result);
            }
            case "suggest_least_busy_staff": {
                const result = await suggestLeastBusyStaff(sbConfig, args, { tenantId });
                return JSON.stringify(result);
            }
            case "compose_interactive_message": {
                const result = await composeInteractiveMessage(args);
                return JSON.stringify(result);
            }

            // ── Test Lab-specific / simulated tools ─────────────────────
            case "get_customer_profile": {
                const cpNormalized = customerPhone.replace(/\s+/g, '').replace(/^0/, '+90');
                const cpVariants = [
                    customerPhone, cpNormalized,
                    customerPhone.replace(/^\+90/, '0'),
                    customerPhone.replace(/^\+/, ''),
                ];

                const { data: cpCustomer } = await supabase
                    .from("customers")
                    .select("id, name, phone, created_at")
                    .eq("tenant_id", tenantId)
                    .in("phone", cpVariants)
                    .limit(1)
                    .maybeSingle();

                if (!cpCustomer) {
                    return JSON.stringify({
                        found: false,
                        customer_phone: customerPhone,
                        message: "Bu telefon numarasına ait müşteri bulunamadı. Yeni müşteri olabilir."
                    });
                }

                const { data: pastApts } = await supabase
                    .from("appointments")
                    .select("start_time, status, services(name), staff(name)")
                    .eq("customer_id", cpCustomer.id)
                    .eq("tenant_id", tenantId)
                    .order("start_time", { ascending: false })
                    .limit(5);

                const recentServices = [...new Set((pastApts || []).map((a: any) => a.services?.name).filter(Boolean))];

                return JSON.stringify({
                    found: true,
                    customer_name: cpCustomer.name || "İsim kaydedilmemiş",
                    customer_phone: cpCustomer.phone,
                    total_appointments: (pastApts || []).length,
                    recent_services: recentServices,
                    registered_since: cpCustomer.created_at,
                });
            }

            case "take_notes_for_user": {
                const note = args.note as string;
                if (!note?.trim()) {
                    return JSON.stringify({ success: false, error: "Not içeriği boş olamaz." });
                }

                const tnPhoneVariants = [
                    customerPhone,
                    customerPhone.replace(/^\+90/, '0'),
                    customerPhone.replace(/^\+/, ''),
                ];
                const { data: tnCustomer } = await supabase
                    .from("customers")
                    .select("id")
                    .eq("tenant_id", tenantId)
                    .in("phone", tnPhoneVariants)
                    .limit(1)
                    .maybeSingle();

                if (tnCustomer) {
                    const timestampedNote = `[${new Date().toLocaleDateString("tr-TR")}] ${note.trim()}`;
                    const { data: existingCust } = await supabase
                        .from("customers")
                        .select("notes")
                        .eq("id", tnCustomer.id)
                        .single();

                    const existingNotes = (existingCust as any)?.notes || "";
                    const newNotes = existingNotes ? `${existingNotes}\n${timestampedNote}` : timestampedNote;

                    await supabase
                        .from("customers")
                        .update({ notes: newNotes } as any)
                        .eq("id", tnCustomer.id);
                }

                return JSON.stringify({ success: true, note: note.trim(), message: "Not kaydedildi." });
            }

            case "update_customer_name": {
                const ucFirstName = (args.first_name as string | undefined)?.trim();
                const ucLastName = (args.last_name as string | undefined)?.trim();

                if (!ucFirstName && !ucLastName) {
                    return JSON.stringify({ success: false, error: "Ad veya soyad belirtilmeli." });
                }

                const ucPhoneVariants = [
                    customerPhone,
                    customerPhone.replace(/^\+90/, '0'),
                    customerPhone.replace(/^\+/, ''),
                ];
                const { data: ucCustomer } = await supabase
                    .from("customers")
                    .select("id, name")
                    .eq("tenant_id", tenantId)
                    .in("phone", ucPhoneVariants)
                    .limit(1)
                    .maybeSingle();

                let existingFirst = "";
                let existingLast = "";
                if (ucCustomer?.name) {
                    const parts = ucCustomer.name.trim().split(/\s+/);
                    existingFirst = parts[0] ?? "";
                    existingLast = parts.slice(1).join(" ") || "";
                }

                const newFirst = ucFirstName || existingFirst;
                const newLast = ucLastName || existingLast;
                const fullName = [newFirst, newLast].filter(Boolean).join(" ").trim();

                if (ucCustomer && fullName) {
                    await supabase
                        .from("customers")
                        .update({ name: fullName })
                        .eq("id", ucCustomer.id);
                }

                return JSON.stringify({
                    success: true,
                    fullName: fullName || "(boş)",
                    message: `İsim güncellendi: ${fullName}`,
                });
            }

            case "list_businesses":
                return JSON.stringify({ businesses: [{ tenantId: tenantId, tenantName: "Test İşletmesi" }] });
            case "bind_tenant":
                return JSON.stringify({ success: true, tenant_id: args.tenant_id || tenantId });
            case "ask_human":
                return JSON.stringify({ success: true, message: "Test ortamında handoff simüle edildi." });
            case "end_session":
                return JSON.stringify({ success: true, message: "Test ortamında oturum sonlandırıldı." });

            default:
                return JSON.stringify({
                    error: `Tool '${toolName}' test ortamında desteklenmiyor`,
                    supported_tools: [
                        "list_services", "list_staff", "get_business_info",
                        "list_customer_appointments", "view_available_slots", "check_specific_slot",
                        "create_appointment", "create_appointments_batch", "cancel_appointment",
                        "suggest_least_busy_staff", "compose_interactive_message",
                        "list_businesses", "bind_tenant", "ask_human", "end_session",
                        "take_notes_for_user", "update_customer_name", "get_customer_profile",
                    ]
                });
        }
    } catch (error) {
        console.error(`Tool execution error (${toolName}):`, error);
        return JSON.stringify({ error: `Tool execution failed: ${error instanceof Error ? error.message : "Unknown error"}` });
    }
}



export async function POST(req: Request) {
    try {
        const { messages, model, tenantId, system, phone } = await req.json();

        console.log("[Test Lab] Request: model=%s tenant=%s", model, tenantId);

        if (!tenantId) {
            return NextResponse.json({ error: "Test işletmesi seçmelisiniz" }, { status: 400 });
        }

        const supabase = await createClient();
        const openRouterModel = model || "google/gemini-flash-1.5";
        const testPhone = phone || "+905550000000";
        const resolved = await resolveModelTestPromptContext({
            supabase,
            tenantId,
            phone: testPhone,
            systemPrompt: system || "",
        });
        const finalSystemPrompt = resolved.resolvedPrompt;

        // Build initial conversation
        const currentMessages: any[] = [
            { role: "system", content: finalSystemPrompt },
            ...messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
        ];

        let totalMs = 0;
        let totalTokens = { prompt: 0, completion: 0, total: 0 };
        const maxIterations = 5;

        // Create SSE output stream upfront — all events flow through this
        const encoder = new TextEncoder();
        const outputStream = new ReadableStream({
            async start(controller) {
                const emit = (obj: Record<string, unknown>) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
                };

                try {
                    for (let iteration = 1; iteration <= maxIterations; iteration++) {
                        console.log(`[Test Lab] Iteration ${iteration}`);

                        const payload: Record<string, unknown> = {
                            model: openRouterModel,
                            messages: currentMessages,
                            tools: getToolDefinitions(),
                            temperature: 0.7,
                            max_tokens: 4096,
                            stream: true,
                        };
                        if (supportsReasoning(openRouterModel)) {
                            payload.reasoning = { enabled: true, effort: "medium", exclude: false };
                        }

                        const t0 = Date.now();
                        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                                "Content-Type": "application/json",
                                "HTTP-Referer": "https://musait.app",
                                "X-Title": "Musait Test Lab",
                            },
                            body: JSON.stringify(payload),
                        });

                        if (!response.ok) {
                            const errText = await response.text();
                            emit({ type: "error", error: `Model API hatası (${response.status}): ${errText}` });
                            break;
                        }

                        if (!response.body) {
                            emit({ type: "error", error: "Stream body yok" });
                            break;
                        }

                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();

                        let accContent = "";
                        let accReasoning = "";
                        const accToolCalls: any[] = [];
                        let firstTokenEmitted = false;

                        // ── Stream OpenRouter deltas directly to client ──
                        let partial = "";
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            partial += decoder.decode(value, { stream: true });
                            const lines = partial.split("\n");
                            partial = lines.pop() || ""; // keep incomplete line

                            for (const line of lines) {
                                const trimmed = line.trim();
                                if (!trimmed.startsWith("data: ")) continue;
                                const data = trimmed.slice(6);
                                if (data === "[DONE]") continue;

                                try {
                                    const parsed = JSON.parse(data);
                                    const choice = parsed.choices?.[0];
                                    const delta = choice?.delta;

                                    // ── Content tokens → forward immediately ──
                                    if (delta?.content) {
                                        if (!firstTokenEmitted) {
                                            firstTokenEmitted = true;
                                        }
                                        accContent += delta.content;
                                        emit({ type: "content", content: delta.content });
                                    }

                                    // ── Reasoning tokens → forward immediately ──
                                    const reasoning = delta?.reasoning || delta?.reasoning_content || delta?.thinking;
                                    if (reasoning) {
                                        accReasoning += reasoning;
                                        emit({ type: "reasoning", reasoning });
                                    }

                                    // ── Tool calls → accumulate ──
                                    if (delta?.tool_calls) {
                                        for (const tc of delta.tool_calls) {
                                            const idx = tc.index ?? 0;
                                            if (!accToolCalls[idx]) {
                                                accToolCalls[idx] = {
                                                    id: tc.id || "",
                                                    type: "function",
                                                    function: { name: "", arguments: "" },
                                                };
                                            }
                                            if (tc.id) accToolCalls[idx].id = tc.id;
                                            if (tc.function?.name) accToolCalls[idx].function.name += tc.function.name;
                                            if (tc.function?.arguments) accToolCalls[idx].function.arguments += tc.function.arguments;
                                        }
                                    }

                                    // ── Token usage ──
                                    if (parsed.usage) {
                                        totalTokens.prompt = parsed.usage.prompt_tokens || totalTokens.prompt;
                                        totalTokens.completion = parsed.usage.completion_tokens || totalTokens.completion;
                                        totalTokens.total = parsed.usage.total_tokens || totalTokens.total;
                                    }
                                } catch {
                                    // skip invalid json
                                }
                            }
                        }

                        totalMs += Date.now() - t0;
                        const validToolCalls = accToolCalls.filter(tc => tc.id && tc.function.name);

                        console.log(`[Test Lab] Iter ${iteration}: content=${accContent.length}c, reasoning=${accReasoning.length}c, tools=${validToolCalls.length}`);

                        // ── If no tool calls → we're done ──
                        if (validToolCalls.length === 0) {
                            break;
                        }

                        // ── Execute tool calls with timing ──
                        currentMessages.push({
                            role: "assistant",
                            content: accContent || "",
                            tool_calls: validToolCalls,
                        });

                        for (const toolCall of validToolCalls) {
                            const toolName = toolCall.function.name;
                            let toolArgs: any = {};
                            try {
                                toolArgs = JSON.parse(toolCall.function.arguments);
                            } catch {
                                // skip
                            }

                            // Emit tool_call event to client
                            emit({
                                type: "tool_call",
                                id: toolCall.id,
                                name: toolName,
                                arguments: toolArgs,
                            });

                            const toolStart = Date.now();
                            const result = await executeToolCall(toolName, toolArgs, tenantId, testPhone);
                            const durationMs = Date.now() - toolStart;

                            // Emit tool_result event to client
                            let parsedResult: unknown;
                            try { parsedResult = JSON.parse(result); } catch { parsedResult = result; }
                            emit({
                                type: "tool_result",
                                tool_call_id: toolCall.id,
                                name: toolName,
                                result: parsedResult,
                                durationMs,
                            });

                            currentMessages.push({
                                role: "tool",
                                tool_call_id: toolCall.id,
                                name: toolName,
                                content: result,
                            });
                        }

                        // Continue loop → next OpenRouter call (streamed directly)
                    }

                    // ── Emit final metrics ──
                    const tokensPerSec = totalTokens.completion && totalMs > 0
                        ? parseFloat((totalTokens.completion / (totalMs / 1000)).toFixed(1))
                        : 0;

                    emit({
                        type: "metrics",
                        metrics: {
                            totalMs,
                            tokensPerSec,
                            promptTokens: totalTokens.prompt,
                            completionTokens: totalTokens.completion,
                            totalTokens: totalTokens.total,
                            iterations: Math.min(maxIterations, maxIterations),
                        },
                    });

                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                } catch (err) {
                    console.error("[Test Lab] Stream error:", err);
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: "error",
                            error: err instanceof Error ? err.message : "Bilinmeyen hata",
                        })}\n\n`));
                        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    } catch {
                        // controller may be closed
                    }
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(outputStream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        });
    } catch (error) {
        console.error("Model Test Error:", error);
        return NextResponse.json(
            { error: "Modele bağlanılamadı. OPENROUTER_API_KEY'ini kontrol et." },
            { status: 500 }
        );
    }
}
