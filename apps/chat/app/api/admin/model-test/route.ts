import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

// =========================================================================
// PLACEHOLDER RESOLUTION HELPERS
// =========================================================================

/**
 * Get current date and day name in Istanbul timezone
 */
function getCurrentDateInfo(): { date: string; dayName: string } {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("tr-TR", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "long",
    });

    const parts = formatter.formatToParts(now);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    const weekday = parts.find((p) => p.type === "weekday")?.value;

    return {
        date: `${year}-${month}-${day}`,
        dayName: weekday || "Bilinmiyor",
    };
}

/**
 * Resolve placeholders in system prompt
 */
function resolvePlaceholders(
    prompt: string,
    placeholders: Record<string, string>
): string {
    let resolved = prompt;
    for (const [key, value] of Object.entries(placeholders)) {
        // Support both {{placeholder}} and {placeholder} formats
        const doubleBrace = `{{${key}}}`;
        const singleBrace = `{${key}}`;
        resolved = resolved.replaceAll(doubleBrace, value);
        resolved = resolved.replaceAll(singleBrace, value);
    }
    return resolved;
}

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
                name: "list_services",
                description: "İşletmedeki hizmetleri listeler. service_id bilgisi gerektiğinde önce bunu çağır.",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string", description: "Hizmet adı filtre metni (opsiyonel)" },
                        include_inactive: { type: "boolean", description: "Pasif hizmetleri de dahil et (varsayılan: false)" },
                    },
                    required: [],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "list_staff",
                description: "İşletmedeki personeli listeler. service_id verilirse yalnızca o hizmete uygun personeli döndürür.",
                parameters: {
                    type: "object",
                    properties: {
                        service_id: { type: "string", description: "Hizmet ID (opsiyonel filtre)" },
                        query: { type: "string", description: "Personel adı filtre metni (opsiyonel)" },
                        include_inactive: { type: "boolean", description: "Pasif personeli de dahil et (varsayılan: false)" },
                    },
                    required: [],
                },
            },
        },
        {
            type: "function",
            function: {
                name: "get_business_info",
                description: "Aktif işletmenin temel bilgilerini döndürür.",
                parameters: { type: "object", properties: {}, required: [] },
            },
        },
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
                name: "get_customer_profile",
                description: "Konuşmadaki müşterinin profilini, adını ve geçmiş verilerini döndürür. Müşteri adını öğrenmek için bunu kullan.",
                parameters: { type: "object", properties: {}, required: [] },
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
                        start_time: { type: "string", description: "Başlangıç zamanı (ISO 8601 formatında)" },
                        customer_name: { type: "string", description: "Müşteri adı (opsiyonel)" },
                    },
                    required: ["service_id", "staff_id", "start_time"],
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
                // Simplified - return mock data for now
                return JSON.stringify({
                    date: args.date,
                    slots: [
                        { time: "10:00", available: true },
                        { time: "11:00", available: true },
                        { time: "14:00", available: false },
                        { time: "15:00", available: true },
                    ]
                });
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
            
            default:
                return JSON.stringify({
                    error: `Tool '${toolName}' test ortamında desteklenmiyor`,
                    supported_tools: ["list_services", "list_staff", "get_business_info", "view_available_slots"]
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
        
        console.log("[Model Test Lab] Received request with model:", model, "tenant:", tenantId);

        if (!tenantId) {
            return NextResponse.json(
                { error: "Test işletmesi seçmelisiniz" },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        const openRouterModel = model || "google/gemini-flash-1.5";

        // ── Fetch tenant info for placeholder resolution ──
        let tenantName = "Test İşletmesi";
        let businessInfoText = "";
        
        try {
            const { data: tenant } = await supabase
                .from("tenants")
                .select("name, phone, address, description")
                .eq("id", tenantId)
                .single();
            
            if (tenant) {
                tenantName = tenant.name || tenantName;
                const infoParts: string[] = [];
                if (tenant.name) infoParts.push(`İşletme: ${tenant.name}`);
                if (tenant.phone) infoParts.push(`Telefon: ${tenant.phone}`);
                if (tenant.address) infoParts.push(`Adres: ${tenant.address}`);
                if (tenant.description) infoParts.push(`Açıklama: ${tenant.description}`);
                businessInfoText = infoParts.join("\n");
            }
        } catch (err) {
            console.warn("[Model Test Lab] Could not fetch tenant info:", err);
        }

        // ── Fetch services and staff lists for placeholders ──
        let servicesListText = "";
        let staffListText = "";
        
        try {
            // Get services
            const { data: services, error: svcError } = await supabase
                .from("services")
                .select("id, name, duration_minutes, price, is_active")
                .eq("tenant_id", tenantId)
                .eq("is_active", true)
                .order("name");
            
            if (svcError) {
                console.error("[Model Test Lab] Services query error:", svcError);
                servicesListText = "(Hizmet listesi alınamadı)";
            } else if (services && services.length > 0) {
                servicesListText = services
                    .map((s: any) => `- ${s.name} (${s.duration_minutes} dk, ${s.price} TL)`)
                    .join("\n");
                console.log(`[Model Test Lab] Fetched ${services.length} services for placeholder`);
            } else {
                servicesListText = "(Henüz hizmet tanımlanmamış)";
                console.log("[Model Test Lab] No active services found for tenant:", tenantId);
            }

            // Get staff
            const { data: staff, error: staffError } = await supabase
                .from("staff")
                .select("id, name, is_active")
                .eq("tenant_id", tenantId)
                .eq("is_active", true)
                .order("name");
            
            if (staffError) {
                console.error("[Model Test Lab] Staff query error:", staffError);
                staffListText = "(Personel listesi alınamadı)";
            } else if (staff && staff.length > 0) {
                staffListText = staff.map((s: any) => `- ${s.name}`).join("\n");
                console.log(`[Model Test Lab] Fetched ${staff.length} staff for placeholder`);
            } else {
                staffListText = "(Henüz personel tanımlanmamış)";
                console.log("[Model Test Lab] No active staff found for tenant:", tenantId);
            }
        } catch (err) {
            console.error("[Model Test Lab] Could not fetch services/staff:", err);
            servicesListText = "(Hizmet listesi alınamadı)";
            staffListText = "(Personel listesi alınamadı)";
        }

        // ── Fetch customer profile for placeholder resolution ──
        let customerName = "Test Kullanıcısı";
        let customerProfileText = "";
        let authUser: any = null;
        const testPhone = phone || "+905550000000";
        
        // Normalize phone number — produce all common Turkish mobile formats
        const rawPhone = testPhone.replace(/[\s\-().]/g, ''); // strip spaces/dashes/parens
        let canonical = rawPhone;
        if (/^\+900[0-9]{10}$/.test(rawPhone)) {
            canonical = '+90' + rawPhone.slice(4);        // +9005XXXXXXXXX → +905XXXXXXXXX (strip extra 0)
        } else if (/^\+90[0-9]{10}$/.test(rawPhone)) {
            canonical = rawPhone;                          // +905XXXXXXXXX ✓
        } else if (/^900[0-9]{10}$/.test(rawPhone)) {
            canonical = '+90' + rawPhone.slice(3);        // 9005XXXXXXXXX → +905XXXXXXXXX
        } else if (/^90[0-9]{10}$/.test(rawPhone)) {
            canonical = '+' + rawPhone;                   // 905XXXXXXXXX → +905XXXXXXXXX
        } else if (/^0[0-9]{10}$/.test(rawPhone)) {
            canonical = '+9' + rawPhone;                  // 05XXXXXXXXX  → +905XXXXXXXXX
        } else if (/^[0-9]{10}$/.test(rawPhone)) {
            canonical = '+90' + rawPhone;                 // 5XXXXXXXXX   → +905XXXXXXXXX
        }
        const phoneVariants = [...new Set([
            testPhone,
            canonical,
            canonical.replace(/^\+90/, '0'),   // +905XXXXXXXXX → 05XXXXXXXXX
            canonical.replace(/^\+/, ''),       // +905XXXXXXXXX → 905XXXXXXXXX
            canonical.replace(/^\+90/, ''),     // +905XXXXXXXXX → 5XXXXXXXXX
        ])];
        
        console.log("[Model Test Lab] Looking up customer — raw:", testPhone, "canonical:", canonical, "variants:", phoneVariants);
        
        try {
            // Use the session client — admin users have RLS access via is_master_admin() / has_tenant_access()
            const { data: { user: fetchedUser } } = await supabase.auth.getUser();
            authUser = fetchedUser;
            console.log("[Model Test Lab] Auth user:", authUser?.id, authUser?.email);
            
            const { data: customer, error: customerError } = await supabase
                .from("customers")
                .select("id, name, phone, created_at")
                .eq("tenant_id", tenantId)
                .in("phone", phoneVariants)
                .limit(1)
                .maybeSingle();
            
            if (customerError) {
                console.warn("[Model Test Lab] Customer query error:", customerError);
            }
            
            console.log("[Model Test Lab] Customer lookup result:", customer ? `Found: ${customer.name}` : "Not found");
            
            if (customer) {
                if (customer.name) {
                    customerName = customer.name;
                }

                // Build customer profile text
                const profileParts: string[] = [];
                profileParts.push(`Telefon: ${customer.phone}`);
                if (customer.name) profileParts.push(`Ad: ${customer.name}`);
                if (customer.created_at) {
                    const createdDate = new Date(customer.created_at).toLocaleDateString('tr-TR');
                    profileParts.push(`Kayıt Tarihi: ${createdDate}`);
                }

                // Get customer's last 3 appointments for profile
                const { data: appointments, error: aptError } = await supabase
                    .from("appointments")
                    .select(`
                        id,
                        start_time,
                        end_time,
                        status,
                        services (name),
                        staff (name)
                    `)
                    .eq("customer_id", customer.id)
                    .eq("tenant_id", tenantId)
                    .order("start_time", { ascending: false })
                    .limit(3);

                if (aptError) {
                    console.error("[Model Test Lab] Appointments query error:", aptError);
                }

                if (appointments && appointments.length > 0) {
                    profileParts.push(`Son ${appointments.length} Randevu:`);
                    appointments.forEach((apt: any, idx: number) => {
                        const aptDate = new Date(apt.start_time).toLocaleString("tr-TR", {
                            timeZone: "Europe/Istanbul",
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                        });
                        const service = apt.services?.name || "Bilinmiyor";
                        const staff = apt.staff?.name || "Bilinmiyor";
                        const status = apt.status || "Bilinmiyor";
                        profileParts.push(`  ${idx + 1}. ${aptDate} - ${service} (Personel: ${staff}, Durum: ${status})`);
                    });
                } else {
                    profileParts.push("Son Randevu: (Henüz randevu yok)");
                }

                customerProfileText = profileParts.join("\n");
            } else {
                // No customer found
                customerProfileText = `Telefon: ${testPhone}\n(Yeni müşteri - henüz randevu kaydı yok)`;
            }
        } catch (err) {
            console.warn("[Model Test Lab] Could not fetch customer info:", err);
            customerProfileText = `Telefon: ${testPhone}\n(Profil bilgisi alınamadı)`;
        }

        console.log("[Model Test Lab] Resolved customerProfileText:", customerProfileText);

        // ── Resolve placeholders in system prompt ──
        const dateInfo = getCurrentDateInfo();
        
        const placeholders: Record<string, string> = {
            current_date: dateInfo.date,
            current_day_name: dateInfo.dayName,
            tenant_name: tenantName,
            tenant_id: tenantId,
            business_name: tenantName,
            business_info: businessInfoText || "Bilgi mevcut değil",
            services_list: servicesListText || "Hizmet listesi yok",
            staff_list: staffListText || "Personel listesi yok",
            customer_first_name: customerName.split(" ")[0] || customerName,
            customer_name: customerName,
            customer_profile: customerProfileText || "Profil bilgisi yok",
            test_phone: testPhone,
        };

        const resolvedSystemPrompt = resolvePlaceholders(system, placeholders);
        const finalSystemPrompt = `${resolvedSystemPrompt}\n\nTest Numarası: ${testPhone}\nTenant ID: ${tenantId}`;

        console.log("[Model Test Lab] Using model:", openRouterModel);
        console.log("[Model Test Lab] Resolved placeholders:", Object.keys(placeholders).length);
        console.log("[Model Test Lab] Customer name:", customerName);
        console.log("[Model Test Lab] Customer profile:", customerProfileText.substring(0, 500));
        console.log("[Model Test Lab] Final system prompt (first 500 chars):", finalSystemPrompt.substring(0, 500));

        // Build initial conversation
        const conversationMessages = [
            { role: "system", content: finalSystemPrompt },
            ...messages.map((m: ChatMessage) => ({
                role: m.role,
                content: m.content,
            })),
        ];

        let currentMessages = [...conversationMessages];
        let totalMs = 0;
        let totalTokens = { prompt: 0, completion: 0, total: 0 };
        let iterations = 0;
        const maxIterations = 5; // Prevent infinite loops
        
        let collectedToolCalls: ToolCall[] = [];

        // Multi-turn conversation loop for tool calling
        while (iterations < maxIterations) {
            iterations++;
            
            // Always stream - we'll handle tool calls in the stream
            const shouldStream = true;
            
            console.log(`[Model Test Lab] Iteration ${iterations}, streaming: ${shouldStream}`);
            
            const payload: Record<string, unknown> = {
                model: openRouterModel,
                messages: currentMessages,
                tools: getToolDefinitions(),
                temperature: 0.7,
                max_tokens: 4096,
                stream: shouldStream,
            };

            if (supportsReasoning(openRouterModel)) {
                payload.reasoning = {
                    enabled: true,
                    effort: "medium",
                    exclude: false,
                };
            }

            const startTime = Date.now();

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://musait.app",
                    "X-Title": "Musait Model Test Lab",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`OpenRouter API error (${response.status}):`, errorText);
                return NextResponse.json(
                    { error: `Model API hatası (${response.status}): ${errorText}` },
                    { status: response.status }
                );
            }

            // If streaming is enabled
            if (payload.stream && response.body) {
                const decoder = new TextDecoder();
                const reader = response.body.getReader();
                
                // Accumulate the full response first
                let accumulatedContent = "";
                let accumulatedReasoning = "";
                let accumulatedToolCalls: any[] = [];
                let finishReason = "";
                
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        
                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n').filter(line => line.trim() !== '');
                        
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const data = line.slice(6);
                                if (data === '[DONE]') continue;
                                
                                try {
                                    const parsed = JSON.parse(data);
                                    const choice = parsed.choices?.[0];
                                    const delta = choice?.delta;
                                    
                                    if (delta?.content) {
                                        accumulatedContent += delta.content;
                                    }
                                    
                                    // Handle reasoning from various model formats
                                    const reasoning = delta?.reasoning || delta?.reasoning_content || delta?.thinking;
                                    if (reasoning) {
                                        accumulatedReasoning += reasoning;
                                    }
                                    
                                    // Accumulate tool calls
                                    if (delta?.tool_calls) {
                                        for (const tc of delta.tool_calls) {
                                            const idx = tc.index ?? 0;
                                            if (!accumulatedToolCalls[idx]) {
                                                accumulatedToolCalls[idx] = {
                                                    id: tc.id || "",
                                                    type: "function",
                                                    function: { name: "", arguments: "" }
                                                };
                                            }
                                            if (tc.id) accumulatedToolCalls[idx].id = tc.id;
                                            if (tc.function?.name) accumulatedToolCalls[idx].function.name += tc.function.name;
                                            if (tc.function?.arguments) accumulatedToolCalls[idx].function.arguments += tc.function.arguments;
                                        }
                                    }
                                    
                                    if (choice?.finish_reason) {
                                        finishReason = choice.finish_reason;
                                    }
                                    
                                    // Update token counts if available
                                    if (parsed.usage) {
                                        totalTokens.prompt = parsed.usage.prompt_tokens || totalTokens.prompt;
                                        totalTokens.completion = parsed.usage.completion_tokens || totalTokens.completion;
                                        totalTokens.total = parsed.usage.total_tokens || totalTokens.total;
                                    }
                                } catch (e) {
                                    // Skip invalid JSON
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Stream reading error:', error);
                }
                
                const endTime = Date.now();
                totalMs += endTime - startTime;
                
                // Filter out empty tool calls
                const validToolCalls = accumulatedToolCalls.filter(tc => tc.id && tc.function.name);
                
                console.log(`[Model Test Lab] Stream complete. Content: ${accumulatedContent.length} chars, Reasoning: ${accumulatedReasoning.length} chars, Tool calls: ${validToolCalls.length}`);
                
                // If there are tool calls, execute them and continue the loop
                if (validToolCalls.length > 0) {
                    console.log(`[Model Test Lab] Executing ${validToolCalls.length} tool calls`);
                    
                    // Add assistant message with tool calls to conversation
                    currentMessages.push({
                        role: "assistant",
                        content: accumulatedContent || "",
                        tool_calls: validToolCalls,
                    });

                    // Execute each tool call
                    for (const toolCall of validToolCalls) {
                        const toolName = toolCall.function.name;
                        let toolArgs: any = {};
                        try {
                            toolArgs = JSON.parse(toolCall.function.arguments);
                        } catch (e) {
                            console.error("Failed to parse tool arguments:", toolCall.function.arguments);
                        }

                        console.log(`[Model Test Lab] Executing tool: ${toolName}`, toolArgs);
                        
                        const result = await executeToolCall(toolName, toolArgs, tenantId, testPhone);
                        
                        currentMessages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            name: toolName,
                            content: result,
                        });
                    }
                    
                    // Continue loop to get final response
                    continue;
                }
                
                // No tool calls - stream the accumulated response to client
                const encoder = new TextEncoder();
                const outputStream = new ReadableStream({
                    async start(controller) {
                        // DEBUG: Send resolved customer profile info as first SSE event
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'debug',
                            debug: {
                                authUser: authUser?.email || 'NO_AUTH',
                                phone: testPhone,
                                canonical: canonical,
                                customerName,
                                customerProfileText: customerProfileText.substring(0, 300),
                                resolvedSystemPromptPreview: finalSystemPrompt.substring(0, 400),
                            }
                        })}\n\n`));

                        // First send reasoning in chunks (if any)
                        if (accumulatedReasoning) {
                            const reasoningChunks = accumulatedReasoning.match(/.{1,50}/g) || [accumulatedReasoning];
                            for (const chunk of reasoningChunks) {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                    type: 'reasoning',
                                    reasoning: chunk
                                })}\n\n`));
                                await new Promise(r => setTimeout(r, 10)); // Small delay for visual effect
                            }
                        }
                        
                        // Then send content in chunks
                        if (accumulatedContent) {
                            const contentChunks = accumulatedContent.match(/.{1,30}/g) || [accumulatedContent];
                            for (const chunk of contentChunks) {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                    type: 'content',
                                    content: chunk
                                })}\n\n`));
                                await new Promise(r => setTimeout(r, 15)); // Small delay for visual effect
                            }
                        }
                        
                        // Send final metrics
                        const tokensPerSec = totalTokens.completion
                            ? ((totalTokens.completion / (totalMs / 1000)) * 1).toFixed(1)
                            : "0";
                        
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'metrics',
                            metrics: {
                                totalMs,
                                tokensPerSec: parseFloat(tokensPerSec),
                                promptTokens: totalTokens.prompt,
                                completionTokens: totalTokens.completion,
                                totalTokens: totalTokens.total,
                                iterations,
                            }
                        })}\n\n`));
                        
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                        controller.close();
                    }
                });
                
                return new Response(outputStream, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                });
            }

            // Non-streaming fallback path (shouldn't reach here normally)
            const data = await response.json();
            const choice = data.choices?.[0];

            if (!choice) {
                return NextResponse.json({ error: "Model yanıt vermedi" }, { status: 500 });
            }

            const endTime = Date.now();
            totalMs += endTime - startTime;
            
            const usage = data.usage || {};
            totalTokens.prompt += usage.prompt_tokens || 0;
            totalTokens.completion += usage.completion_tokens || 0;
            totalTokens.total += usage.total_tokens || 0;

            const message = choice.message;
            const toolCalls: ToolCall[] = message.tool_calls || [];
            const reasoning = message.reasoning || message.thinking || null;

            // If no tool calls, this is the final response
            if (!toolCalls || toolCalls.length === 0) {
                const tokensPerSec = totalTokens.completion
                    ? ((totalTokens.completion / (totalMs / 1000)) * 1).toFixed(1)
                    : "0";

                return NextResponse.json({
                    role: "assistant",
                    content: message.content || "",
                    tool_calls: [],
                    reasoning: reasoning,
                    metrics: {
                        totalMs,
                        tokensPerSec: parseFloat(tokensPerSec),
                        promptTokens: totalTokens.prompt,
                        completionTokens: totalTokens.completion,
                        totalTokens: totalTokens.total,
                        iterations,
                    },
                });
            }

            // Execute tool calls
            console.log(`[Model Test Lab] Non-streaming: Executing ${toolCalls.length} tool calls`);
            
            // Add assistant message with tool calls to conversation
            currentMessages.push({
                role: "assistant",
                content: message.content || "",
                tool_calls: toolCalls,
            });

            // Execute each tool call and add results
            for (const toolCall of toolCalls) {
                const toolName = toolCall.function.name;
                let toolArgs: any = {};
                try {
                    toolArgs = JSON.parse(toolCall.function.arguments);
                } catch (e) {
                    console.error("Failed to parse tool arguments:", toolCall.function.arguments);
                }

                console.log(`[Model Test Lab] Executing tool: ${toolName}`, toolArgs);
                
                const result = await executeToolCall(toolName, toolArgs, tenantId, testPhone);
                
                currentMessages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: toolName,
                    content: result,
                });
            }

            // Continue loop to get final response
        }

        // If we hit max iterations
        return NextResponse.json({
            role: "assistant",
            content: "⚠️ Maksimum tool call iterasyonuna ulaşıldı. Conversation çok karmaşık.",
            tool_calls: [],
            reasoning: null,
            metrics: {
                totalMs,
                tokensPerSec: 0,
                promptTokens: totalTokens.prompt,
                completionTokens: totalTokens.completion,
                totalTokens: totalTokens.total,
                iterations,
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
