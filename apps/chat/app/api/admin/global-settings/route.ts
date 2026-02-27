import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("is_master")
        .eq("id", user.id)
        .single();

    if (!profile?.is_master && user.email !== "kdrnck1@gmail.com" && user.email !== "musait@musait.app") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
        .from("global_settings")
        .select("ai_system_prompt_text")
        .eq("id", "default")
        .single();

    if (error && error.code !== "PGRST116") {
        return NextResponse.json({ error: "Failed to fetch global settings" }, { status: 500 });
    }

    return NextResponse.json({
        promptText: data?.ai_system_prompt_text || "",
    });
}

export async function PUT(request: Request) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("is_master")
        .eq("id", user.id)
        .single();

    if (!profile?.is_master && user.email !== "kdrnck1@gmail.com" && user.email !== "musait@musait.app") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const promptText = typeof body.promptText === "string" ? body.promptText.trim() : "";

    if (!promptText) {
        return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("global_settings")
        .upsert({ id: "default", ai_system_prompt_text: promptText, updated_at: new Date().toISOString() })
        .select("ai_system_prompt_text")
        .single();

    if (error) {
        return NextResponse.json({ error: "Failed to update global settings" }, { status: 500 });
    }

    return NextResponse.json({
        promptText: data.ai_system_prompt_text,
    });
}
