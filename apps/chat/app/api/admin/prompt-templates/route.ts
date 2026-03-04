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
    console.log("[prompt-templates POST] Request received");

    const auth = await requireMasterAdmin();
    if (isErrorResponse(auth)) {
        console.log("[prompt-templates POST] Auth failed");
        return auth;
    }
    const { supabase, user } = auth;
    console.log("[prompt-templates POST] Auth OK, user:", user.id, user.email);

    let body: any;
    try {
        body = await request.json();
    } catch (e) {
        console.error("[prompt-templates POST] Body parse error:", e);
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, description, category, prompt_text, model_id, tenant_id, parameters, is_default } = body;
    console.log("[prompt-templates POST] Body:", { name, category, tenant_id, is_default, prompt_text_length: prompt_text?.length });

    if (!name || !prompt_text) {
        return NextResponse.json(
            { error: "Name and prompt_text are required" },
            { status: 400 }
        );
    }

    const insertPayload = {
        name: name.trim(),
        description: description?.trim() || null,
        category: category || "general",
        prompt_text: prompt_text.trim(),
        model_id: model_id || null,
        tenant_id: tenant_id || null,
        parameters: parameters || {},
        is_default: is_default || false,
        created_by: user.id,
    };
    console.log("[prompt-templates POST] Insert payload:", { ...insertPayload, prompt_text: "(truncated)" });

    const { data, error } = await supabase
        .from("prompt_templates")
        .insert(insertPayload)
        .select()
        .single();

    if (error) {
        console.error("[prompt-templates POST] Supabase insert error:", JSON.stringify(error));
        return NextResponse.json(
            { error: "Failed to create prompt template", details: error.message, code: error.code },
            { status: 500 }
        );
    }

    console.log("[prompt-templates POST] Created successfully, id:", data.id);
    return NextResponse.json(data);
}
