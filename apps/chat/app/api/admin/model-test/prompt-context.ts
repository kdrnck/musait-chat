import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findUnresolvedPlaceholders,
  getCurrentDateInfo,
  resolvePlaceholders,
} from "@musait/shared";

interface ResolveModelTestPromptArgs {
  supabase: SupabaseClient;
  tenantId: string;
  phone: string;
  systemPrompt: string;
}

export interface ResolvedModelTestPromptContext {
  placeholders: Record<string, string>;
  resolvedPrompt: string;
  unresolvedPlaceholders: string[];
}

function normalizePhoneVariants(phone: string): string[] {
  const rawPhone = phone.replace(/[\s\-().]/g, "");
  let canonical = rawPhone;

  if (/^\+900[0-9]{10}$/.test(rawPhone)) {
    canonical = `+90${rawPhone.slice(4)}`;
  } else if (/^\+90[0-9]{10}$/.test(rawPhone)) {
    canonical = rawPhone;
  } else if (/^900[0-9]{10}$/.test(rawPhone)) {
    canonical = `+90${rawPhone.slice(3)}`;
  } else if (/^90[0-9]{10}$/.test(rawPhone)) {
    canonical = `+${rawPhone}`;
  } else if (/^0[0-9]{10}$/.test(rawPhone)) {
    canonical = `+9${rawPhone}`;
  } else if (/^[0-9]{10}$/.test(rawPhone)) {
    canonical = `+90${rawPhone}`;
  }

  return Array.from(
    new Set([
      phone,
      canonical,
      canonical.replace(/^\+90/, "0"),
      canonical.replace(/^\+/, ""),
      canonical.replace(/^\+90/, ""),
    ])
  );
}

export async function resolveModelTestPromptContext(
  args: ResolveModelTestPromptArgs
): Promise<ResolvedModelTestPromptContext> {
  const { supabase, tenantId, phone, systemPrompt } = args;
  const dateInfo = getCurrentDateInfo();

  let tenantName = "İşletme";
  let businessInfoText = "İşletme bilgisi mevcut değil.";
  let servicesListText = "Hizmet bilgisi mevcut değil.";
  let staffListText = "Personel bilgisi mevcut değil.";
  let customerName = "";
  let customerProfileText = "Müşteri profili mevcut değil.";

  const [{ data: tenantRow }, { data: servicesRows }, { data: staffRows }] =
    await Promise.all([
      supabase
        .from("tenants")
        .select(
          "id,name,address,phone,maps_link,working_days,working_hours_start,working_hours_end,description"
        )
        .eq("id", tenantId)
        .maybeSingle(),
      supabase
        .from("services")
        .select(
          "id,name,duration_minutes,price,is_active,service_staff(staff:staff(id,name,is_active))"
        )
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("staff")
        .select("id,name,title,is_active")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name"),
    ]);

  if (tenantRow) {
    tenantName = tenantRow.name || tenantName;
    const infoParts: string[] = [
      `Business Name: ${tenantRow.name || "N/A"}`,
      `Business ID: ${tenantRow.id || tenantId}`,
    ];
    if (tenantRow.address) infoParts.push(`Address: ${tenantRow.address}`);
    if (tenantRow.phone) infoParts.push(`Phone: ${tenantRow.phone}`);
    if (tenantRow.maps_link) infoParts.push(`Maps Link: ${tenantRow.maps_link}`);
    if (tenantRow.working_days)
      infoParts.push(`Working Days: ${tenantRow.working_days}`);
    if (tenantRow.working_hours_start && tenantRow.working_hours_end) {
      infoParts.push(
        `Working Hours: ${tenantRow.working_hours_start} - ${tenantRow.working_hours_end}`
      );
    }
    if (tenantRow.description) infoParts.push(`Description: ${tenantRow.description}`);
    businessInfoText = infoParts.join("\n");
  }

  if (Array.isArray(servicesRows) && servicesRows.length > 0) {
    servicesListText = servicesRows
      .map((service: any) => {
        const staffNames =
          service.service_staff
            ?.map((row: any) => row.staff)
            .filter((staff: any) => staff?.name && staff?.is_active !== false)
            .map((staff: any) => staff.name)
            .join(", ") || "Yok";
        return `- ${service.name} (${service.duration_minutes || 30} dk${
          service.price ? `, ${service.price} TL` : ""
        })\n  ID: ${service.id}\n  Çalışanlar: ${staffNames}`;
      })
      .join("\n\n");
  }

  if (Array.isArray(staffRows) && staffRows.length > 0) {
    staffListText = staffRows
      .map((staff: any) => `- ${staff.name}${staff.title ? ` (${staff.title})` : ""}\n  ID: ${staff.id}`)
      .join("\n");
  }

  const phoneVariants = normalizePhoneVariants(phone || "+905550000000");
  const { data: customerRow } = await supabase
    .from("customers")
    .select("id,name,phone")
    .eq("tenant_id", tenantId)
    .in("phone", phoneVariants)
    .limit(1)
    .maybeSingle();

  if (customerRow) {
    customerName = customerRow.name || "";
    const { data: appointments } = await supabase
      .from("appointments")
      .select(
        "start_time,status,services(name),staff(name)"
      )
      .eq("customer_id", customerRow.id)
      .order("start_time", { ascending: false })
      .limit(5);

    const recentServices = Array.from(
      new Set(
        (appointments || [])
          .map((row: any) => row.services?.name)
          .filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
      )
    );
    const preferredStaff = Array.from(
      new Set(
        (appointments || [])
          .map((row: any) => row.staff?.name)
          .filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
      )
    );

    const profileParts: string[] = [];
    if (preferredStaff.length > 0) profileParts.push(`Preferred Staff: ${preferredStaff.join(", ")}`);
    if (recentServices.length > 0) profileParts.push(`Recent Services: ${recentServices.join(", ")}`);
    if (customerRow.name) profileParts.push(`Customer Name: ${customerRow.name}`);
    customerProfileText = profileParts.join("\n") || customerProfileText;
  }

  const placeholders: Record<string, string> = {
    current_date: dateInfo.date,
    current_day_name: dateInfo.dayName,
    current_time: dateInfo.time,
    tenant_name: tenantName,
    tenant_id: tenantId,
    business_name: tenantName,
    business_info: businessInfoText,
    services_list: servicesListText,
    staff_list: staffListText,
    customer_first_name: customerName.split(" ")[0] || customerName,
    customer_name: customerName,
    customer_profile: customerProfileText,
    test_phone: phone || "",
  };

  const resolvedPrompt = resolvePlaceholders(systemPrompt || "", placeholders);
  const unresolvedPlaceholders = findUnresolvedPlaceholders(resolvedPrompt);

  return {
    placeholders,
    resolvedPrompt,
    unresolvedPlaceholders,
  };
}
