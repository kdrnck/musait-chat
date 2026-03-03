import { SUPABASE_CONFIG } from "../../config.js";

// --- Business data cache (TTL 120s) ---
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const BUSINESS_CACHE_TTL_MS = 120_000; // 120 seconds
const businessDataCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | undefined {
  const entry = businessDataCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data as T;
  if (entry) businessDataCache.delete(key);
  return undefined;
}

function setCache(key: string, data: unknown): void {
  businessDataCache.set(key, { data, expiresAt: Date.now() + BUSINESS_CACHE_TTL_MS });
}

interface ToolContext {
  tenantId: string;
}

interface ServiceRow {
  id: string;
  name: string;
  duration_minutes?: number | null;
  duration_blocks?: number | null;
  price?: number | null;
  is_active?: boolean | null;
}

interface StaffRow {
  id: string;
  name: string;
  title?: string | null;
  is_active?: boolean | null;
}

export async function listServices(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const includeInactive = Boolean(args.include_inactive);
  const query = typeof args.query === "string" ? args.query.trim() : "";

  // Cache key includes inactive flag since it changes the result set
  const cacheKey = `${ctx.tenantId}:services:${includeInactive}`;
  const cached = getCached<unknown>(cacheKey);
  // Only use cache for default (no query filter) requests
  if (cached && !query) return cached;

  const url = new URL(`${SUPABASE_CONFIG.url}/rest/v1/services`);
  url.searchParams.set("tenant_id", `eq.${ctx.tenantId}`);
  if (!includeInactive) {
    url.searchParams.set("is_active", "eq.true");
  }
  url.searchParams.set(
    "select",
    "id,name,duration_minutes,duration_blocks,price,is_active,service_staff(staff:staff(id,name,is_active))"
  );
  url.searchParams.set("order", "name.asc");

  const response = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_CONFIG.serviceKey,
      Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
    },
  });

  if (!response.ok) {
    return { error: "Hizmet listesi alınamadı." };
  }

  const rows = (await response.json()) as Array<
    ServiceRow & {
      service_staff?: Array<{ staff?: StaffRow | null }> | null;
    }
  >;

  const normalized = normalizeText(query);
  const services = rows
    .map((row) => {
      const duration =
        row.duration_minutes ||
        (typeof row.duration_blocks === "number" ? row.duration_blocks * 15 : 30);
      const staff = (row.service_staff || [])
        .map((s) => s.staff)
        .filter((s): s is StaffRow => Boolean(s && s.id && s.name))
        .filter((s) => s.is_active !== false)
        .map((s) => ({ id: s.id, name: s.name }));
      return {
        id: row.id,
        name: row.name,
        duration_minutes: duration,
        price: row.price ?? null,
        is_active: row.is_active !== false,
        staff,
      };
    })
    .filter((svc) => {
      if (!normalized) return true;
      return normalizeText(svc.name).includes(normalized);
    });

  const result = {
    total: services.length,
    services,
  };

  // Cache the full (unfiltered) result
  if (!query) setCache(cacheKey, result);
  return result;
}

export async function listStaff(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const includeInactive = Boolean(args.include_inactive);
  const serviceId =
    typeof args.service_id === "string" ? args.service_id.trim() : "";
  const query = typeof args.query === "string" ? args.query.trim() : "";

  if (serviceId) {
    return listStaffByService(serviceId, query, includeInactive, ctx.tenantId);
  }

  const staffCacheKey = `${ctx.tenantId}:staff:${includeInactive}`;
  const cachedStaff = getCached<unknown>(staffCacheKey);
  if (cachedStaff && !query) return cachedStaff;

  const url = new URL(`${SUPABASE_CONFIG.url}/rest/v1/staff`);
  url.searchParams.set("tenant_id", `eq.${ctx.tenantId}`);
  if (!includeInactive) {
    url.searchParams.set("is_active", "eq.true");
  }
  url.searchParams.set("select", "id,name,title,is_active");
  url.searchParams.set("order", "name.asc");

  const response = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_CONFIG.serviceKey,
      Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
    },
  });

  if (!response.ok) {
    return { error: "Personel listesi alınamadı." };
  }

  const rows = (await response.json()) as StaffRow[];
  const normalized = normalizeText(query);
  const staff = rows
    .filter((s) => (includeInactive ? true : s.is_active !== false))
    .filter((s) => (normalized ? normalizeText(s.name).includes(normalized) : true))
    .map((s) => ({
      id: s.id,
      name: s.name,
      title: s.title ?? null,
      is_active: s.is_active !== false,
    }));

  const staffResult = {
    total: staff.length,
    staff,
  };

  if (!query) setCache(staffCacheKey, staffResult);
  return staffResult;
}

export async function getBusinessInfo(
  _args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const bizCacheKey = `${ctx.tenantId}:business`;
  const cachedBiz = getCached<unknown>(bizCacheKey);
  if (cachedBiz) return cachedBiz;

  const url = new URL(`${SUPABASE_CONFIG.url}/rest/v1/tenants`);
  url.searchParams.set("id", `eq.${ctx.tenantId}`);
  url.searchParams.set(
    "select",
    "id,name,slug,address,phone,maps_link,description,working_days,working_hours_start,working_hours_end"
  );
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_CONFIG.serviceKey,
      Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
    },
  });

  if (!response.ok) {
    return { error: "İşletme bilgisi alınamadı." };
  }

  const rows = (await response.json()) as Array<{
    id: string;
    name: string | null;
    slug: string | null;
    address?: string | null;
    phone?: string | null;
    maps_link?: string | null;
    description?: string | null;
    working_days?: string | null;
    working_hours_start?: string | null;
    working_hours_end?: string | null;
  }>;

  const tenant = rows[0];
  if (!tenant) {
    return { error: "İşletme bulunamadı." };
  }

  const bizResult = {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      address: tenant.address || null,
      phone: tenant.phone || null,
      maps_link: tenant.maps_link || null,
      description: tenant.description || null,
      working_days: tenant.working_days || null,
      working_hours: tenant.working_hours_start && tenant.working_hours_end
        ? `${tenant.working_hours_start} - ${tenant.working_hours_end}`
        : null,
    },
  };

  setCache(bizCacheKey, bizResult);
  return bizResult;
}

async function listStaffByService(
  serviceId: string,
  query: string,
  includeInactive: boolean,
  tenantId: string
): Promise<unknown> {
  const url = new URL(`${SUPABASE_CONFIG.url}/rest/v1/service_staff`);
  url.searchParams.set("service_id", `eq.${serviceId}`);
  url.searchParams.set("select", "staff:staff(id,name,title,is_active,tenant_id)");
  url.searchParams.set("order", "staff(name).asc");

  const response = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_CONFIG.serviceKey,
      Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
    },
  });

  if (!response.ok) {
    return { error: "Hizmete uygun personel listesi alınamadı." };
  }

  const rows = (await response.json()) as Array<{ staff?: StaffRow & { tenant_id?: string } }>;
  const normalized = normalizeText(query);

  const staff = rows
    .map((r) => r.staff)
    .filter((s): s is StaffRow & { tenant_id?: string } => Boolean(s && s.id && s.name))
    .filter((s) => s.tenant_id === tenantId)
    .filter((s) => (includeInactive ? true : s.is_active !== false))
    .filter((s) => (normalized ? normalizeText(s.name).includes(normalized) : true))
    .map((s) => ({
      id: s.id,
      name: s.name,
      title: s.title ?? null,
      is_active: s.is_active !== false,
    }));

  return {
    total: staff.length,
    service_id: serviceId,
    staff,
  };
}

function normalizeText(input: string): string {
  return input
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
