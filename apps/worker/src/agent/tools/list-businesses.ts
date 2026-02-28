import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../lib/convex-api.js";

interface BusinessEntry {
  tenantId: string;
  tenantName: string;
  code: string;
}

/**
 * Lists all active businesses the customer can connect to.
 * Used by the agent before calling bind_tenant so it knows the valid tenant IDs.
 */
export async function listBusinesses(
  convex: ConvexHttpClient
): Promise<{ businesses: BusinessEntry[] }> {
  const activeTenants = await convex.query(api.tenantCodes.listActive);

  const businesses: BusinessEntry[] = (activeTenants || []).map((t: any) => ({
    tenantId: t.tenantId,
    tenantName: t.tenantName,
    code: t.code,
  }));

  return { businesses };
}
