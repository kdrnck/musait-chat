import type { SupabaseConfig } from "./customers";

interface ToolContext {
    tenantId: string;
}

/**
 * suggest_least_busy_staff
 * Returns least-booked staff candidates for a given day + service.
 */
export async function suggestLeastBusyStaff(
    config: SupabaseConfig,
    args: Record<string, unknown>,
    ctx: ToolContext
): Promise<unknown> {
    const date = args.date as string;
    const serviceId = args.service_id as string;

    if (!date || !serviceId) {
        return { error: "Tarih ve hizmet bilgisi zorunludur." };
    }

    const response = await fetch(
        `${config.url}/rest/v1/rpc/get_least_booked_staff_for_service_on_date`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: config.serviceKey,
                Authorization: `Bearer ${config.serviceKey}`,
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
            error: "Personel Ã¶nerisi alÄ±namadÄ±.",
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
    };
}
