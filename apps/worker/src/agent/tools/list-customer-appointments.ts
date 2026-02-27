import { SUPABASE_CONFIG } from "../../config.js";
import { getCustomerByPhone } from "../../services/customers.js";

interface ToolContext {
  tenantId: string;
  customerPhone: string;
}

export async function listCustomerAppointments(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const onlyFuture = args.only_future !== false;
  const includeCancelled = Boolean(args.include_cancelled);
  const limitRaw = Number(args.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 20) : 10;

  const customer = await getCustomerByPhone(ctx.tenantId, ctx.customerPhone);
  if (!customer) {
    return {
      total: 0,
      appointments: [],
      message: "Bu numaraya ait kayıtlı müşteri bulunamadı.",
    };
  }

  const url = new URL(`${SUPABASE_CONFIG.url}/rest/v1/appointments`);
  url.searchParams.set("tenant_id", `eq.${ctx.tenantId}`);
  url.searchParams.set("customer_id", `eq.${customer.id}`);
  if (!includeCancelled) {
    url.searchParams.set("status", "neq.cancelled");
  }
  if (onlyFuture) {
    url.searchParams.set("start_time", `gte.${new Date().toISOString()}`);
  }
  url.searchParams.set(
    "select",
    "id,start_time,end_time,status,notes,service:services(id,name),staff:staff(id,name)"
  );
  url.searchParams.set("order", "start_time.asc");
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_CONFIG.serviceKey,
      Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
    },
  });

  if (!response.ok) {
    return { error: "Müşteri randevuları alınamadı." };
  }

  const rows = (await response.json()) as Array<{
    id: string;
    start_time: string;
    end_time: string | null;
    status: string;
    notes?: string | null;
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
      end_time: row.end_time,
      status: row.status,
      service: row.service
        ? { id: row.service.id, name: row.service.name }
        : null,
      staff: row.staff ? { id: row.staff.id, name: row.staff.name } : null,
      notes: row.notes || null,
    })),
  };
}
