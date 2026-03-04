import { NextResponse } from "next/server";
import { requireMasterAdmin, isErrorResponse } from "@/lib/admin-auth";

// GET: Get a tenant's assigned tier (or all assignments)
export async function GET(request: Request) {
    try {
        const auth = await requireMasterAdmin();
        if (isErrorResponse(auth)) return auth;
        const { supabase, user } = auth;

        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");

        if (tenantId) {
            // Get specific tenant's tier
            const { data, error } = await supabase
                .from("tenant_model_tier")
                .select("*, ai_model_tiers(*)")
                .eq("tenant_id", tenantId)
                .maybeSingle();

            if (error) {
                console.error("[admin/tenant-tier GET]", error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            // If no assignment, return default tier
            if (!data) {
                const { data: defaultTier } = await supabase
                    .from("ai_model_tiers")
                    .select("*")
                    .eq("is_default", true)
                    .single();

                return NextResponse.json({
                    tenant_id: tenantId,
                    tier: defaultTier || null,
                    is_explicit: false,
                });
            }

            return NextResponse.json({
                tenant_id: tenantId,
                tier: data.ai_model_tiers,
                assignment_id: data.id,
                assigned_at: data.assigned_at,
                is_explicit: true,
            });
        }

        // Get all assignments
        const { data, error } = await supabase
            .from("tenant_model_tier")
            .select("*, ai_model_tiers(*)");

        if (error) {
            console.error("[admin/tenant-tier GET all]", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data ?? []);
    } catch (err) {
        console.error("[admin/tenant-tier GET] unexpected:", err);
        return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
    }
}

// PUT: Assign or update a tenant's tier
export async function PUT(request: Request) {
    try {
        const auth = await requireMasterAdmin();
        if (isErrorResponse(auth)) return auth;
        const { supabase, user } = auth;

        const body = await request.json();
        const { tenant_id, tier_id } = body;

        if (!tenant_id || !tier_id) {
            return NextResponse.json(
                { error: "tenant_id ve tier_id zorunludur" },
                { status: 400 }
            );
        }

        // Verify tier exists
        const { data: tier, error: tierError } = await supabase
            .from("ai_model_tiers")
            .select("id")
            .eq("id", tier_id)
            .single();

        if (tierError || !tier) {
            return NextResponse.json({ error: "Geçersiz tier ID" }, { status: 400 });
        }

        // Upsert assignment
        const { data, error } = await supabase
            .from("tenant_model_tier")
            .upsert(
                {
                    tenant_id,
                    tier_id,
                    assigned_at: new Date().toISOString(),
                    assigned_by: user.id,
                },
                { onConflict: "tenant_id" }
            )
            .select("*, ai_model_tiers(*)")
            .single();

        if (error) {
            console.error("[admin/tenant-tier PUT]", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (err) {
        console.error("[admin/tenant-tier PUT] unexpected:", err);
        return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
    }
}

// DELETE: Remove explicit tier assignment (falls back to default)
export async function DELETE(request: Request) {
    try {
        const auth = await requireMasterAdmin();
        if (isErrorResponse(auth)) return auth;
        const { supabase } = auth;

        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");

        if (!tenantId) {
            return NextResponse.json({ error: "tenantId zorunludur" }, { status: 400 });
        }

        const { error } = await supabase
            .from("tenant_model_tier")
            .delete()
            .eq("tenant_id", tenantId);

        if (error) {
            console.error("[admin/tenant-tier DELETE]", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[admin/tenant-tier DELETE] unexpected:", err);
        return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
    }
}
