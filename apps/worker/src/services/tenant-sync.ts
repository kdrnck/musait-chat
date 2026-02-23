// Tenant Sync Service
// Reads tenants from Supabase and upserts them into Convex tenantCodes table.
// Run once at startup — keeps tenantCodes up to date with Supabase business data.

import type { ConvexHttpClient } from "convex/browser";
import type { SupabaseClient } from "@supabase/supabase-js";
import { api } from "../lib/convex-api.js";

interface SupabaseTenant {
    id: string;
    name: string;
    business_code: string | null;
}

/**
 * Syncs tenants from Supabase → Convex tenantCodes.
 *
 * Reads `tenants` table (id, name, business_code).
 * Any tenant with a non-null business_code gets upserted into tenantCodes.
 */
export async function syncTenantsToConvex(
    supabase: SupabaseClient,
    convex: ConvexHttpClient
): Promise<void> {
    console.log("🔄 Syncing tenants from Supabase → Convex...");

    const { data: tenants, error } = await supabase
        .from("tenants")
        .select("id, name, business_code")
        .not("business_code", "is", null);

    if (error) {
        console.error("❌ Failed to fetch tenants from Supabase:", error.message);
        return;
    }

    if (!tenants || tenants.length === 0) {
        console.warn("⚠️ No tenants with business_code found in Supabase");
        return;
    }

    let synced = 0;
    for (const tenant of tenants as SupabaseTenant[]) {
        if (!tenant.business_code) continue;

        try {
            await convex.mutation(api.tenantCodes.upsert, {
                code: tenant.business_code,
                tenantId: tenant.id,
                tenantName: tenant.name || "Bilinmeyen İşletme",
                isActive: true,
            });
            synced++;
        } catch (err) {
            console.error(
                `❌ Failed to sync tenant ${tenant.id} (code: ${tenant.business_code}):`,
                err
            );
        }
    }

    console.log(`✅ Synced ${synced}/${tenants.length} tenants to Convex tenantCodes`);
}
