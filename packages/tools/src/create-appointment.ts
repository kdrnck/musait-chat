import type { SupabaseConfig } from "./customers";
import {
    getCustomerByPhone,
    createCustomer,
    updateCustomerNameInDb,
} from "./customers";
import { validateToolArgs, CREATE_APPOINTMENT_FIELDS } from "./validate";

interface ToolContext {
    tenantId: string;
    conversationId: string;
    customerPhone: string;
    customerName?: string;
}

async function resolveProfileIdByPhone(
    config: SupabaseConfig,
    customerPhone: string
): Promise<string | null> {
    const url = new URL(`${config.url}/rest/v1/profiles`);
    url.searchParams.set("phone_e164", `eq.${customerPhone}`);
    url.searchParams.set("select", "id");
    url.searchParams.set("limit", "1");

    const response = await fetch(url.toString(), {
        headers: {
            apikey: config.serviceKey,
            Authorization: `Bearer ${config.serviceKey}`,
        },
    });

    if (!response.ok) {
        return null;
    }

    const rows = (await response.json()) as Array<{ id?: string }>;
    return rows[0]?.id ?? null;
}

/**
 * create_appointment - Creates a new appointment via Supabase REST API.
 *
 * IMPORTANT: Agent MUST get explicit customer confirmation before calling this.
 */
export async function createAppointment(
    config: SupabaseConfig,
    args: Record<string, unknown>,
    ctx: ToolContext
): Promise<unknown> {
    const validation = validateToolArgs(args, CREATE_APPOINTMENT_FIELDS);
    if (!validation.valid) {
        return { error: validation.error };
    }

    const serviceId = validation.data.service_id as string;
    const staffId = validation.data.staff_id as string;
    const rawStartTime = validation.data.start_time as string;

    // Timezone guard: coerce to Istanbul time (+03:00) when no TZ is present.
    let startTime = rawStartTime;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rawStartTime)) {
        startTime = `${rawStartTime}:00+03:00`;
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(rawStartTime)) {
        startTime = `${rawStartTime}+03:00`;
    }

    const customerName =
        (validation.data.customer_name as string | undefined)?.trim() ||
        ctx.customerName;

    const headers = {
        "Content-Type": "application/json",
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        Prefer: "return=representation",
    };

    // 1. Find or create customer by phone
    const existingCustomer = await getCustomerByPhone(
        config,
        ctx.tenantId,
        ctx.customerPhone
    );
    let customerId: string;

    if (existingCustomer) {
        customerId = existingCustomer.id;

        if (!existingCustomer.name && !customerName) {
            return {
                error:
                    "Randevuyu tamamlamadan Ã¶nce adÄ±nÄ±zÄ± ekleyebilir miyim? AdÄ±nÄ±zÄ± paylaÅŸÄ±r mÄ±sÄ±nÄ±z?",
                code: "missing_customer_name",
            };
        }

        if (
            customerName &&
            (!existingCustomer.name ||
                existingCustomer.name.toLocaleLowerCase("tr-TR") !==
                customerName.toLocaleLowerCase("tr-TR"))
        ) {
            await updateCustomerNameInDb(config, existingCustomer.id, customerName);
        }
    } else {
        if (!customerName) {
            return {
                error:
                    "Randevuyu tamamlamadan Ã¶nce adÄ±nÄ±zÄ± ekleyebilir miyim? AdÄ±nÄ±zÄ± paylaÅŸÄ±r mÄ±sÄ±nÄ±z?",
                code: "missing_customer_name",
            };
        }

        const created = await createCustomer(
            config,
            ctx.tenantId,
            ctx.customerPhone,
            customerName
        );
        if (!created) {
            return { error: "MÃ¼ÅŸteri kaydÄ± oluÅŸturulamadÄ±." };
        }
        customerId = created.id;
    }

    // 2. Get service duration for end_time calculation
    const svcUrl = new URL(`${config.url}/rest/v1/services`);
    svcUrl.searchParams.set("id", `eq.${serviceId}`);
    svcUrl.searchParams.set("select", "duration_minutes,name");

    const svcRes = await fetch(svcUrl.toString(), { headers });
    const services = await svcRes.json();
    const service = services[0];

    if (!service) {
        return { error: "Hizmet bulunamadÄ±." };
    }

    const duration = service.duration_minutes || 30;
    const startDate = new Date(startTime);
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

    const profileId = await resolveProfileIdByPhone(config, ctx.customerPhone);

    const appointmentPayload: Record<string, unknown> = {
        tenant_id: ctx.tenantId,
        service_id: serviceId,
        staff_id: staffId,
        customer_id: customerId,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        status: "booked",
        source: "whatsapp",
        notes: `WhatsApp Ã¼zerinden oluÅŸturuldu (${ctx.customerPhone})`,
    };

    // Keep ownership linkage for profile history screens that rely on created_by.
    if (profileId) {
        appointmentPayload.created_by = profileId;
    }

    // 3. Create appointment
    const apptRes = await fetch(`${config.url}/rest/v1/appointments`, {
        method: "POST",
        headers,
        body: JSON.stringify(appointmentPayload),
    });

    if (!apptRes.ok) {
        const errText = await apptRes.text();
        console.error("Appointment creation failed:", errText);

        const isSlotConflict =
            errText.toLowerCase().includes("conflict") ||
            errText.toLowerCase().includes("overlap") ||
            errText.toLowerCase().includes("duplicate") ||
            errText.toLowerCase().includes("already booked") ||
            apptRes.status === 409;

        if (isSlotConflict) {
            return {
                error: "Bu saat artÄ±k dolu gÃ¶rÃ¼nÃ¼yor. LÃ¼tfen baÅŸka bir saat seÃ§in.",
                code: "slot_taken",
            };
        }

        return { error: "Randevu oluÅŸturulamadÄ±. LÃ¼tfen tekrar deneyin." };
    }

    const appointment = await apptRes.json();

    if (
        !Array.isArray(appointment) ||
        appointment.length === 0 ||
        !appointment[0]?.id
    ) {
        console.error(
            "Appointment creation returned empty/invalid response:",
            JSON.stringify(appointment)
        );
        return {
            error:
                "Randevu oluÅŸturulamadÄ±. Sunucu boÅŸ yanÄ±t dÃ¶ndÃ¼. LÃ¼tfen tekrar deneyin.",
        };
    }

    return {
        success: true,
        appointmentId: appointment[0].id,
        serviceName: service.name,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        message: `Randevunuz baÅŸarÄ±yla oluÅŸturuldu: ${service.name}, ${startDate.toLocaleDateString("tr-TR")} ${startDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
    };
}
