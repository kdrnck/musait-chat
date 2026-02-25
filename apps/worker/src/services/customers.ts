import { SUPABASE_CONFIG } from "../config.js";

export interface TenantCustomer {
  id: string;
  name: string | null;
}

function headers(withJson = false): Record<string, string> {
  const base: Record<string, string> = {
    apikey: SUPABASE_CONFIG.serviceKey,
    Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
  };
  if (withJson) {
    base["Content-Type"] = "application/json";
    base.Prefer = "return=representation";
  }
  return base;
}

export async function getCustomerByPhone(
  tenantId: string,
  customerPhone: string
): Promise<TenantCustomer | null> {
  const url = new URL(`${SUPABASE_CONFIG.url}/rest/v1/customers`);
  url.searchParams.set("tenant_id", `eq.${tenantId}`);
  url.searchParams.set("phone", `eq.${customerPhone}`);
  url.searchParams.set("select", "id,name");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), { headers: headers() });
  if (!response.ok) return null;

  const rows = (await response.json()) as Array<TenantCustomer>;
  return rows[0] ?? null;
}

export async function createCustomer(
  tenantId: string,
  customerPhone: string,
  customerName?: string | null
): Promise<TenantCustomer | null> {
  const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/customers`, {
    method: "POST",
    headers: headers(true),
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

export async function updateCustomerName(
  customerId: string,
  customerName: string
): Promise<boolean> {
  const response = await fetch(
    `${SUPABASE_CONFIG.url}/rest/v1/customers?id=eq.${customerId}`,
    {
      method: "PATCH",
      headers: headers(true),
      body: JSON.stringify({ name: customerName }),
    }
  );

  return response.ok;
}

export async function ensureCustomerRecord(args: {
  tenantId: string;
  customerPhone: string;
  customerName?: string | null;
}): Promise<TenantCustomer | null> {
  const existing = await getCustomerByPhone(args.tenantId, args.customerPhone);
  if (existing) return existing;
  return createCustomer(args.tenantId, args.customerPhone, args.customerName);
}
