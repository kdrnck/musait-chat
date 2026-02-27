import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMaster = user.app_metadata?.role === "master";
  const tenantId =
    (user.app_metadata?.tenant_id as string) ||
    (user.user_metadata?.tenant_id as string) ||
    null;

  if (!isMaster && !tenantId) {
    return NextResponse.json(
      { error: "Tenant bulunamadı" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const phones = body.phones as string[];

  if (!Array.isArray(phones) || phones.length === 0) {
    return NextResponse.json({ names: {} });
  }

  // Fetch customer names from Supabase
  // Master admin queries globally (no tenant_id filter), tenant users filter by their tenant
  let query = supabase.from("customers").select("phone, name").in("phone", phones);
  if (!isMaster && tenantId) {
    query = query.eq("tenant_id", tenantId);
  }
  const { data: customers, error } = await query;

  if (error) {
    console.error("Error fetching customer names:", error);
    return NextResponse.json({ names: {} });
  }

  // Build phone -> name map
  const names: Record<string, string | null> = {};
  for (const customer of customers || []) {
    if (customer.phone) {
      names[customer.phone] = customer.name || null;
    }
  }

  return NextResponse.json({ names });
}
