import type { SupabaseConfig } from "./customers";
import { getCustomerByPhone } from "./customers";

interface ToolContext {
    tenantId: string;
    customerPhone: string;
}

export async function listCustomerAppointments(
    config: SupabaseConfig,
    args: Record<string, unknown>,
    ctx: ToolContext
): Promise<unknown> {
    const onlyFuture = args.only_future !== false;
    const includeCancelled = Boolean(args.include_cancelled);
    const limitRaw = Number(args.limit);
    const limit =
        Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 20) : 10;

    const customer = await getCustomerByPhone(
        config,
        ctx.tenantId,
        ctx.customerPhone
    );
    if (!customer) {
        return {
            total: 0,
            appointments: [],
            message: "Bu numaraya ait kayÄ±tlÄ± mÃ¼ÅŸteri bulunamadÄ±.",
        };
    }

    const url = new URL(`${config.url}/rest/v1/appointments`);
    url.searchParams.set("tenant_id", `eq.${ctx.tenantId}`);
    url.searchParams.set("customer_id", `eq.${customer.id}`);
    if (!includeCancelled) {
        url.searchParams.set("status", "neq.cancelled");
    }
    if (onlyFuture) {
        url.searchParams.set(
            "start_time",
            `gte.${new Date().toISOString()}`
        );
    }
    url.searchParams.set(
        "select",
        "id,start_time,status,service:services(id,name),staff:staff(id,name)"
    );
    url.searchParams.set("order", "start_time.asc");
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url.toString(), {
        headers: {
            apikey: config.serviceKey,
            Authorization: `Bearer ${config.serviceKey}`,
        },
    });

    if (!response.ok) {
        return { error: "MÃ¼ÅŸteri randevularÄ± alÄ±namadÄ±." };
    }

    const rows = (await response.json()) as Array<{
        id: string;
        start_time: string;
        status: string;
        service?: { id?: string; name?: string } | null;
        staff?: { id?: string; name?: string } | null;
    }>;

    return {
        customer: {
            id: customer.id,
            name: customer.name,
            phone: ctx.customerPhone,
        },
        total: rows.length,
        appointments: rows.map((row) => ({
            id: row.id,
            start_time: row.start_time,
            status: row.status,
            service: row.service
                ? { id: row.service.id, name: row.service.name }
                : null,
            staff: row.staff ? { id: row.staff.id, name: row.staff.name } : null,
        })),
    };
}
