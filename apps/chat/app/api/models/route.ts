import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const tier = searchParams.get("tier");

    // Determine tier: explicit param > tenant assignment > default
    let effectiveTier: string | null = tier || null;

    if (!effectiveTier && tenantId) {
        // Look up tenant's assigned tier
        const { data: assignment } = await supabase
            .from("tenant_model_tier")
            .select("ai_model_tiers(name)")
            .eq("tenant_id", tenantId)
            .maybeSingle();

        if (assignment?.ai_model_tiers) {
            effectiveTier = (assignment.ai_model_tiers as any).name;
        }
    }

    if (!effectiveTier) {
        // Fall back to default tier
        const { data: defaultTier } = await supabase
            .from("ai_model_tiers")
            .select("name")
            .eq("is_default", true)
            .maybeSingle();

        effectiveTier = defaultTier?.name || "default";
    }

    let query = supabase
        .from("ai_models")
        .select("id, openrouter_id, display_name, provider_hint, provider_config, pricing_input, pricing_output, tier, supports_tools, supports_reasoning, context_window, max_output_tokens, description")
        .eq("is_enabled", true)
        .order("sort_order", { ascending: true })
        .order("display_name", { ascending: true });

    // Filter by tier — enterprise tier gets all models
    if (effectiveTier !== "enterprise") {
        query = query.eq("tier", effectiveTier);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: "Modeller alınamadı" }, { status: 500 });
    }

    return NextResponse.json(data);
}
