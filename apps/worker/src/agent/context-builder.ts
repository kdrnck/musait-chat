import type { ConvexHttpClient } from "convex/browser";
import { api } from "../lib/convex-api.js";
import { SUPABASE_CONFIG } from "../config.js";

// --- Simple in-memory cache with TTL ---

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 10_000; // 10 seconds — panel changes reflect quickly
const tenantContextCache = new Map<string, CacheEntry<TenantContext | null>>();
let globalSettingsCache: CacheEntry<GlobalSettings | null> | null = null;

export interface TenantContext {
  name: string | null;
  slug: string | null;
  integrationKeys: Record<string, unknown>;
}

export interface GlobalSettings {
  globalPromptText: string | null;
  routerAgentPromptText: string | null;
}

export async function fetchTenantContext(tenantId: string): Promise<TenantContext | null> {
  // Check cache
  const cached = tenantContextCache.get(tenantId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const url = new URL(`${SUPABASE_CONFIG.url}/rest/v1/tenants`);
  url.searchParams.set("id", `eq.${tenantId}`);
  url.searchParams.set("select", "name,slug,integration_keys");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_CONFIG.serviceKey,
      Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
    },
  });

  if (!response.ok) {
    tenantContextCache.set(tenantId, { data: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }

  const rows = (await response.json()) as Array<{
    name?: string | null;
    slug?: string | null;
    integration_keys?: Record<string, unknown>;
  }>;

  const tenant = rows[0];
  if (!tenant) {
    tenantContextCache.set(tenantId, { data: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }

  const result: TenantContext = {
    name: tenant.name || null,
    slug: tenant.slug || null,
    integrationKeys: tenant.integration_keys || {},
  };

  tenantContextCache.set(tenantId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

export async function fetchActiveTenants(
  convex: ConvexHttpClient
): Promise<Array<{ tenantId: string; tenantName: string }>> {
  try {
    const list = await convex.query(api.tenantCodes.listActive);
    return (list || []).map((t: any) => ({
      tenantId: t.tenantId,
      tenantName: t.tenantName,
    }));
  } catch {
    return [];
  }
}

export async function fetchGlobalSettings(): Promise<GlobalSettings | null> {
  // Check cache
  if (globalSettingsCache && Date.now() < globalSettingsCache.expiresAt) {
    return globalSettingsCache.data;
  }

  const url = new URL(`${SUPABASE_CONFIG.url}/rest/v1/global_settings`);
  url.searchParams.set("id", "eq.default");
  url.searchParams.set("select", "ai_system_prompt_text,router_agent_master_prompt_text");
  url.searchParams.set("limit", "1");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_CONFIG.serviceKey,
        Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
      },
    });
    if (!response.ok) {
      globalSettingsCache = { data: null, expiresAt: Date.now() + CACHE_TTL_MS };
      return null;
    }

    const rows = (await response.json()) as Array<{
      ai_system_prompt_text?: string | null;
      router_agent_master_prompt_text?: string | null;
    }>;
    const row = rows[0];
    if (!row) {
      globalSettingsCache = { data: null, expiresAt: Date.now() + CACHE_TTL_MS };
      return null;
    }

    const result: GlobalSettings = {
      globalPromptText: row.ai_system_prompt_text || null,
      routerAgentPromptText: row.router_agent_master_prompt_text || null,
    };

    globalSettingsCache = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };
    return result;
  } catch (err) {
    console.error("Failed to fetch global settings:", err);
    globalSettingsCache = { data: null, expiresAt: Date.now() + CACHE_TTL_MS };
    return null;
  }
}

/** Invalidate all caches (useful for testing or manual refresh). */
export function invalidateContextCaches(): void {
  tenantContextCache.clear();
  globalSettingsCache = null;
}
