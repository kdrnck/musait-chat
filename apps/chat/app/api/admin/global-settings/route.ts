import { NextResponse } from "next/server";
import { requireMasterAdmin, isErrorResponse } from "@/lib/admin-auth";

export async function GET() {
    const auth = await requireMasterAdmin();
    if (isErrorResponse(auth)) return auth;
    const { supabase } = auth;

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
    const auth = await requireMasterAdmin();
    if (isErrorResponse(auth)) return auth;
    const { supabase } = auth;

    const body = await request.json();
    // Allow empty string to clear the global prompt (consistent with tenant-system-prompt behavior)
    const promptText = typeof body.promptText === "string" ? body.promptText.trim() : null;

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
