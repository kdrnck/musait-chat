import { NextResponse } from "next/server";
import { requireMasterAdmin, isErrorResponse } from "@/lib/admin-auth";

// GET /api/admin/prompt-templates/[id] - Get a specific prompt template
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireMasterAdmin();
    if (isErrorResponse(auth)) return auth;
    const { supabase } = auth;

    const { id } = await params;

    const { data, error } = await supabase
        .from("prompt_templates")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        console.error("Error fetching prompt template:", error);
        return NextResponse.json({ error: "Prompt template not found" }, { status: 404 });
    }

    return NextResponse.json(data);
}

// PUT /api/admin/prompt-templates/[id] - Update a prompt template
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireMasterAdmin();
    if (isErrorResponse(auth)) return auth;
    const { supabase } = auth;

    const { id } = await params;
    const body = await request.json();
    const { name, description, category, prompt_text, model_id, parameters, is_active, is_default } = body;

    const updateData: Record<string, any> = {};
    
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (category !== undefined) updateData.category = category;
    if (prompt_text !== undefined) updateData.prompt_text = prompt_text.trim();
    if (model_id !== undefined) updateData.model_id = model_id || null;
    if (parameters !== undefined) updateData.parameters = parameters;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (is_default !== undefined) updateData.is_default = is_default;

    const { data, error } = await supabase
        .from("prompt_templates")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("Error updating prompt template:", error);
        return NextResponse.json({ error: "Failed to update prompt template" }, { status: 500 });
    }

    return NextResponse.json(data);
}

// DELETE /api/admin/prompt-templates/[id] - Delete a prompt template
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireMasterAdmin();
    if (isErrorResponse(auth)) return auth;
    const { supabase } = auth;

    const { id } = await params;

    const { error } = await supabase
        .from("prompt_templates")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting prompt template:", error);
        return NextResponse.json({ error: "Failed to delete prompt template" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
