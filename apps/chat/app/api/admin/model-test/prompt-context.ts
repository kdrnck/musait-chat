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

  // ── Fetch tenant, services, staff in parallel ──────────────────────────
  // NOTE: Column selection matches Worker's getBusinessInfo / listServices / listStaff exactly.
  const [{ data: tenantRow }, { data: servicesRows }, { data: staffRows }] =
    await Promise.all([
      supabase
        .from("tenants")
        .select("id,name,slug,phone,address,maps_link,description,working_days,working_hours_start,working_hours_end")
        .eq("id", tenantId)
        .maybeSingle(),
      supabase
        .from("services")
        .select("id,name,duration_minutes,duration_blocks,price,is_active")
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

  // ── Tenant info — matches Worker getBusinessInfo format exactly ──────────
  if (tenantRow) {
    tenantName = tenantRow.name || tenantName;
    const infoParts: string[] = [
      `İşletme Adı: ${tenantRow.name || "N/A"}`,
      `İşletme ID: ${tenantRow.id || tenantId}`,
    ];
    if (tenantRow.slug) infoParts.push(`Slug: ${tenantRow.slug}`);
    if (tenantRow.phone) infoParts.push(`Telefon: ${tenantRow.phone}`);
    if (tenantRow.address) infoParts.push(`Adres: ${tenantRow.address}`);
    if (tenantRow.maps_link) infoParts.push(`Harita / Website: ${tenantRow.maps_link}`);
    if (tenantRow.description) infoParts.push(`Açıklama: ${tenantRow.description}`);
    if (tenantRow.working_days) infoParts.push(`Çalışma Günleri: ${tenantRow.working_days}`);
    if (tenantRow.working_hours_start && tenantRow.working_hours_end) {
      infoParts.push(`Çalışma Saatleri: ${tenantRow.working_hours_start} - ${tenantRow.working_hours_end}`);
    }
    businessInfoText = infoParts.join("\n");
  }

  // ── Services ───────────────────────────────────────────────────────────
  if (Array.isArray(servicesRows) && servicesRows.length > 0) {
    // Fetch staff per service via service_staff join table
    const serviceIds = servicesRows.map((s: any) => s.id);
    const { data: serviceStaffRows } = await supabase
      .from("service_staff")
      .select("service_id, staff_id, staff(id, name, is_active)")
      .in("service_id", serviceIds);

    // Build map: serviceId → staff names
    const serviceStaffMap: Record<string, string[]> = {};
    if (Array.isArray(serviceStaffRows)) {
      for (const row of serviceStaffRows as any[]) {
        const staffInfo = row.staff;
        if (!staffInfo || staffInfo.is_active === false) continue;
        if (!serviceStaffMap[row.service_id]) serviceStaffMap[row.service_id] = [];
        serviceStaffMap[row.service_id].push(staffInfo.name);
      }
    }

    servicesListText = servicesRows
      .map((service: any) => {
        // Use duration_blocks fallback (same as Worker logic)
        const duration = service.duration_minutes ||
          (typeof service.duration_blocks === "number" ? service.duration_blocks * 15 : 30);
        const staffNames = (serviceStaffMap[service.id] || []).join(", ") || "Yok";
        return `- ${service.name} (${duration} dk${service.price ? `, ${service.price} TL` : ""
          })\n  ID: ${service.id}\n  Çalışanlar: ${staffNames}`;
      })
      .join("\n\n");
  }

  // ── Staff list ─────────────────────────────────────────────────────────
  if (Array.isArray(staffRows) && staffRows.length > 0) {
    staffListText = staffRows
      .map((staff: any) => {
        const titlePart = staff.title ? ` (${staff.title})` : "";
        return `- ${staff.name}${titlePart}\n  ID: ${staff.id}`;
      })
      .join("\n");
  }

  // ── Customer lookup ────────────────────────────────────────────────────
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
      .select("start_time,status,services(name),staff(name)")
      .eq("customer_id", customerRow.id)
      .eq("tenant_id", tenantId)
      .order("start_time", { ascending: false })
      .limit(5);

    const recentServices = Array.from(
      new Set(
        (appointments || [])
          .map((row: any) => row.services?.name)
          .filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
      )
    );

    // Build recent appointment lines for prompt
    const appointmentLines = (appointments || []).map((row: any) => {
      const date = new Date(row.start_time).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
      const time = new Date(row.start_time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      const svc = row.services?.name || "N/A";
      const staff = row.staff?.name || "";
      return `- ${date} ${time} | ${svc}${staff ? ` | ${staff}` : ""} | ${row.status}`;
    });

    const profileParts: string[] = [];
    if (customerRow.name) profileParts.push(`Müşteri Adı: ${customerRow.name}`);
    if (recentServices.length > 0) profileParts.push(`Son Aldığı Hizmetler: ${recentServices.join(", ")}`);
    if (appointmentLines.length > 0) profileParts.push(`Recent Appointments:\n${appointmentLines.join("\n")}`);
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
  };

  const resolvedPrompt = resolvePlaceholders(systemPrompt || "", placeholders);
  const unresolvedPlaceholders = findUnresolvedPlaceholders(resolvedPrompt);

  return {
    placeholders,
    resolvedPrompt,
    unresolvedPlaceholders,
  };
}
