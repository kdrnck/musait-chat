import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getMasterUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { supabase, user: null, authorized: false };

    const { data: profile } = await supabase
        .from("profiles")
        .select("is_master")
        .eq("id", user.id)
        .single();

    const authorized =
        profile?.is_master === true ||
        user.email === "kdrnck1@gmail.com" ||
        user.email === "musait@musait.app";

    return { supabase, user, authorized };
}

export async function GET() {
    const { supabase, user, authorized } = await getMasterUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supabase
        .from("global_settings")
        .select("router_agent_master_prompt_text")
        .eq("id", "default")
        .single();

    if (error && error.code !== "PGRST116") {
        return NextResponse.json({ error: "Failed to fetch router agent prompt" }, { status: 500 });
    }

    return NextResponse.json({
        promptText: data?.router_agent_master_prompt_text || "",
    });
}

export async function PUT(request: Request) {
    const { supabase, user, authorized } = await getMasterUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    // Allow empty string to clear the prompt (fall back to hardcoded default)
    const promptText = typeof body.promptText === "string" ? body.promptText.trim() : "";

    const { data, error } = await supabase
        .from("global_settings")
        .upsert({
            id: "default",
            router_agent_master_prompt_text: promptText || null,
            updated_at: new Date().toISOString(),
        })
        .select("router_agent_master_prompt_text")
        .single();

    if (error) {
        return NextResponse.json({ error: "Failed to update router agent prompt" }, { status: 500 });
    }

    return NextResponse.json({
        promptText: data?.router_agent_master_prompt_text || "",
    });
}
