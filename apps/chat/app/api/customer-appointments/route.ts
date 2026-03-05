import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/customer-appointments?phone=...&tenantId=...&limit=3&offset=0
// Fetch customer appointments from Supabase — tenant-isolated
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
    const limit = Math.min(Number(searchParams.get("limit")) || 3, 20);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    if (!phone || !tenantId) {
        return NextResponse.json(
            { error: "phone and tenantId are required" },
            { status: 400 }
        );
    }

    // First find the customer for this tenant (tenant-isolated lookup)
    const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("id, name")
        .eq("phone", phone)
        .eq("tenant_id", tenantId)
        .maybeSingle();

    if (customerError) {
        console.error("Error fetching customer:", customerError);
        return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
    }

    if (!customer) {
        return NextResponse.json({ total: 0, appointments: [], services: [] });
    }

    // Count total appointments for pagination
    const { count } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customer.id)
        .eq("tenant_id", tenantId)
        .neq("status", "cancelled");

    // Fetch appointments — double filtered by tenant_id AND customer_id
    const { data: appointments, error: appointmentError } = await supabase
        .from("appointments")
        .select("start_time, status, notes, services(name), staff(name)")
        .eq("customer_id", customer.id)
        .eq("tenant_id", tenantId)
        .neq("status", "cancelled")
        .order("start_time", { ascending: false })
        .range(offset, offset + limit - 1);

    if (appointmentError) {
        console.error("Error fetching appointments:", appointmentError);
        return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
    }

    // Derive unique recent services from appointments
    const services = Array.from(
        new Set(
            (appointments || [])
                .map((row: any) => row.services?.name)
                .filter((v: unknown): v is string => typeof v === "string" && v.trim().length > 0)
        )
    );

    // Format appointments for the UI (no IDs exposed)
    const formattedAppointments = (appointments || []).map((row: any) => ({
        startTime: row.start_time,
        status: row.status,
        serviceName: row.services?.name || null,
        staffName: row.staff?.name || null,
        notes: row.notes || null,
    }));

    return NextResponse.json({
        total: count ?? 0,
        appointments: formattedAppointments,
        services,
    });
}
