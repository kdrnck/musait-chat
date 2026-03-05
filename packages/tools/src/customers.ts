/**
 * Shared SupabaseConfig used by all @musait/tools functions.
 * Workers pass { url: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_KEY }.
 * The Test Lab (Next.js) passes the same from its own env vars.
 */
export interface SupabaseConfig {
    url: string;
    serviceKey: string;
}

export interface TenantCustomer {
    id: string;
    name: string | null;
}

function makeHeaders(
    config: SupabaseConfig,
    withJson = false
): Record<string, string> {
    const base: Record<string, string> = {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
    };
    if (withJson) {
        base["Content-Type"] = "application/json";
        base.Prefer = "return=representation";
    }
    return base;
}

export async function getCustomerByPhone(
    config: SupabaseConfig,
    tenantId: string,
    customerPhone: string
): Promise<TenantCustomer | null> {
    const url = new URL(`${config.url}/rest/v1/customers`);
    url.searchParams.set("tenant_id", `eq.${tenantId}`);
    url.searchParams.set("phone", `eq.${customerPhone}`);
    url.searchParams.set("select", "id,name");
    url.searchParams.set("limit", "1");

    const response = await fetch(url.toString(), {
        headers: makeHeaders(config),
    });
    if (!response.ok) return null;

    const rows = (await response.json()) as Array<TenantCustomer>;
    return rows[0] ?? null;
}

export async function createCustomer(
    config: SupabaseConfig,
    tenantId: string,
    customerPhone: string,
    customerName?: string | null
): Promise<TenantCustomer | null> {
    const response = await fetch(`${config.url}/rest/v1/customers`, {
        method: "POST",
        headers: makeHeaders(config, true),
        body: JSON.stringify({
            tenant_id: tenantId,
            phone: customerPhone,
            name: customerName ?? null,
        }),
    });

    if (!response.ok) return null;
    const rows = (await response.json()) as Array<TenantCustomer>;
    return rows[0] ?? null;
}

export async function updateCustomerNameInDb(
    config: SupabaseConfig,
    customerId: string,
    customerName: string
): Promise<boolean> {
    const response = await fetch(
        `${config.url}/rest/v1/customers?id=eq.${customerId}`,
        {
            method: "PATCH",
            headers: makeHeaders(config, true),
            body: JSON.stringify({ name: customerName }),
        }
    );
    return response.ok;
}

export async function ensureCustomerRecord(
    config: SupabaseConfig,
    args: {
        tenantId: string;
        customerPhone: string;
        customerName?: string | null;
    }
): Promise<TenantCustomer | null> {
    const existing = await getCustomerByPhone(config, args.tenantId, args.customerPhone);
    if (existing) return existing;
    return createCustomer(config, args.tenantId, args.customerPhone, args.customerName);
}
