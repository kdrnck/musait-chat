import { NextResponse } from "next/server";
import { requireMasterAdmin, isErrorResponse } from "@/lib/admin-auth";

export async function GET() {
    try {
        const auth = await requireMasterAdmin();
        if (isErrorResponse(auth)) return auth;
        const { supabase } = auth;

        // Get tiers with model count and tenant count
        const { data: tiers, error } = await supabase
            .from("ai_model_tiers")
            .select("*")
            .order("created_at", { ascending: true });

        if (error) {
            console.error("[admin/model-tiers GET]", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Get model counts per tier
        const { data: models } = await supabase
            .from("ai_models")
            .select("tier, is_enabled");

        // Get tenant counts per tier
        const { data: assignments } = await supabase
            .from("tenant_model_tier")
            .select("tier_id");

        const modelCounts: Record<string, { total: number; enabled: number }> = {};
        for (const m of models ?? []) {
            if (!modelCounts[m.tier]) modelCounts[m.tier] = { total: 0, enabled: 0 };
            modelCounts[m.tier].total++;
            if (m.is_enabled) modelCounts[m.tier].enabled++;
        }

        const tenantCounts: Record<string, number> = {};
        for (const a of assignments ?? []) {
            tenantCounts[a.tier_id] = (tenantCounts[a.tier_id] || 0) + 1;
        }

        const enriched = (tiers ?? []).map((t) => ({
            ...t,
            model_count: modelCounts[t.name]?.total ?? 0,
            enabled_model_count: modelCounts[t.name]?.enabled ?? 0,
            tenant_count: tenantCounts[t.id] ?? 0,
        }));

        return NextResponse.json(enriched);
    } catch (err) {
        console.error("[admin/model-tiers GET] unexpected:", err);
        return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await requireMasterAdmin();
        if (isErrorResponse(auth)) return auth;
        const { supabase } = auth;

        const body = await request.json();
        const { name, display_name, description, is_default } = body;

        if (!name || !display_name) {
            return NextResponse.json(
                { error: "name ve display_name zorunludur" },
                { status: 400 }
            );
        }

        // If marking as default, unset existing default first
        if (is_default) {
            await supabase
                .from("ai_model_tiers")
                .update({ is_default: false })
                .eq("is_default", true);
        }

        const { data, error } = await supabase
            .from("ai_model_tiers")
            .insert({
                name: name.trim().toLowerCase(),
                display_name: display_name.trim(),
                description: description || null,
                is_default: is_default ?? false,
            })
            .select()
            .single();

        if (error) {
            console.error("[admin/model-tiers POST]", error);
            if (error.code === "23505") {
                return NextResponse.json({ error: "Bu tier adı zaten mevcut" }, { status: 409 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (err) {
        console.error("[admin/model-tiers POST] unexpected:", err);
        return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const auth = await requireMasterAdmin();
        if (isErrorResponse(auth)) return auth;
        const { supabase } = auth;

        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: "Tier ID zorunludur" }, { status: 400 });
        }

        const allowedFields: Record<string, boolean> = {
            display_name: true,
            description: true,
            is_default: true,
        };

        const sanitized: Record<string, any> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields[key]) sanitized[key] = value;
        }

        // If marking as default, unset existing default first
        if (sanitized.is_default === true) {
            await supabase
                .from("ai_model_tiers")
                .update({ is_default: false })
                .eq("is_default", true);
        }

        const { data, error } = await supabase
            .from("ai_model_tiers")
            .update(sanitized)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            console.error("[admin/model-tiers PUT]", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (err) {
        console.error("[admin/model-tiers PUT] unexpected:", err);
        return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const auth = await requireMasterAdmin();
        if (isErrorResponse(auth)) return auth;
        const { supabase } = auth;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Tier ID zorunludur" }, { status: 400 });
        }

        // Don't allow deleting the default tier
        const { data: tier } = await supabase
            .from("ai_model_tiers")
            .select("is_default, name")
            .eq("id", id)
            .single();

        if (tier?.is_default) {
            return NextResponse.json(
                { error: "Varsayılan tier silinemez. Önce başka bir tier'ı varsayılan yapın." },
                { status: 400 }
            );
        }

        // Check if any tenants are using this tier
        const { count } = await supabase
            .from("tenant_model_tier")
            .select("id", { count: "exact", head: true })
            .eq("tier_id", id);

        if (count && count > 0) {
            return NextResponse.json(
                { error: `Bu tier ${count} işletme tarafından kullanılıyor. Önce işletmelerin tier'ını değiştirin.` },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from("ai_model_tiers")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("[admin/model-tiers DELETE]", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[admin/model-tiers DELETE] unexpected:", err);
        return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
    }
}
