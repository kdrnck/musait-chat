import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/customer-profile?phone=...&tenantId=...
// Fetch customer data from Supabase (system profile)
export async function GET(request: NextRequest) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");
    const tenantId = searchParams.get("tenantId");

    if (!phone || !tenantId) {
        return NextResponse.json(
            { error: "phone and tenantId are required" },
            { status: 400 }
        );
    }

    const { data: customer, error } = await supabase
        .from("customers")
        .select("id, name, phone, tenant_id, created_at, updated_at")
        .eq("phone", phone)
        .eq("tenant_id", tenantId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching customer:", error);
        return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
    }

    return NextResponse.json({ customer: customer || null });
}

// PUT /api/customer-profile
// Update customer data in Supabase (system profile)
export async function PUT(request: NextRequest) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { phone, tenantId, name } = body;

    if (!phone || !tenantId) {
        return NextResponse.json(
            { error: "phone and tenantId are required" },
            { status: 400 }
        );
    }

    // Check if customer exists
    const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", phone)
        .eq("tenant_id", tenantId)
        .maybeSingle();

    if (existing) {
        // Update existing customer
        const { data: updated, error } = await supabase
            .from("customers")
            .update({ name: name?.trim() || null, updated_at: new Date().toISOString() })
            .eq("id", existing.id)
            .select("id, name, phone, tenant_id")
            .single();

        if (error) {
            console.error("Error updating customer:", error);
            return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
        }

        return NextResponse.json({ customer: updated });
    } else {
        // Create new customer
        const { data: created, error } = await supabase
            .from("customers")
            .insert({
                phone,
                tenant_id: tenantId,
                name: name?.trim() || null,
            })
            .select("id, name, phone, tenant_id")
            .single();

        if (error) {
            console.error("Error creating customer:", error);
            return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
        }

        return NextResponse.json({ customer: created });
    }
}
