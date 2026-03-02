import { NextResponse } from "next/server";
import { requireMasterAdmin, isErrorResponse } from "@/lib/admin-auth";

// GET /api/admin/prompt-templates - List all prompt templates (global + user's tenant templates)
export async function GET(request: Request) {
    const auth = await requireMasterAdmin();
    if (isErrorResponse(auth)) return auth;
    const { supabase } = auth;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const tenantId = searchParams.get("tenantId");

    let query = supabase
        .from("prompt_templates")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

    // Filter by category if provided
    if (category) {
        query = query.eq("category", category);
    }

    // For non-tenant specific requests, include global templates
    // For tenant specific, include both global and tenant templates
    if (tenantId) {
        query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching prompt templates:", error);
        return NextResponse.json({ error: "Failed to fetch prompt templates" }, { status: 500 });
    }

    return NextResponse.json(data || []);
}

// POST /api/admin/prompt-templates - Create a new prompt template
export async function POST(request: Request) {
    const auth = await requireMasterAdmin();
    if (isErrorResponse(auth)) return auth;
    const { supabase, user } = auth;

    const body = await request.json();
    const { name, description, category, prompt_text, model_id, tenant_id, parameters, is_default } = body;

    if (!name || !prompt_text) {
        return NextResponse.json(
            { error: "Name and prompt_text are required" },
            { status: 400 }
        );
    }

    const { data, error } = await supabase
        .from("prompt_templates")
        .insert({
            name: name.trim(),
            description: description?.trim() || null,
            category: category || "general",
            prompt_text: prompt_text.trim(),
            model_id: model_id || null,
            tenant_id: tenant_id || null,
            parameters: parameters || {},
            is_default: is_default || false,
            created_by: user.id,
        })
        .select()
        .single();

    if (error) {
        console.error("Error creating prompt template:", error);
        return NextResponse.json({ error: "Failed to create prompt template" }, { status: 500 });
    }

    return NextResponse.json(data);
}
