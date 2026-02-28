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

    const { data, error } = await supabase
        .from("ai_models")
        .select("id, openrouter_id, display_name, provider_hint, pricing_input, pricing_output")
        .eq("is_enabled", true)
        .order("display_name", { ascending: true });

    if (error) {
        return NextResponse.json({ error: "Modeller alınamadı" }, { status: 500 });
    }

    return NextResponse.json(data);
}
