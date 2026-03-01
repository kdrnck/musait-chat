import { NextResponse } from "next/server";
import { requireMasterAdmin, isErrorResponse } from "@/lib/admin-auth";

export async function GET() {
    const auth = await requireMasterAdmin();
    if (isErrorResponse(auth)) return auth;
    const { supabase } = auth;

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
    const auth = await requireMasterAdmin();
    if (isErrorResponse(auth)) return auth;
    const { supabase } = auth;

    const body = await request.json();
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
