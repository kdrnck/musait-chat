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

            case "create_appointment": {
                if (!args.service_id || !args.staff_id || !args.start_time) {
                    return JSON.stringify({
                        success: false,
                        code: "validation_error",
                        error: "service_id, staff_id ve start_time zorunludur.",
                    });
                }
                return JSON.stringify({
                    success: true,
                    simulated: true,
                    appointmentId: "test-single-appointment",
                    serviceId: args.service_id,
                    staffId: args.staff_id,
                    startTime: args.start_time,
                });
            }

            case "cancel_appointment": {
                return JSON.stringify({
                    success: true,
                    simulated: true,
                    appointmentId: args.appointment_id || "test-single-appointment",
                });
            }

            case "create_appointments_batch": {
                const services = Array.isArray(args.service_names)
                    ? args.service_names.filter((s: unknown) => typeof s === "string" && s.trim().length > 0)
                    : [];
                const date = typeof args.date === "string" ? args.date : "";
                const startTime = typeof args.start_time === "string" ? args.start_time : "";

                if (services.length === 0 || !date || !startTime) {
                    return JSON.stringify({
                        success: false,
                        code: "validation_error",
                        error: "service_names, date ve start_time zorunludur.",
                    });
                }

                const [hh, mm] = startTime.split(":").map((n: string) => parseInt(n, 10));
                let cursor = (Number.isFinite(hh) ? hh : 9) * 60 + (Number.isFinite(mm) ? mm : 0);
                const appointments = services.map((serviceName: string, idx: number) => {
                    const startHour = String(Math.floor(cursor / 60)).padStart(2, "0");
                    const startMinute = String(cursor % 60).padStart(2, "0");
                    const start = `${date}T${startHour}:${startMinute}:00+03:00`;
                    cursor += 30;
                    const endHour = String(Math.floor(cursor / 60)).padStart(2, "0");
                    const endMinute = String(cursor % 60).padStart(2, "0");
                    const end = `${date}T${endHour}:${endMinute}:00+03:00`;
                    return {
                        appointment_id: `test-batch-${idx + 1}`,
                        service_name: serviceName,
                        start_time: start,
                        end_time: end,
                    };
                });

                return JSON.stringify({
                    success: true,
                    simulated: true,
                    count: appointments.length,
                    appointments,
                });
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
            case "take_notes_for_user":
                return JSON.stringify({ success: true, note: args.note || "" });
            case "update_customer_name":
                return JSON.stringify({
                    success: true,
                    fullName: [args.first_name, args.last_name].filter(Boolean).join(" ").trim(),
                });
            
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
        
        console.log("[Model Test Lab] Received request with model:", model, "tenant:", tenantId);

        if (!tenantId) {
            return NextResponse.json(
                { error: "Test işletmesi seçmelisiniz" },
                { status: 400 }
            );
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
        const placeholders = resolved.placeholders;
        const finalSystemPrompt = resolved.resolvedPrompt;
        const unresolvedPlaceholders = resolved.unresolvedPlaceholders;

        console.log("[Model Test Lab] Using model:", openRouterModel);
        console.log("[Model Test Lab] Resolved placeholders:", Object.keys(placeholders).length);
        console.log("[Model Test Lab] Unresolved placeholders:", unresolvedPlaceholders.join(", "));
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
                                tenantId,
                                phone: testPhone,
                                unresolvedPlaceholders,
                                placeholderPreview: Object.fromEntries(Object.entries(placeholders).slice(0, 8)),
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
