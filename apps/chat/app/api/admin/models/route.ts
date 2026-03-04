import { NextResponse } from "next/server";
import { requireMasterAdmin, isErrorResponse } from "@/lib/admin-auth";

export async function GET(request: Request) {
    try {
        const auth = await requireMasterAdmin();
        if (isErrorResponse(auth)) return auth;
        const { supabase } = auth;

        const { searchParams } = new URL(request.url);
        const tier = searchParams.get("tier");

        let query = supabase
            .from("ai_models")
            .select("*")
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true });

        if (tier) {
            query = query.eq("tier", tier);
        }

        const { data, error } = await query;

        if (error) {
            console.error("[admin/models GET]", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data ?? []);
    } catch (err) {
        console.error("[admin/models GET] unexpected:", err);
        return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await requireMasterAdmin();
        if (isErrorResponse(auth)) return auth;
        const { supabase } = auth;

        const body = await request.json();
        const {
            openrouter_id,
            display_name,
            pricing_input,
            pricing_output,
            provider_hint,
            provider_config,
            tier,
            supports_tools,
            supports_reasoning,
            context_window,
            max_output_tokens,
            description,
            sort_order,
        } = body;

        if (!openrouter_id || !display_name) {
            return NextResponse.json({ error: "openrouter_id ve display_name zorunludur" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("ai_models")
            .insert({
                openrouter_id: openrouter_id.trim(),
                display_name: display_name.trim(),
                pricing_input: pricing_input ?? null,
                pricing_output: pricing_output ?? null,
                provider_hint: provider_hint ?? null,
                provider_config: provider_config ?? null,
                tier: tier || "default",
                supports_tools: supports_tools ?? true,
                supports_reasoning: supports_reasoning ?? false,
                context_window: context_window ?? null,
                max_output_tokens: max_output_tokens ?? null,
                description: description ?? null,
                sort_order: sort_order ?? 0,
                is_enabled: true,
            })
            .select()
            .single();

        if (error) {
            console.error("[admin/models POST]", error);
            if (error.code === "23505") {
                return NextResponse.json({ error: "Bu OpenRouter ID zaten kayıtlı" }, { status: 409 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (err) {
        console.error("[admin/models POST] unexpected:", err);
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
            return NextResponse.json({ error: "Model ID zorunludur" }, { status: 400 });
        }

        const allowedFields: Record<string, boolean> = {
            display_name: true,
            is_enabled: true,
            pricing_input: true,
            pricing_output: true,
            provider_hint: true,
            openrouter_id: true,
            provider_config: true,
            tier: true,
            supports_tools: true,
            supports_reasoning: true,
            context_window: true,
            max_output_tokens: true,
            description: true,
            sort_order: true,
        };

        const sanitized: Record<string, any> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields[key]) sanitized[key] = value;
        }

        const { data, error } = await supabase
            .from("ai_models")
            .update(sanitized)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            console.error("[admin/models PUT]", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (err) {
        console.error("[admin/models PUT] unexpected:", err);
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
            return NextResponse.json({ error: "Model ID zorunludur" }, { status: 400 });
        }

        const { error } = await supabase
            .from("ai_models")
            .delete()
            .eq("id", id);

        if (error) {
            console.error("[admin/models DELETE]", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[admin/models DELETE] unexpected:", err);
        return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
    }
}
