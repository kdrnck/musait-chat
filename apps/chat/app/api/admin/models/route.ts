import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function checkMasterAdmin(supabase: any) {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
        .from("profiles")
        .select("is_master")
        .eq("id", user.id)
        .single();

    if (!profile?.is_master && user.email !== "kdrnck1@gmail.com" && user.email !== "musait@musait.app") {
        return null;
    }

    return user;
}

export async function GET() {
    try {
        const supabase = await createClient();
        const user = await checkMasterAdmin(supabase);
        if (!user) {
            return NextResponse.json({ error: "Yetki yok — master admin gerekli" }, { status: 403 });
        }

        const { data, error } = await supabase
            .from("ai_models")
            .select("*")
            .order("created_at", { ascending: true });

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
        const supabase = await createClient();
        const user = await checkMasterAdmin(supabase);
        if (!user) {
            return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
        }

        const body = await request.json();
        const { openrouter_id, display_name, pricing_input, pricing_output, provider_hint } = body;

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
        const supabase = await createClient();
        const user = await checkMasterAdmin(supabase);
        if (!user) {
            return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
        }

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
        const supabase = await createClient();
        const user = await checkMasterAdmin(supabase);
        if (!user) {
            return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
        }

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
