import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET /api/prompt-templates - Tenant-accessible prompt templates endpoint
// Returns global templates + templates scoped to the authenticated user's tenant
export async function GET(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    // Resolve tenant for this user
    const metaTenantId = user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id;
    let tenantId: string | null = typeof metaTenantId === "string" ? metaTenantId.trim() || null : null;

    if (!tenantId) {
        const { data: tenantUser } = await supabase
            .from("tenant_users")
            .select("tenant_id")
            .eq("user_id", user.id)
            .limit(1)
            .single();
        tenantId = (tenantUser?.tenant_id as string | null) ?? null;
    }

    const adminClient = createAdminClient();

    let query = adminClient
        .from("prompt_templates")
        .select("id,name,description,category,prompt_text,tenant_id,is_default,created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

    if (category) {
        query = query.eq("category", category);
    }

    // Global templates + this tenant's templates (if tenant found)
    if (tenantId) {
        query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
    } else {
        query = query.is("tenant_id", null);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching prompt templates:", error);
        return NextResponse.json({ error: "Failed to fetch prompt templates" }, { status: 500 });
    }

    return NextResponse.json(data || []);
}
