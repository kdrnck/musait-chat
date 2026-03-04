import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveModelTestPromptContext } from "./prompt-context";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

interface ToolResult {
    tool_call_id: string;
    role: "tool";
    name: string;
    content: string;
}

function getToolDefinitions() {
    return [
        {
            type: "function",
            function: {
                name: "list_customer_appointments",
                description: "Konuşmadaki müşterinin mevcut/gelecek randevularını listeler.",
                parameters: {
                    type: "object",
                    properties: {
                        only_future: { type: "boolean", description: "Sadece gelecek randevuları döndür (varsayılan: true)" },
                        include_cancelled: { type: "boolean", description: "İptal edilmiş randevuları da dahil et (varsayılan: false)" },
                        limit: { type: "number", description: "Maksimum randevu sayısı (varsayılan: 10, max: 20)" },
                    },
                    required: [],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "view_available_slots",
                description: "Belirtilen tarih için müsait randevu slotlarını gösterir.",
                parameters: {
                    type: "object",
                    properties: {
                        date: { type: "string", description: "Tarih (YYYY-MM-DD formatında)" },
                        service_id: { type: "string", description: "Hizmet ID (opsiyonel)" },
                        staff_id: { type: "string", description: "Personel ID (opsiyonel)" },
                    },
                    required: ["date"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "create_appointment",
                description: "Yeni bir randevu oluşturur. Müşteriden açık onay ALDIKTAN SONRA kullanılmalıdır.",
                parameters: {
                    type: "object",
                    properties: {
                        service_id: { type: "string", description: "Hizmet ID" },
                        staff_id: { type: "string", description: "Personel ID" },
                        start_time: { type: "string", description: "Başlangıç zamanı — YYYY-MM-DDTHH:MM:SS+03:00" },
                        customer_name: { type: "string", description: "Müşteri adı (opsiyonel)" },
                    },
                    required: ["service_id", "staff_id", "start_time"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "create_appointments_batch",
                description: "Birden fazla hizmet için ardışık randevu planını atomik biçimde oluşturur.",
                parameters: {
                    type: "object",
                    properties: {
                        service_names: {
                            type: "array",
                            items: { type: "string" },
                            description: "Hizmet isimleri sıralı listesi",
                        },
                        date: { type: "string", description: "Tarih (YYYY-MM-DD)" },
                        start_time: { type: "string", description: "Başlangıç saati (HH:MM)" },
                        staff_id: { type: "string", description: "Personel ID (opsiyonel)" },
                        staff_name: { type: "string", description: "Personel adı (opsiyonel)" },
                        customer_name: { type: "string", description: "Müşteri adı (opsiyonel)" },
                        require_atomic: { type: "boolean", description: "Varsayılan true" },
                    },
                    required: ["service_names", "date", "start_time"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "cancel_appointment",
                description: "Mevcut bir randevuyu iptal eder.",
                parameters: {
                    type: "object",
                    properties: {
                        appointment_id: { type: "string", description: "İptal edilecek randevu ID" },
                        reason: { type: "string", description: "İptal sebebi (opsiyonel)" },
                    },
                    required: ["appointment_id"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "suggest_least_busy_staff",
                description: "Hizmet ve tarih için daha az yoğun personeli önerir.",
                parameters: {
                    type: "object",
                    properties: {
                        date: { type: "string", description: "Tarih (YYYY-MM-DD)" },
                        service_id: { type: "string", description: "Hizmet ID" },
                    },
                    required: ["date", "service_id"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "list_businesses",
                description: "Aktif işletmeleri listeler.",
                parameters: { type: "object", properties: {}, required: [] },
            },
        },
        {
            type: "function",
            function: {
                name: "bind_tenant",
                description: "Konuşmayı tenant_id ile belirtilen işletmeye bağlar.",
                parameters: {
                    type: "object",
                    properties: {
                        tenant_id: { type: "string", description: "İşletme tenant ID" },
                    },
                    required: ["tenant_id"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "ask_human",
                description: "Konuşmayı bir insan operatöre devreder.",
                parameters: {
                    type: "object",
                    properties: { reason: { type: "string" } },
                    required: ["reason"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "end_session",
                description: "Oturumu sonlandırır.",
                parameters: {
                    type: "object",
                    properties: { summary: { type: "string" } },
                    required: [],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "take_notes_for_user",
                description: "Müşteri hakkında önemli bilgileri not olarak kaydeder.",
                parameters: {
                    type: "object",
                    properties: {
                        note: { type: "string", description: "Kaydedilecek not içeriği (Türkçe)" },
                    },
                    required: ["note"],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "update_customer_name",
                description: "Müşterinin kayıtlı adını ve/veya soyadını günceller.",
                parameters: {
                    type: "object",
                    properties: {
                        first_name: { type: "string", description: "Müşterinin yeni adı (opsiyonel)" },
                        last_name: { type: "string", description: "Müşterinin yeni soyadı (opsiyonel)" },
                    },
                    required: [],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "compose_interactive_message",
                description: "WhatsApp interaktif liste/buton mesajını şemalı olarak üretir.",
                parameters: {
                    type: "object",
                    properties: {
                        kind: { type: "string", enum: ["buttons", "list"] },
                        body: { type: "string" },
                        buttons: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string" },
                                    title: { type: "string" },
                                },
                                required: ["id", "title"],
                            },
                        },
                        button_text: { type: "string" },
                        sections: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    rows: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string" },
                                                title: { type: "string" },
                                                description: { type: "string" },
                                            },
                                            required: ["id", "title"],
                                        },
                                    },
                                },
                                required: ["title", "rows"],
                            },
                        },
                    },
                    required: ["kind", "body"],
                },
            },
        },
    ];
}

function supportsReasoning(model: string): boolean {
    return /deepseek|gemini/i.test(model);
}

// Tool execution functions
async function executeToolCall(toolName: string, args: any, tenantId: string, customerPhone: string): Promise<string> {
    const supabase = await createClient();
    
    try {
        switch (toolName) {
            case "list_services": {
                const query = supabase
                    .from("services")
                    .select("id, name, duration_minutes, price, is_active")
                    .eq("tenant_id", tenantId)
                    .order("name");
                
                if (!args.include_inactive) {
                    query.eq("is_active", true);
                }
                
                const { data, error } = await query;
                if (error) throw error;
                return JSON.stringify({ services: data || [] });
            }
            
            case "list_staff": {
                let query = supabase
                    .from("staff")
                    .select("id, name, is_active")
                    .eq("tenant_id", tenantId);
                
                if (args.service_id) {
                    const { data: serviceStaff } = await supabase
                        .from("service_staff")
                        .select("staff_id")
                        .eq("service_id", args.service_id);
                    
                    const staffIds = (serviceStaff || []).map((ss: any) => ss.staff_id);
                    if (staffIds.length > 0) {
                        query = query.in("id", staffIds);
                    } else {
                        return JSON.stringify({ staff: [] });
                    }
                }
                
                if (!args.include_inactive) {
                    query = query.eq("is_active", true);
                }
                
                query = query.order("name");
                
                const { data, error } = await query;
                if (error) throw error;
                return JSON.stringify({ staff: data || [] });
            }
            
            case "get_business_info": {
                const { data, error } = await supabase
                    .from("tenants")
                    .select("name, phone, address, description")
                    .eq("id", tenantId)
                    .single();
                
                if (error) throw error;
                return JSON.stringify({ business: data });
            }
            
            case "view_available_slots": {
                // Call the real RPC for available slots
                const slotDate = args.date as string;
                if (!slotDate) return JSON.stringify({ error: "date zorunludur" });

                let durationMinutes: number | undefined;
                if (args.service_id) {
                    const { data: svcRow } = await supabase
                        .from("services")
                        .select("duration_minutes")
                        .eq("id", args.service_id)
                        .maybeSingle();
                    durationMinutes = svcRow?.duration_minutes;
                }

                const rpcParams: Record<string, unknown> = {
                    p_tenant_id: tenantId,
                    p_date: slotDate,
                };
                if (durationMinutes) rpcParams.p_duration_minutes = durationMinutes;
                if (args.staff_id) rpcParams.p_staff_id = args.staff_id;

                const { data: rpcData, error: rpcErr } = await supabase.rpc(
                    "get_available_slots",
                    rpcParams
                );

                if (rpcErr) {
                    // Fallback: simple query
                    return JSON.stringify({ date: slotDate, availableSlots: [], error: rpcErr.message });
                }

                return JSON.stringify(rpcData ?? { date: slotDate, availableSlots: [] });
            }
            
            case "get_customer_profile": {
                const cpNormalized = customerPhone.replace(/\s+/g, '').replace(/^0/, '+90');
                const cpVariants = [
                    customerPhone, cpNormalized,
                    customerPhone.replace(/^\+90/, '0'),
                    customerPhone.replace(/^\+/, ''),
                ];

                const { data: cpCustomer } = await supabase
                    .from("customers")
                    .select("id, name, phone, created_at")
                    .eq("tenant_id", tenantId)
                    .in("phone", cpVariants)
                    .limit(1)
                    .maybeSingle();

                if (!cpCustomer) {
                    return JSON.stringify({
                        found: false,
                        customer_phone: customerPhone,
                        message: "Bu telefon numarasına ait müşteri bulunamadı. Yeni müşteri olabilir."
                    });
                }

                const { data: pastApts } = await supabase
                    .from("appointments")
                    .select("start_time, status, services(name), staff(name)")
                    .eq("customer_id", cpCustomer.id)
                    .order("start_time", { ascending: false })
                    .limit(5);

                const recentServices = [...new Set((pastApts || []).map((a: any) => a.services?.name).filter(Boolean))];
                const preferredStaff = [...new Set((pastApts || []).map((a: any) => a.staff?.name).filter(Boolean))];

                return JSON.stringify({
                    found: true,
                    customer_name: cpCustomer.name || "İsim kaydedilmemiş",
                    customer_phone: cpCustomer.phone,
                    total_appointments: (pastApts || []).length,
                    recent_services: recentServices,
                    preferred_staff: preferredStaff,
                    registered_since: cpCustomer.created_at,
                });
            }

            case "list_customer_appointments": {
                const phoneVariants = [
                    customerPhone,
                    customerPhone.replace(/^\+90/, '0'),
                    customerPhone.replace(/^\+/, ''),
                ];

                const { data: customer } = await supabase
                    .from("customers")
                    .select("id, name, phone")
                    .eq("tenant_id", tenantId)
                    .in("phone", phoneVariants)
                    .limit(1)
                    .maybeSingle();

                if (!customer) {
                    return JSON.stringify({
                        customer_name: null,
                        customer_phone: customerPhone,
                        appointments: [],
                        message: "Bu telefon numarasına ait kayıtlı müşteri bulunamadı."
                    });
                }

                const onlyFuture = args.only_future !== false;
                const includeCancelled = !!args.include_cancelled;
                const limit = Math.min(args.limit || 10, 20);

                let query = supabase
                    .from("appointments")
                    .select(`
                        id,
                        start_time,
                        end_time,
                        status,
                        services (name, duration_minutes, price),
                        staff (name)
                    `)
                    .eq("customer_id", customer.id)
                    .order("start_time", { ascending: onlyFuture })
                    .limit(limit);

                if (onlyFuture) {
                    query = query.gte("start_time", new Date().toISOString());
                }

                if (!includeCancelled) {
                    query = query.neq("status", "cancelled");
                }

                const { data: appointments, error } = await query;
                if (error) throw error;

                return JSON.stringify({
                    customer_name: customer.name || "İsim bilinmiyor",
                    customer_phone: customer.phone,
                    appointments: (appointments || []).map((apt: any) => ({
                        id: apt.id,
                        start_time: apt.start_time,
                        end_time: apt.end_time,
                        status: apt.status,
                        service: apt.services?.name || "Bilinmiyor",
                        staff: apt.staff?.name || "Bilinmiyor",
                    }))
                });
            }

            case "create_appointment": {
                if (!args.service_id || !args.staff_id || !args.start_time) {
                    return JSON.stringify({
                        success: false,
                        code: "validation_error",
                        error: "service_id, staff_id ve start_time zorunludur.",
                    });
                }

                // 1. Find or create customer by phone
                const caPhoneVariants = [
                    customerPhone,
                    customerPhone.replace(/^\+90/, '0'),
                    customerPhone.replace(/^\+/, ''),
                ];
                let { data: caCustomer } = await supabase
                    .from("customers")
                    .select("id, name, phone")
                    .eq("tenant_id", tenantId)
                    .in("phone", caPhoneVariants)
                    .limit(1)
                    .maybeSingle();

                if (!caCustomer) {
                    // Create customer record
                    const { data: newCust, error: custErr } = await supabase
                        .from("customers")
                        .insert({
                            tenant_id: tenantId,
                            phone: customerPhone,
                            name: args.customer_name || "Test Lab Müşteri",
                        })
                        .select("id, name, phone")
                        .single();
                    if (custErr) return JSON.stringify({ success: false, error: "Müşteri oluşturulamadı: " + custErr.message });
                    caCustomer = newCust;
                }

                // 2. Get service for duration
                const { data: caService } = await supabase
                    .from("services")
                    .select("duration_minutes, name")
                    .eq("id", args.service_id)
                    .maybeSingle();

                const duration = caService?.duration_minutes || 30;

                // 3. Normalize start_time
                let caStartTime = args.start_time as string;
                if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(caStartTime)) {
                    caStartTime = `${caStartTime}:00+03:00`;
                } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(caStartTime)) {
                    caStartTime = `${caStartTime}+03:00`;
                }

                const caStartDate = new Date(caStartTime);
                const caEndDate = new Date(caStartDate.getTime() + duration * 60 * 1000);

                // 4. Insert appointment
                const { data: caAppt, error: caApptErr } = await supabase
                    .from("appointments")
                    .insert({
                        tenant_id: tenantId,
                        service_id: args.service_id,
                        staff_id: args.staff_id,
                        customer_id: caCustomer!.id,
                        start_time: caStartDate.toISOString(),
                        end_time: caEndDate.toISOString(),
                        status: "booked",
                        source: "test-lab",
                        notes: `Test Lab üzerinden oluşturuldu (${customerPhone})`,
                    })
                    .select("id")
                    .single();

                if (caApptErr) {
                    return JSON.stringify({
                        success: false,
                        error: "Randevu oluşturulamadı: " + caApptErr.message,
                    });
                }

                return JSON.stringify({
                    success: true,
                    appointmentId: caAppt.id,
                    serviceName: caService?.name || args.service_id,
                    startTime: caStartDate.toISOString(),
                    endTime: caEndDate.toISOString(),
                    message: `Randevu oluşturuldu: ${caService?.name || "Hizmet"}, ${caStartDate.toLocaleDateString("tr-TR")} ${caStartDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`,
                });
            }

            case "cancel_appointment": {
                const cancelApptId = args.appointment_id as string;
                if (!cancelApptId) {
                    return JSON.stringify({ success: false, error: "appointment_id zorunludur." });
                }

                // Verify appointment exists and belongs to tenant
                const { data: cancelAppt } = await supabase
                    .from("appointments")
                    .select("id, status")
                    .eq("id", cancelApptId)
                    .eq("tenant_id", tenantId)
                    .maybeSingle();

                if (!cancelAppt) {
                    return JSON.stringify({ success: false, error: "Randevu bulunamadı veya bu işletmeye ait değil." });
                }
                if (cancelAppt.status === "cancelled") {
                    return JSON.stringify({ success: false, error: "Bu randevu zaten iptal edilmiş." });
                }

                const { error: cancelErr } = await supabase
                    .from("appointments")
                    .update({
                        status: "cancelled",
                        notes: args.reason ? `Test Lab iptal: ${args.reason}` : `Test Lab üzerinden iptal edildi`,
                    })
                    .eq("id", cancelApptId);

                if (cancelErr) {
                    return JSON.stringify({ success: false, error: "İptal başarısız: " + cancelErr.message });
                }

                return JSON.stringify({
                    success: true,
                    appointmentId: cancelApptId,
                    message: "Randevu başarıyla iptal edildi.",
                });
            }

            case "create_appointments_batch": {
                const services = Array.isArray(args.service_names)
                    ? args.service_names.filter((s: unknown) => typeof s === "string" && s.trim().length > 0)
                    : [];
                const batchDate = typeof args.date === "string" ? args.date : "";
                const batchStartTime = typeof args.start_time === "string" ? args.start_time : "";

                if (services.length === 0 || !batchDate || !batchStartTime) {
                    return JSON.stringify({
                        success: false,
                        code: "validation_error",
                        error: "service_names, date ve start_time zorunludur.",
                    });
                }

                // Resolve staff_id from staff_name if needed
                let batchStaffId = typeof args.staff_id === "string" ? args.staff_id.trim() : "";
                if (!batchStaffId && typeof args.staff_name === "string" && args.staff_name.trim()) {
                    const { data: staffRows } = await supabase
                        .from("staff")
                        .select("id, name")
                        .eq("tenant_id", tenantId)
                        .eq("is_active", true);
                    const normalizedInput = args.staff_name.trim().toLocaleLowerCase("tr-TR");
                    const match = (staffRows || []).find(
                        (s: any) => s.name.trim().toLocaleLowerCase("tr-TR") === normalizedInput
                    );
                    if (match) batchStaffId = match.id;
                    else return JSON.stringify({ success: false, error: `"${args.staff_name}" isimli personel bulunamadı.` });
                }

                if (!batchStaffId) {
                    return JSON.stringify({
                        success: false,
                        code: "validation_error",
                        error: "Çoklu randevu için staff_id veya staff_name zorunludur.",
                    });
                }

                // Call batch RPC
                const { data: batchResult, error: batchErr } = await supabase.rpc(
                    "create_appointments_batch_atomic",
                    {
                        p_tenant_id: tenantId,
                        p_customer_phone: customerPhone,
                        p_customer_name: args.customer_name || "Test Lab Müşteri",
                        p_staff_id: batchStaffId,
                        p_date: batchDate,
                        p_start_time: batchStartTime,
                        p_service_names: services,
                        p_require_atomic: args.require_atomic !== false,
                    }
                );

                if (batchErr) {
                    return JSON.stringify({
                        success: false,
                        code: "rpc_error",
                        error: "Çoklu randevu oluşturulamadı: " + batchErr.message,
                    });
                }

                const result = Array.isArray(batchResult) && batchResult.length === 1 ? batchResult[0] : batchResult;
                return JSON.stringify(result ?? { success: false, error: "RPC geçersiz yanıt" });
            }

            case "compose_interactive_message": {
                const kind = typeof args.kind === "string" ? args.kind : "";
                const body = typeof args.body === "string" ? args.body : "";
                if (!body) {
                    return JSON.stringify({ success: false, error: "'body' zorunludur" });
                }

                if (kind === "buttons") {
                    const payload = {
                        body,
                        buttons: Array.isArray(args.buttons) ? args.buttons.slice(0, 3) : [],
                    };
                    return JSON.stringify({
                        success: true,
                        kind,
                        payload,
                        renderedMessage: `<<BUTTONS>>\n${JSON.stringify(payload)}\n<</BUTTONS>>`,
                    });
                }

                if (kind === "list") {
                    const payload = {
                        body,
                        button: typeof args.button_text === "string" ? args.button_text : "Seçiniz",
                        sections: Array.isArray(args.sections) ? args.sections : [],
                    };
                    return JSON.stringify({
                        success: true,
                        kind,
                        payload,
                        renderedMessage: `<<LIST>>\n${JSON.stringify(payload)}\n<</LIST>>`,
                    });
                }

                return JSON.stringify({
                    success: false,
                    error: "kind yalnızca buttons veya list olabilir",
                });
            }

            case "suggest_least_busy_staff": {
                const { data } = await supabase
                    .from("staff")
                    .select("id,name")
                    .eq("tenant_id", tenantId)
                    .eq("is_active", true)
                    .order("name")
                    .limit(3);

                return JSON.stringify({
                    success: true,
                    recommendedStaff: data?.[0] || null,
                    alternatives: (data || []).slice(1),
                });
            }

            case "list_businesses":
                return JSON.stringify({ businesses: [{ tenantId: tenantId, tenantName: "Test İşletmesi" }] });
            case "bind_tenant":
                return JSON.stringify({ success: true, tenant_id: args.tenant_id || tenantId });
            case "ask_human":
                return JSON.stringify({ success: true, message: "Test ortamında handoff simüle edildi." });
            case "end_session":
                return JSON.stringify({ success: true, message: "Test ortamında oturum sonlandırıldı." });
            case "take_notes_for_user": {
                const note = args.note as string;
                if (!note?.trim()) {
                    return JSON.stringify({ success: false, error: "Not içeriği boş olamaz." });
                }

                // Find customer
                const tnPhoneVariants = [
                    customerPhone,
                    customerPhone.replace(/^\+90/, '0'),
                    customerPhone.replace(/^\+/, ''),
                ];
                const { data: tnCustomer } = await supabase
                    .from("customers")
                    .select("id")
                    .eq("tenant_id", tenantId)
                    .in("phone", tnPhoneVariants)
                    .limit(1)
                    .maybeSingle();

                if (tnCustomer) {
                    // Append note to customer's notes field
                    const timestampedNote = `[${new Date().toLocaleDateString("tr-TR")}] ${note.trim()}`;
                    const { data: existingCust } = await supabase
                        .from("customers")
                        .select("notes")
                        .eq("id", tnCustomer.id)
                        .single();

                    const existingNotes = (existingCust as any)?.notes || "";
                    const newNotes = existingNotes ? `${existingNotes}\n${timestampedNote}` : timestampedNote;

                    await supabase
                        .from("customers")
                        .update({ notes: newNotes } as any)
                        .eq("id", tnCustomer.id);
                }

                return JSON.stringify({ success: true, note: note.trim(), message: "Not kaydedildi." });
            }
            case "update_customer_name": {
                const ucFirstName = (args.first_name as string | undefined)?.trim();
                const ucLastName = (args.last_name as string | undefined)?.trim();

                if (!ucFirstName && !ucLastName) {
                    return JSON.stringify({ success: false, error: "Ad veya soyad belirtilmeli." });
                }

                const ucPhoneVariants = [
                    customerPhone,
                    customerPhone.replace(/^\+90/, '0'),
                    customerPhone.replace(/^\+/, ''),
                ];
                const { data: ucCustomer } = await supabase
                    .from("customers")
                    .select("id, name")
                    .eq("tenant_id", tenantId)
                    .in("phone", ucPhoneVariants)
                    .limit(1)
                    .maybeSingle();

                let existingFirst = "";
                let existingLast = "";
                if (ucCustomer?.name) {
                    const parts = ucCustomer.name.trim().split(/\s+/);
                    existingFirst = parts[0] ?? "";
                    existingLast = parts.slice(1).join(" ") || "";
                }

                const newFirst = ucFirstName || existingFirst;
                const newLast = ucLastName || existingLast;
                const fullName = [newFirst, newLast].filter(Boolean).join(" ").trim();

                if (ucCustomer && fullName) {
                    await supabase
                        .from("customers")
                        .update({ name: fullName })
                        .eq("id", ucCustomer.id);
                }

                return JSON.stringify({
                    success: true,
                    fullName: fullName || "(boş)",
                    message: `İsim güncellendi: ${fullName}`,
                });
            }
            
            default:
                return JSON.stringify({
                    error: `Tool '${toolName}' test ortamında desteklenmiyor`,
                    supported_tools: [
                        "list_customer_appointments",
                        "view_available_slots",
                        "create_appointment",
                        "create_appointments_batch",
                        "cancel_appointment",
                        "suggest_least_busy_staff",
                        "list_businesses",
                        "bind_tenant",
                        "ask_human",
                        "end_session",
                        "take_notes_for_user",
                        "update_customer_name",
                        "compose_interactive_message",
                    ]
                });
        }
    } catch (error) {
        console.error(`Tool execution error (${toolName}):`, error);
        return JSON.stringify({ error: `Tool execution failed: ${error instanceof Error ? error.message : "Unknown error"}` });
    }
}

export async function POST(req: Request) {
    try {
        const { messages, model, tenantId, system, phone } = await req.json();
        
        console.log("[Test Lab] Request: model=%s tenant=%s", model, tenantId);

        if (!tenantId) {
            return NextResponse.json({ error: "Test işletmesi seçmelisiniz" }, { status: 400 });
        }

        const supabase = await createClient();
        const openRouterModel = model || "google/gemini-flash-1.5";
        const testPhone = phone || "+905550000000";
        const resolved = await resolveModelTestPromptContext({
            supabase,
            tenantId,
            phone: testPhone,
            systemPrompt: system || "",
        });
        const finalSystemPrompt = resolved.resolvedPrompt;

        // Build initial conversation
        const currentMessages: any[] = [
            { role: "system", content: finalSystemPrompt },
            ...messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
        ];

        let totalMs = 0;
        let totalTokens = { prompt: 0, completion: 0, total: 0 };
        const maxIterations = 5;

        // Create SSE output stream upfront — all events flow through this
        const encoder = new TextEncoder();
        const outputStream = new ReadableStream({
            async start(controller) {
                const emit = (obj: Record<string, unknown>) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
                };

                try {
                    for (let iteration = 1; iteration <= maxIterations; iteration++) {
                        console.log(`[Test Lab] Iteration ${iteration}`);

                        const payload: Record<string, unknown> = {
                            model: openRouterModel,
                            messages: currentMessages,
                            tools: getToolDefinitions(),
                            temperature: 0.7,
                            max_tokens: 4096,
                            stream: true,
                        };
                        if (supportsReasoning(openRouterModel)) {
                            payload.reasoning = { enabled: true, effort: "medium", exclude: false };
                        }

                        const t0 = Date.now();
                        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                                "Content-Type": "application/json",
                                "HTTP-Referer": "https://musait.app",
                                "X-Title": "Musait Test Lab",
                            },
                            body: JSON.stringify(payload),
                        });

                        if (!response.ok) {
                            const errText = await response.text();
                            emit({ type: "error", error: `Model API hatası (${response.status}): ${errText}` });
                            break;
                        }

                        if (!response.body) {
                            emit({ type: "error", error: "Stream body yok" });
                            break;
                        }

                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();

                        let accContent = "";
                        let accReasoning = "";
                        const accToolCalls: any[] = [];
                        let firstTokenEmitted = false;

                        // ── Stream OpenRouter deltas directly to client ──
                        let partial = "";
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            partial += decoder.decode(value, { stream: true });
                            const lines = partial.split("\n");
                            partial = lines.pop() || ""; // keep incomplete line

                            for (const line of lines) {
                                const trimmed = line.trim();
                                if (!trimmed.startsWith("data: ")) continue;
                                const data = trimmed.slice(6);
                                if (data === "[DONE]") continue;

                                try {
                                    const parsed = JSON.parse(data);
                                    const choice = parsed.choices?.[0];
                                    const delta = choice?.delta;

                                    // ── Content tokens → forward immediately ──
                                    if (delta?.content) {
                                        if (!firstTokenEmitted) {
                                            firstTokenEmitted = true;
                                        }
                                        accContent += delta.content;
                                        emit({ type: "content", content: delta.content });
                                    }

                                    // ── Reasoning tokens → forward immediately ──
                                    const reasoning = delta?.reasoning || delta?.reasoning_content || delta?.thinking;
                                    if (reasoning) {
                                        accReasoning += reasoning;
                                        emit({ type: "reasoning", reasoning });
                                    }

                                    // ── Tool calls → accumulate ──
                                    if (delta?.tool_calls) {
                                        for (const tc of delta.tool_calls) {
                                            const idx = tc.index ?? 0;
                                            if (!accToolCalls[idx]) {
                                                accToolCalls[idx] = {
                                                    id: tc.id || "",
                                                    type: "function",
                                                    function: { name: "", arguments: "" },
                                                };
                                            }
                                            if (tc.id) accToolCalls[idx].id = tc.id;
                                            if (tc.function?.name) accToolCalls[idx].function.name += tc.function.name;
                                            if (tc.function?.arguments) accToolCalls[idx].function.arguments += tc.function.arguments;
                                        }
                                    }

                                    // ── Token usage ──
                                    if (parsed.usage) {
                                        totalTokens.prompt = parsed.usage.prompt_tokens || totalTokens.prompt;
                                        totalTokens.completion = parsed.usage.completion_tokens || totalTokens.completion;
                                        totalTokens.total = parsed.usage.total_tokens || totalTokens.total;
                                    }
                                } catch {
                                    // skip invalid json
                                }
                            }
                        }

                        totalMs += Date.now() - t0;
                        const validToolCalls = accToolCalls.filter(tc => tc.id && tc.function.name);

                        console.log(`[Test Lab] Iter ${iteration}: content=${accContent.length}c, reasoning=${accReasoning.length}c, tools=${validToolCalls.length}`);

                        // ── If no tool calls → we're done ──
                        if (validToolCalls.length === 0) {
                            break;
                        }

                        // ── Execute tool calls with timing ──
                        currentMessages.push({
                            role: "assistant",
                            content: accContent || "",
                            tool_calls: validToolCalls,
                        });

                        for (const toolCall of validToolCalls) {
                            const toolName = toolCall.function.name;
                            let toolArgs: any = {};
                            try {
                                toolArgs = JSON.parse(toolCall.function.arguments);
                            } catch {
                                // skip
                            }

                            // Emit tool_call event to client
                            emit({
                                type: "tool_call",
                                id: toolCall.id,
                                name: toolName,
                                arguments: toolArgs,
                            });

                            const toolStart = Date.now();
                            const result = await executeToolCall(toolName, toolArgs, tenantId, testPhone);
                            const durationMs = Date.now() - toolStart;

                            // Emit tool_result event to client
                            let parsedResult: unknown;
                            try { parsedResult = JSON.parse(result); } catch { parsedResult = result; }
                            emit({
                                type: "tool_result",
                                tool_call_id: toolCall.id,
                                name: toolName,
                                result: parsedResult,
                                durationMs,
                            });

                            currentMessages.push({
                                role: "tool",
                                tool_call_id: toolCall.id,
                                name: toolName,
                                content: result,
                            });
                        }

                        // Continue loop → next OpenRouter call (streamed directly)
                    }

                    // ── Emit final metrics ──
                    const tokensPerSec = totalTokens.completion && totalMs > 0
                        ? parseFloat((totalTokens.completion / (totalMs / 1000)).toFixed(1))
                        : 0;

                    emit({
                        type: "metrics",
                        metrics: {
                            totalMs,
                            tokensPerSec,
                            promptTokens: totalTokens.prompt,
                            completionTokens: totalTokens.completion,
                            totalTokens: totalTokens.total,
                            iterations: Math.min(maxIterations, maxIterations),
                        },
                    });

                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                } catch (err) {
                    console.error("[Test Lab] Stream error:", err);
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: "error",
                            error: err instanceof Error ? err.message : "Bilinmeyen hata",
                        })}\n\n`));
                        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    } catch {
                        // controller may be closed
                    }
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(outputStream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        });
    } catch (error) {
        console.error("Model Test Error:", error);
        return NextResponse.json(
            { error: "Modele bağlanılamadı. OPENROUTER_API_KEY'ini kontrol et." },
            { status: 500 }
        );
    }
}
