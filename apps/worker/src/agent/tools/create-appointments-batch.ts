import { SUPABASE_CONFIG } from "../../config.js";

interface ToolContext {
  tenantId: string;
  customerPhone: string;
  customerName?: string;
}

function normalizeServiceNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return defaultValue;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isHourMinute(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

async function resolveStaffIdByName(
  tenantId: string,
  staffName: string
): Promise<{ staffId?: string; error?: string; code?: string }> {
  const url = new URL(`${SUPABASE_CONFIG.url}/rest/v1/staff`);
  url.searchParams.set("tenant_id", `eq.${tenantId}`);
  url.searchParams.set("is_active", "eq.true");
  url.searchParams.set("select", "id,name");

  const response = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_CONFIG.serviceKey,
      Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
    },
  });

  if (!response.ok) {
    return {
      error: "Personel doğrulaması yapılamadı.",
      code: "staff_lookup_failed",
    };
  }

  const rows = (await response.json()) as Array<{ id: string; name: string }>;
  const normalizedInput = staffName.trim().toLocaleLowerCase("tr-TR");
  const matches = rows.filter(
    (staff) => staff.name.trim().toLocaleLowerCase("tr-TR") === normalizedInput
  );

  if (matches.length === 0) {
    return {
      error: `"${staffName}" isimli bir personel bulunamadı.`,
      code: "staff_not_found",
    };
  }

  if (matches.length > 1) {
    return {
      error: `"${staffName}" birden fazla personel ile eşleşti. Lütfen daha net bir isim verin.`,
      code: "staff_ambiguous",
    };
  }

  return { staffId: matches[0].id };
}

export async function createAppointmentsBatch(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const serviceNames = normalizeServiceNames(args.service_names);
  const date = typeof args.date === "string" ? args.date.trim() : "";
  const startTime = typeof args.start_time === "string" ? args.start_time.trim() : "";
  const requireAtomic = normalizeBoolean(args.require_atomic, true);

  if (serviceNames.length === 0) {
    return {
      success: false,
      code: "validation_error",
      error: "'service_names' en az bir hizmet içermelidir.",
    };
  }

  if (!isIsoDate(date)) {
    return {
      success: false,
      code: "validation_error",
      error: "'date' YYYY-MM-DD formatında olmalıdır.",
    };
  }

  if (!isHourMinute(startTime)) {
    return {
      success: false,
      code: "validation_error",
      error: "'start_time' HH:MM formatında olmalıdır.",
    };
  }

  const staffIdFromArgs =
    typeof args.staff_id === "string" ? args.staff_id.trim() : "";
  const staffNameFromArgs =
    typeof args.staff_name === "string" ? args.staff_name.trim() : "";

  let staffId = staffIdFromArgs;
  if (!staffId && staffNameFromArgs) {
    const resolved = await resolveStaffIdByName(ctx.tenantId, staffNameFromArgs);
    if (!resolved.staffId) {
      return {
        success: false,
        code: resolved.code || "staff_lookup_failed",
        error: resolved.error || "Personel doğrulanamadı.",
      };
    }
    staffId = resolved.staffId;
  }

  if (!staffId) {
    return {
      success: false,
      code: "validation_error",
      error: "Çoklu randevu için 'staff_id' veya 'staff_name' zorunludur.",
    };
  }

  const customerName =
    (typeof args.customer_name === "string" && args.customer_name.trim()) ||
    ctx.customerName ||
    null;

  const rpcBody = {
    p_tenant_id: ctx.tenantId,
    p_customer_phone: ctx.customerPhone,
    p_customer_name: customerName,
    p_staff_id: staffId,
    p_date: date,
    p_start_time: startTime,
    p_service_names: serviceNames,
    p_require_atomic: requireAtomic,
  };

  const response = await fetch(
    `${SUPABASE_CONFIG.url}/rest/v1/rpc/create_appointments_batch_atomic`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_CONFIG.serviceKey,
        Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
      },
      body: JSON.stringify(rpcBody),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    return {
      success: false,
      code: "rpc_error",
      error: "Çoklu randevu oluşturulamadı.",
      details: errText.slice(0, 500),
    };
  }

  const rawResult = await response.json();
  const result =
    Array.isArray(rawResult) && rawResult.length === 1 ? rawResult[0] : rawResult;

  if (result && typeof result === "object") {
    return result;
  }

  return {
    success: false,
    code: "rpc_invalid_response",
    error: "Çoklu randevu RPC geçersiz yanıt döndürdü.",
  };
}
