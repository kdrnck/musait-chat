/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Settings, Activity, Clock, Zap, Bot, User, Code2, RefreshCw, Cpu, Save, Trash2, Wrench, Brain, Pencil, ChevronDown, ChevronRight, List, CheckSquare } from "lucide-react";

interface AiModel {
    id: string;
    openrouter_id: string;
    display_name: string;
    is_enabled: boolean;
    pricing_input: number | null;
    pricing_output: number | null;
    supports_tools: boolean;
    supports_reasoning: boolean;
    context_window: number | null;
    max_output_tokens: number | null;
    max_iterations: number | null;
    llm_timeout_ms: number | null;
    tier: string | null;
    description: string | null;
}

interface Tenant {
    id: string;
    name: string;
}

interface SavedPrompt {
    id: string;
    name: string;
    description?: string;
    category: string;
    prompt_text: string;
    model_id?: string;
    tenant_id?: string;
    parameters?: Record<string, any>;
    is_active?: boolean;
    is_default?: boolean;
    created_at?: string;
    updated_at?: string;
}

interface ToolEvent {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    durationMs?: number;
}

interface ChatMetrics {
    totalMs: number;
    tokensPerSec: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    iterations?: number;
    estimatedCost?: number;
}

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    reasoning?: string;
    toolEvents?: ToolEvent[];
    metrics?: ChatMetrics;
    modelOpenRouterId?: string;
}

/* ─── WhatsApp interactive message renderer ─── */

function WAInteractivePreview({ result }: { result: Record<string, unknown> }) {
    const kind = result.kind as string | undefined;
    const payload = result.payload as Record<string, unknown> | undefined;
    if (!payload) return <pre className="text-[10px] text-blue-200 font-mono">{JSON.stringify(result, null, 2)}</pre>;

    const body = payload.body as string || "";

    if (kind === "buttons") {
        const buttons = (payload.buttons as Array<{ id: string; title: string }>) || [];
        return (
            <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden text-[12px] max-w-[280px]">
                <div className="px-3 py-2.5 text-[var(--color-text-primary)] leading-snug">{body}</div>
                <div className="border-t border-white/10">
                    {buttons.map((btn) => (
                        <div key={btn.id} className="px-3 py-2 flex items-center justify-center gap-2 border-b border-white/5 last:border-0 text-blue-400 font-semibold hover:bg-white/5 cursor-default">
                            <CheckSquare size={12} />
                            {btn.title}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (kind === "list") {
        const sections = (payload.sections as Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>) || [];
        const buttonText = (payload.button as string) || "Seçiniz";
        return (
            <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden text-[12px] max-w-[280px]">
                <div className="px-3 py-2.5 text-[var(--color-text-primary)] leading-snug">{body}</div>
                <div className="border-t border-white/10 px-3 py-1.5 flex items-center gap-1.5 text-blue-400 font-semibold">
                    <List size={12} /> {buttonText}
                </div>
                {sections.map((sec, si) => (
                    <div key={si} className="border-t border-white/10">
                        {sec.title && <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{sec.title}</div>}
                        {sec.rows.map((row) => (
                            <div key={row.id} className="px-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/5 cursor-default">
                                <div className="text-[var(--color-text-primary)] font-medium">{row.title}</div>
                                {row.description && <div className="text-[11px] text-[var(--color-text-muted)]">{row.description}</div>}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    return <pre className="text-[10px] text-blue-200 font-mono">{JSON.stringify(result, null, 2)}</pre>;
}

function WAContentRenderer({ content }: { content: string }) {
    // Detect <<BUTTONS>>...<</ BUTTONS>> or <<LIST>>...</ LIST>> patterns emitted by server
    const buttonMatch = content.match(/<<BUTTONS>>\s*([\s\S]*?)\s*<<\/BUTTONS>>/);
    const listMatch = content.match(/<<LIST>>\s*([\s\S]*?)\s*<<\/LIST>>/);
    const match = buttonMatch || listMatch;
    if (match) {
        try {
            const parsed = JSON.parse(match[1]);
            const kind = buttonMatch ? "buttons" : "list";
            const preText = content.slice(0, content.indexOf(match[0])).trim();
            const postText = content.slice(content.indexOf(match[0]) + match[0].length).trim();
            return (
                <div className="space-y-2">
                    {preText && <p className="whitespace-pre-wrap">{preText}</p>}
                    <WAInteractivePreview result={{ kind, payload: parsed }} />
                    {postText && <p className="whitespace-pre-wrap">{postText}</p>}
                </div>
            );
        } catch { /* not valid json, fall through */ }
    }
    return <span className="whitespace-pre-wrap">{content}</span>;
}

export default function ModelTestPanel({ debugMode }: { debugMode: boolean }) {
    const [models, setModels] = useState<AiModel[]>([]);
    const [loadingModels, setLoadingModels] = useState(true);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loadingTenants, setLoadingTenants] = useState(true);
    
    // Persisted settings
    const [model, setModel] = useState("");
    const [tenantId, setTenantId] = useState("");
    const [phone, setPhone] = useState("");
    const [system, setSystem] = useState("");
    
    // Saved prompts
    const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
    const [loadingPrompts, setLoadingPrompts] = useState(true);
    const [showSavePrompt, setShowSavePrompt] = useState(false);
    const [newPromptTitle, setNewPromptTitle] = useState("");
    const [editingPrompt, setEditingPrompt] = useState<SavedPrompt | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editContent, setEditContent] = useState("");
    
    // Chat state
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [lastMetrics, setLastMetrics] = useState<any>(null);
    const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());
    const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
    const [resolvedPromptPreview, setResolvedPromptPreview] = useState("");
    const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
    const [unresolvedPlaceholders, setUnresolvedPlaceholders] = useState<string[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const selectedModelInfo = models.find((m) => m.openrouter_id === model) ?? null;

    // Load settings from localStorage (phone and system only - model and tenant loaded after lists)
    useEffect(() => {
        const savedPhone = localStorage.getItem("modelTest_phone") || "+905550000000";
        const savedSystem = localStorage.getItem("modelTest_system") || "Sen profesyonel bir yapay zeka asistanısın. Kısa ve öz yanıtlar ver.";
        
        setPhone(savedPhone);
        setSystem(savedSystem);
    }, []);

    // Load saved prompts from database
    useEffect(() => {
        const loadPrompts = async () => {
            try {
                const res = await fetch("/api/admin/prompt-templates?category=general", { cache: "no-store" });
                if (!res.ok) throw new Error("Promptlar yüklenemedi");
                const data = await res.json();
                setSavedPrompts(data);
            } catch (err) {
                console.error("Prompt yükleme hatası:", err);
            } finally {
                setLoadingPrompts(false);
            }
        };
        void loadPrompts();
    }, []);

    // Save settings to localStorage
    useEffect(() => {
        if (model) localStorage.setItem("modelTest_model", model);
    }, [model]);

    useEffect(() => {
        if (tenantId) localStorage.setItem("modelTest_tenantId", tenantId);
    }, [tenantId]);

    useEffect(() => {
        if (phone) localStorage.setItem("modelTest_phone", phone);
    }, [phone]);

    useEffect(() => {
        if (system) localStorage.setItem("modelTest_system", system);
    }, [system]);

    // Load models from API
    useEffect(() => {
        const loadModels = async () => {
            try {
                const res = await fetch("/api/admin/models", { cache: "no-store" });
                if (!res.ok) throw new Error("Modeller yüklenemedi");
                const data = await res.json();
                const enabledModels = data.filter((m: AiModel) => m.is_enabled);
                setModels(enabledModels);
                
                // Validate current model and set default if needed
                const savedModel = localStorage.getItem("modelTest_model");
                const currentModelExists = enabledModels.some((m: AiModel) => m.openrouter_id === savedModel);
                
                if (!savedModel || !currentModelExists) {
                    // If no saved model or saved model is no longer available, use first enabled model
                    if (enabledModels.length > 0) {
                        const defaultModel = enabledModels[0].openrouter_id;
                        setModel(defaultModel);
                        localStorage.setItem("modelTest_model", defaultModel);
                    }
                } else {
                    // Make sure state is in sync with localStorage
                    setModel(savedModel);
                }
            } catch (err) {
                console.error("Model yükleme hatası:", err);
            } finally {
                setLoadingModels(false);
            }
        };
        void loadModels();
    }, []);

    // Load tenants from API
    useEffect(() => {
        const loadTenants = async () => {
            try {
                const res = await fetch("/api/admin/tenants", { cache: "no-store" });
                if (!res.ok) throw new Error("Tenantlar yüklenemedi");
                const data = await res.json();
                setTenants(data);
                
                // Validate and set tenant
                const savedTenantId = localStorage.getItem("modelTest_tenantId");
                const currentTenantExists = data.some((t: Tenant) => t.id === savedTenantId);
                
                if (!savedTenantId || !currentTenantExists) {
                    if (data.length > 0) {
                        const defaultTenant = data[0].id;
                        setTenantId(defaultTenant);
                        localStorage.setItem("modelTest_tenantId", defaultTenant);
                    }
                } else {
                    setTenantId(savedTenantId);
                }
            } catch (err) {
                console.error("Tenant yükleme hatası:", err);
            } finally {
                setLoadingTenants(false);
            }
        };
        void loadTenants();
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (!tenantId) return;

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setPreviewLoading(true);
            setPreviewError(null);
            try {
                const response = await fetch("/api/admin/model-test/resolve-context", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tenantId,
                        phone,
                        system,
                    }),
                    signal: controller.signal,
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Preview çözümlenemedi");
                }
                setPlaceholderValues(data.placeholders || {});
                setResolvedPromptPreview(data.resolvedPrompt || "");
                setUnresolvedPlaceholders(Array.isArray(data.unresolvedPlaceholders) ? data.unresolvedPlaceholders : []);
            } catch (err) {
                if ((err as Error).name === "AbortError") return;
                setPreviewError(err instanceof Error ? err.message : "Preview hatası");
            } finally {
                setPreviewLoading(false);
            }
        }, 250);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [tenantId, phone, system]);

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;
        
        if (!model || model.trim() === "") {
            alert("Lütfen bir model seçin");
            return;
        }

        if (!tenantId || tenantId.trim() === "") {
            alert("Lütfen bir test işletmesi seçin");
            return;
        }

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: input.trim(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        // Create a placeholder assistant message that will be updated
        const assistantMessageId = (Date.now() + 1).toString();
        const assistantMessage: ChatMessage = {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            toolEvents: [],
            modelOpenRouterId: model,
        };
        
        setMessages((prev) => [...prev, assistantMessage]);

        try {
            console.log("Sending message with model:", model);
            const res = await fetch("/api/admin/model-test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                    model,
                    tenantId,
                    system,
                    phone,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || "API hatası");
            }

            // Check if response is streaming
            const contentType = res.headers.get("content-type");
            
            if (contentType?.includes("text/event-stream")) {
                // Handle streaming response
                const reader = res.body?.getReader();
                const decoder = new TextDecoder();
                
                if (!reader) {
                    throw new Error("Stream reader not available");
                }

                let accumulatedContent = "";
                let accumulatedReasoning = "";
                let finalMetrics = null;
                // local mutable copy of tool events for this stream
                const streamToolEvents: ToolEvent[] = [];
                let partial = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    partial += decoder.decode(value, { stream: true });
                    const lines = partial.split("\n");
                    partial = lines.pop() ?? "";

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith("data: ")) continue;
                        const data = trimmed.slice(6);
                        if (data === "[DONE]") continue;

                        try {
                            const parsed = JSON.parse(data);

                            if (parsed.type === "debug") {
                                console.log("[Model Test Lab] DEBUG:", parsed.debug);
                            }

                            if (parsed.type === "error") {
                                accumulatedContent = `❌ ${parsed.error}`;
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === assistantMessageId ? { ...m, content: accumulatedContent } : m
                                    )
                                );
                            }

                            if (parsed.type === "content" && parsed.content) {
                                accumulatedContent += parsed.content;
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === assistantMessageId ? { ...m, content: accumulatedContent } : m
                                    )
                                );
                            }

                            if (parsed.type === "reasoning" && parsed.reasoning) {
                                accumulatedReasoning += parsed.reasoning;
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === assistantMessageId ? { ...m, reasoning: accumulatedReasoning } : m
                                    )
                                );
                            }

                            if (parsed.type === "tool_call") {
                                const ev: ToolEvent = {
                                    id: parsed.id || `tc-${Date.now()}`,
                                    name: parsed.name,
                                    arguments: parsed.arguments || {},
                                };
                                streamToolEvents.push(ev);
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === assistantMessageId
                                            ? { ...m, toolEvents: [...streamToolEvents] }
                                            : m
                                    )
                                );
                            }

                            if (parsed.type === "tool_result") {
                                const existing = streamToolEvents.find((t) => t.id === parsed.tool_call_id);
                                if (existing) {
                                    existing.result = parsed.result;
                                    existing.durationMs = parsed.durationMs ?? null;
                                } else {
                                    // fallback — match by name if id missing
                                    const last = streamToolEvents[streamToolEvents.length - 1];
                                    if (last && !last.result) {
                                        last.result = parsed.result;
                                        last.durationMs = parsed.durationMs ?? null;
                                    }
                                }
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === assistantMessageId
                                            ? { ...m, toolEvents: [...streamToolEvents] }
                                            : m
                                    )
                                );
                            }

                            if (parsed.type === "metrics" && parsed.metrics) {
                                finalMetrics = parsed.metrics;
                                setLastMetrics(parsed.metrics);
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === assistantMessageId ? { ...m, metrics: parsed.metrics } : m
                                    )
                                );
                            }
                        } catch {
                            // skip invalid JSON
                        }
                    }
                }
            } else {
                // Handle non-streaming response (fallback)
                const data = await res.json();
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantMessageId
                            ? { ...m, content: data.content || "", reasoning: data.reasoning || undefined, metrics: data.metrics || undefined }
                            : m
                    )
                );
                setLastMetrics(data.metrics);
            }
        } catch (err) {
            console.error("Chat error:", err);
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantMessageId
                        ? {
                            ...m,
                            content: `❌ Hata: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`,
                        }
                        : m
                )
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleSavePrompt = async () => {
        if (!newPromptTitle.trim()) return;
        
        try {
            const res = await fetch("/api/admin/prompt-templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newPromptTitle.trim(),
                    category: "general",
                    prompt_text: system,
                }),
            });
            
            if (!res.ok) throw new Error("Prompt kaydedilemedi");
            
            const newPrompt = await res.json();
            setSavedPrompts((prev) => [newPrompt, ...prev]);
            setNewPromptTitle("");
            setShowSavePrompt(false);
        } catch (err) {
            console.error("Prompt kaydetme hatası:", err);
            alert("Prompt kaydedilemedi");
        }
    };

    const handleDeletePrompt = async (id: string) => {
        if (!confirm("Bu promptu silmek istediğinize emin misiniz?")) return;
        
        try {
            const res = await fetch(`/api/admin/prompt-templates/${id}`, {
                method: "DELETE",
            });
            
            if (!res.ok) throw new Error("Prompt silinemedi");
            
            setSavedPrompts((prev) => prev.filter((p) => p.id !== id));
        } catch (err) {
            console.error("Prompt silme hatası:", err);
            alert("Prompt silinemedi");
        }
    };

    const handleLoadPrompt = (prompt: SavedPrompt) => {
        setSystem(prompt.prompt_text);
    };

    const handleStartEdit = (prompt: SavedPrompt) => {
        setEditingPrompt(prompt);
        setEditTitle(prompt.name);
        setEditContent(prompt.prompt_text);
    };

    const handleSaveEdit = async () => {
        if (!editingPrompt || !editTitle.trim()) return;
        
        try {
            const res = await fetch(`/api/admin/prompt-templates/${editingPrompt.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editTitle.trim(),
                    prompt_text: editContent,
                }),
            });
            
            if (!res.ok) throw new Error("Prompt güncellenemedi");
            
            const updatedPrompt = await res.json();
            setSavedPrompts((prev) =>
                prev.map((p) => p.id === editingPrompt.id ? updatedPrompt : p)
            );
            setEditingPrompt(null);
            setEditTitle("");
            setEditContent("");
        } catch (err) {
            console.error("Prompt güncelleme hatası:", err);
            alert("Prompt güncellenemedi");
        }
    };

    const handleCancelEdit = () => {
        setEditingPrompt(null);
        setEditTitle("");
        setEditContent("");
    };

    const handleClearChat = () => {
        if (confirm("Tüm sohbet geçmişini temizlemek istediğinize emin misiniz?")) {
            setMessages([]);
            setLastMetrics(null);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-[850px] bg-[var(--color-bg-base)] rounded-2xl overflow-hidden shadow-sm border border-[var(--color-border)] animate-fade-in">
            {/* ── Settings Sidebar ── */}
            <div className="w-full lg:w-[360px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--color-border)] bg-[var(--color-surface-pure)] flex flex-col z-10 transition-all duration-300 overflow-y-auto sidebar-scroll">
                <div className="p-6 sm:p-8 border-b border-[var(--color-border)] flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-brand-dark)]">
                            <Settings size={18} />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-bold tracking-tight text-[var(--color-text-primary)] leading-none">Simülasyon Ayarı</h2>
                            <p className="text-[11px] font-medium text-[var(--color-text-secondary)] mt-1">Prompt ve Model Parametreleri</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 sm:p-8 flex-1 space-y-7">
                    {/* Model Selection */}
                    <div className="space-y-2.5">
                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1 flex items-center gap-2">
                            <Cpu size={14} className="text-[var(--color-brand-dark)]" /> Aktif Zeka
                        </label>
                        <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            disabled={loadingModels || models.length === 0}
                            className="w-full bg-[var(--color-surface-base)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-[var(--color-brand-dark)] focus:border-[var(--color-brand-dark)] transition-all appearance-none text-[13px] shadow-sm cursor-pointer disabled:opacity-50"
                        >
                            {loadingModels ? (
                                <option>Modeller yükleniyor...</option>
                            ) : models.length === 0 ? (
                                <option>Model bulunamadı</option>
                            ) : (
                                models.map((m) => (
                                    <option key={m.id} value={m.openrouter_id}>
                                        {m.display_name}
                                    </option>
                                ))
                            )}
                        </select>

                        {/* Model spec table */}
                        {selectedModelInfo && (
                            <div className="mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] overflow-hidden text-[11px]">
                                <table className="w-full">
                                    <tbody>
                                        <tr className="border-b border-[var(--color-border)]">
                                            <td className="px-3 py-1.5 text-[var(--color-text-muted)] font-semibold w-[45%]">Giriş fiyatı</td>
                                            <td className="px-3 py-1.5 text-[var(--color-text-primary)] font-mono">
                                                {selectedModelInfo.pricing_input != null
                                                    ? `$${selectedModelInfo.pricing_input}/M token`
                                                    : "—"}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-[var(--color-border)]">
                                            <td className="px-3 py-1.5 text-[var(--color-text-muted)] font-semibold">Çıkış fiyatı</td>
                                            <td className="px-3 py-1.5 text-[var(--color-text-primary)] font-mono">
                                                {selectedModelInfo.pricing_output != null
                                                    ? `$${selectedModelInfo.pricing_output}/M token`
                                                    : "—"}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-[var(--color-border)]">
                                            <td className="px-3 py-1.5 text-[var(--color-text-muted)] font-semibold">Max iterasyon</td>
                                            <td className="px-3 py-1.5 text-[var(--color-text-primary)] font-mono">
                                                {selectedModelInfo.max_iterations ?? "5"}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-[var(--color-border)]">
                                            <td className="px-3 py-1.5 text-[var(--color-text-muted)] font-semibold">Timeout</td>
                                            <td className="px-3 py-1.5 text-[var(--color-text-primary)] font-mono">
                                                {selectedModelInfo.llm_timeout_ms != null
                                                    ? `${selectedModelInfo.llm_timeout_ms / 1000}s`
                                                    : "—"}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-[var(--color-border)]">
                                            <td className="px-3 py-1.5 text-[var(--color-text-muted)] font-semibold">Context</td>
                                            <td className="px-3 py-1.5 text-[var(--color-text-primary)] font-mono">
                                                {selectedModelInfo.context_window != null
                                                    ? `${(selectedModelInfo.context_window / 1000).toFixed(0)}K`
                                                    : "—"}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-[var(--color-border)]">
                                            <td className="px-3 py-1.5 text-[var(--color-text-muted)] font-semibold">Max çıkış</td>
                                            <td className="px-3 py-1.5 text-[var(--color-text-primary)] font-mono">
                                                {selectedModelInfo.max_output_tokens != null
                                                    ? `${(selectedModelInfo.max_output_tokens / 1000).toFixed(0)}K`
                                                    : "—"}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-[var(--color-border)]">
                                            <td className="px-3 py-1.5 text-[var(--color-text-muted)] font-semibold">Tier</td>
                                            <td className="px-3 py-1.5 text-[var(--color-text-primary)]"
                                            >{selectedModelInfo.tier ?? "—"}</td>
                                        </tr>
                                        <tr>
                                            <td className="px-3 py-1.5 text-[var(--color-text-muted)] font-semibold">Yetenekler</td>
                                            <td className="px-3 py-1.5 flex flex-wrap gap-1">
                                                {selectedModelInfo.supports_tools && (
                                                    <span className="inline-flex items-center gap-1 bg-blue-900/30 border border-blue-800/40 text-blue-300 rounded px-1.5 py-0.5 text-[10px] font-semibold">
                                                        <Wrench size={9} /> Tools
                                                    </span>
                                                )}
                                                {selectedModelInfo.supports_reasoning && (
                                                    <span className="inline-flex items-center gap-1 bg-purple-900/30 border border-purple-800/40 text-purple-300 rounded px-1.5 py-0.5 text-[10px] font-semibold">
                                                        <Brain size={9} /> Reasoning
                                                    </span>
                                                )}
                                                {!selectedModelInfo.supports_tools && !selectedModelInfo.supports_reasoning && (
                                                    <span className="text-[var(--color-text-muted)]">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Tenant Selection */}
                    <div className="space-y-2.5">
                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1 flex items-center gap-2">
                            <Bot size={14} className="text-[var(--color-brand-dark)]" /> Test İşletmesi
                        </label>
                        <select
                            value={tenantId}
                            onChange={(e) => setTenantId(e.target.value)}
                            disabled={loadingTenants || tenants.length === 0}
                            className="w-full bg-[var(--color-surface-base)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-[var(--color-brand-dark)] focus:border-[var(--color-brand-dark)] transition-all appearance-none text-[13px] shadow-sm cursor-pointer disabled:opacity-50"
                        >
                            {loadingTenants ? (
                                <option>İşletmeler yükleniyor...</option>
                            ) : tenants.length === 0 ? (
                                <option>İşletme bulunamadı</option>
                            ) : (
                                tenants.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>

                    {/* Phone Input */}
                    <div className="space-y-2.5">
                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1 flex items-center gap-2">
                            <User size={14} className="text-[var(--color-brand-dark)]" /> Kimlik Simülasyonu
                        </label>
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-[var(--color-surface-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[13px] font-medium text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-dark)] focus:ring-1 focus:ring-[var(--color-brand-dark)] transition-all placeholder-[var(--color-text-muted)] shadow-sm"
                            placeholder="+905..."
                        />
                    </div>

                    {/* Saved Prompts */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                                <Code2 size={14} className="text-[var(--color-brand-dark)]" /> Kayıtlı Promptlar
                            </label>
                            <button
                                onClick={() => setShowSavePrompt(true)}
                                className="text-[10px] font-semibold text-[var(--color-brand-dark)] hover:text-[var(--color-brand-pressed)] transition-colors"
                            >
                                + Kaydet
                            </button>
                        </div>
                        
                        {showSavePrompt && (
                            <div className="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl p-3 space-y-2">
                                <input
                                    type="text"
                                    value={newPromptTitle}
                                    onChange={(e) => setNewPromptTitle(e.target.value)}
                                    placeholder="Prompt başlığı..."
                                    className="w-full bg-[var(--color-surface-base)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-[12px] outline-none focus:border-[var(--color-brand-dark)]"
                                    onKeyDown={(e) => e.key === "Enter" && handleSavePrompt()}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSavePrompt}
                                        disabled={!newPromptTitle.trim()}
                                        className="flex-1 bg-[var(--color-brand-dark)] hover:bg-[var(--color-brand-pressed)] disabled:opacity-50 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        <Save size={11} className="inline mr-1" />
                                        Kaydet
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowSavePrompt(false);
                                            setNewPromptTitle("");
                                        }}
                                        className="px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-active)] rounded-lg transition-colors"
                                    >
                                        İptal
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {savedPrompts.length > 0 && (
                            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                {savedPrompts.map((prompt) => (
                                    <div
                                        key={prompt.id}
                                        className="group flex items-center gap-2 bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-active)] border border-[var(--color-border)] rounded-lg px-3 py-2 cursor-pointer transition-colors"
                                        onClick={() => handleLoadPrompt(prompt)}
                                    >
                                        <Code2 size={12} className="text-[var(--color-text-muted)]" />
                                        <span className="flex-1 text-[12px] font-medium text-[var(--color-text-primary)] truncate">
                                            {prompt.name}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleStartEdit(prompt);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 text-[var(--color-brand-dark)] hover:text-[var(--color-brand-pressed)] transition-opacity"
                                            title="Düzenle"
                                        >
                                            <Pencil size={12} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeletePrompt(prompt.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                                            title="Sil"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* System Prompt */}
                    <div className="space-y-2.5 flex-1 flex flex-col min-h-[300px]">
                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1 flex items-center gap-2">
                            <Code2 size={14} className="text-[var(--color-brand-dark)]" /> Sistem Komutu
                        </label>
                        <textarea
                            value={system}
                            onChange={(e) => setSystem(e.target.value)}
                            className="w-full flex-1 bg-[var(--color-surface-base)] border border-[var(--color-border)] rounded-2xl p-4 text-[13px] font-medium leading-[1.6] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-dark)] focus:ring-1 focus:ring-[var(--color-brand-dark)] transition-all resize-none shadow-sm placeholder-[var(--color-text-muted)]"
                            placeholder="Sen yetkin bir asistansın..."
                        />
                    </div>

                    <div className="space-y-2.5">
                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">
                            Placeholder Değerleri
                        </label>
                        <div className="max-h-[180px] overflow-y-auto bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl p-3 text-[11px]">
                            {previewLoading ? (
                                <p className="text-[var(--color-text-muted)]">Çözümleniyor...</p>
                            ) : previewError ? (
                                <p className="text-red-400">{previewError}</p>
                            ) : Object.keys(placeholderValues).length === 0 ? (
                                <p className="text-[var(--color-text-muted)]">Placeholder bulunamadı.</p>
                            ) : (
                                Object.entries(placeholderValues).map(([key, value]) => (
                                    <div key={key} className="mb-2 last:mb-0">
                                        <p className="font-semibold text-[var(--color-text-secondary)]">{`{{${key}}}`}</p>
                                        <p className="text-[var(--color-text-primary)] break-words whitespace-pre-wrap">{value || "(boş)"}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">
                                Resolved Prompt
                            </label>
                            {unresolvedPlaceholders.length > 0 && (
                                <span className="text-[10px] text-amber-400 font-semibold">
                                    Çözülmeyen: {unresolvedPlaceholders.join(", ")}
                                </span>
                            )}
                        </div>
                        <textarea
                            value={resolvedPromptPreview}
                            readOnly
                            className="w-full h-40 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl p-3 text-[11px] leading-relaxed text-[var(--color-text-primary)] outline-none resize-y font-mono"
                        />
                    </div>

                </div>
            </div>

            {/* ── Chat Window ── */}
            <div className="flex-1 flex flex-col bg-[var(--color-surface-pure)] relative">
                <div className="h-[76px] flex-shrink-0 flex items-center justify-between px-6 sm:px-8 border-b border-[var(--color-border)] bg-[var(--color-surface-pure)] z-10">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-full bg-[var(--color-brand-light)] border border-[var(--color-brand-glow)] flex items-center justify-center text-[var(--color-brand-dark)]">
                            <Bot size={20} />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] tracking-tight leading-none">AI Test Lab</h3>
                            <p className="text-[11px] font-semibold text-[var(--color-status-success)] flex items-center gap-1.5 mt-1.5 uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 bg-[var(--color-status-success)] rounded-full animate-pulse shadow-sm" />
                                Hazır
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClearChat}
                        className="text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-red-400 transition-colors flex items-center gap-1.5"
                    >
                        <Trash2 size={14} />
                        Temizle
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-8 space-y-5 content-scroll bg-[var(--color-bg-base)]">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-5 animate-fade-in opacity-80">
                            <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)]">
                                <Bot size={28} />
                            </div>
                            <div className="max-w-[280px]">
                                <p className="text-[14px] font-semibold text-[var(--color-text-primary)] mb-1">Giriş Bekleniyor</p>
                                <p className="text-[13px] text-[var(--color-text-secondary)]">Test simülasyonunu başlatmak için bir mesaj gönderin.</p>
                            </div>
                        </div>
                    ) : (
                        messages.map((m) => {
                            const isAssistant = m.role === "assistant";
                            const reasoningOpen = expandedReasoning.has(m.id);
                            const metricsOpen = expandedMetrics.has(m.id);

                            // cost estimate
                            const msgModel = models.find((x) => x.openrouter_id === m.modelOpenRouterId);
                            const estimatedCost =
                                m.metrics && msgModel?.pricing_input != null && msgModel?.pricing_output != null
                                    ? (m.metrics.promptTokens * msgModel.pricing_input) / 1_000_000 +
                                      (m.metrics.completionTokens * msgModel.pricing_output) / 1_000_000
                                    : null;

                            return (
                                <div key={m.id} className="space-y-2">
                                    {/* ── Reasoning block (streams live) ── */}
                                    {isAssistant && m.reasoning && (
                                        <div className="flex justify-start animate-fade-in">
                                            <div className="max-w-[90%] w-full bg-purple-900/20 border border-purple-800/40 rounded-xl overflow-hidden">
                                                <button
                                                    onClick={() =>
                                                        setExpandedReasoning((prev) => {
                                                            const next = new Set(prev);
                                                            next.has(m.id) ? next.delete(m.id) : next.add(m.id);
                                                            return next;
                                                        })
                                                    }
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-purple-900/10 transition-colors"
                                                >
                                                    {reasoningOpen ? <ChevronDown size={13} className="text-purple-400 shrink-0" /> : <ChevronRight size={13} className="text-purple-400 shrink-0" />}
                                                    <Brain size={13} className="text-purple-400 shrink-0" />
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">Düşünce süreci</span>
                                                    <span className="ml-auto text-[10px] text-purple-500">{m.reasoning.length} karakter</span>
                                                </button>
                                                {reasoningOpen && (
                                                    <div className="px-4 pb-3 border-t border-purple-800/30">
                                                        <pre className="text-[11px] leading-relaxed text-purple-200 whitespace-pre-wrap font-mono pt-2 max-h-64 overflow-y-auto">
                                                            {m.reasoning}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Tool events (stream live: call then result) ── */}
                                    {isAssistant && m.toolEvents && m.toolEvents.length > 0 && (
                                        <div className="flex justify-start">
                                            <div className="max-w-[90%] w-full space-y-1.5">
                                                {m.toolEvents.map((ev, idx) => {
                                                    const isCompose = ev.name === "compose_interactive_message";
                                                    return (
                                                        <div key={idx} className="bg-blue-900/15 border border-blue-800/40 rounded-xl overflow-hidden text-[12px]">
                                                            {/* call header */}
                                                            <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-800/20">
                                                                <Wrench size={12} className="text-blue-400 shrink-0" />
                                                                <span className="font-bold text-blue-300 font-mono">{ev.name}</span>
                                                                {ev.durationMs != null && (
                                                                    <span className="ml-auto text-[10px] text-blue-500 font-mono">{ev.durationMs}ms</span>
                                                                )}
                                                                {ev.result == null && (
                                                                    <span className="ml-auto text-[10px] text-blue-500 animate-pulse">çalışıyor…</span>
                                                                )}
                                                            </div>
                                                            {/* arguments */}
                                                            <details className="group">
                                                                <summary className="px-3 py-1.5 text-[10px] text-blue-400 cursor-pointer list-none flex items-center gap-1 hover:text-blue-300">
                                                                    <ChevronRight size={10} className="group-open:rotate-90 transition-transform" /> Argümanlar
                                                                </summary>
                                                                <pre className="px-3 pb-2 text-[10px] text-blue-200 font-mono whitespace-pre-wrap">
                                                                    {JSON.stringify(ev.arguments, null, 2)}
                                                                </pre>
                                                            </details>
                                                            {/* result */}
                                                            {ev.result != null && (
                                                                <div className="border-t border-blue-800/20">
                                                                    {isCompose ? (
                                                                        <div className="px-3 py-2">
                                                                            <WAInteractivePreview result={ev.result as Record<string, unknown>} />
                                                                        </div>
                                                                    ) : (
                                                                        <details className="group">
                                                                            <summary className="px-3 py-1.5 text-[10px] text-emerald-400 cursor-pointer list-none flex items-center gap-1 hover:text-emerald-300">
                                                                                <ChevronRight size={10} className="group-open:rotate-90 transition-transform" /> Sonuç
                                                                            </summary>
                                                                            <pre className="px-3 pb-2 text-[10px] text-emerald-200 font-mono whitespace-pre-wrap">
                                                                                {typeof ev.result === "string"
                                                                                    ? ev.result
                                                                                    : JSON.stringify(ev.result, null, 2)}
                                                                            </pre>
                                                                        </details>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Main message bubble ── */}
                                    <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                                        <div
                                            className={`px-5 py-3.5 max-w-[85%] sm:max-w-[75%] rounded-2xl text-[14px] leading-relaxed break-words border ${
                                                m.role === "user"
                                                    ? "bg-[var(--color-customer-bg)] border-[var(--color-customer-border)] text-[var(--color-text-primary)] rounded-tr-sm shadow-sm"
                                                    : "bg-[var(--color-agent-bg)] border-[var(--color-agent-border)] text-[var(--color-text-primary)] rounded-tl-sm shadow-sm"
                                            }`}
                                        >
                                            {/* Check if content is a WhatsApp interactive message */}
                                            {isAssistant && m.content ? (
                                                <WAContentRenderer content={m.content} />
                                            ) : (
                                                m.content || (isAssistant && isLoading ? "​" : "(boş yanıt)")
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Metrics toggle ── */}
                                    {isAssistant && m.metrics && (
                                        <div className="flex justify-start pl-1">
                                            <div className="max-w-[85%] sm:max-w-[75%] w-full">
                                                <button
                                                    onClick={() =>
                                                        setExpandedMetrics((prev) => {
                                                            const next = new Set(prev);
                                                            next.has(m.id) ? next.delete(m.id) : next.add(m.id);
                                                            return next;
                                                        })
                                                    }
                                                    className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                                                >
                                                    {metricsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                                    detay gör
                                                </button>
                                                {metricsOpen && (
                                                    <div className="mt-1.5 p-3 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl">
                                                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                                                            <div>
                                                                <div className="text-[var(--color-text-muted)] font-semibold mb-0.5 flex items-center gap-1"><Clock size={10} /> Süre</div>
                                                                <div className="font-mono text-[var(--color-text-primary)]">{(m.metrics.totalMs / 1000).toFixed(2)}s</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[var(--color-text-muted)] font-semibold mb-0.5 flex items-center gap-1"><Zap size={10} /> Hız</div>
                                                                <div className="font-mono text-[var(--color-text-primary)]">{m.metrics.tokensPerSec} T/s</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[var(--color-text-muted)] font-semibold mb-0.5">Iterasyon</div>
                                                                <div className="font-mono text-[var(--color-text-primary)]">{m.metrics.iterations ?? 1}x</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[var(--color-text-muted)] font-semibold mb-0.5">Prompt tk.</div>
                                                                <div className="font-mono text-[var(--color-text-primary)]">{m.metrics.promptTokens}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[var(--color-text-muted)] font-semibold mb-0.5">Comp. tk.</div>
                                                                <div className="font-mono text-[var(--color-text-primary)]">{m.metrics.completionTokens}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[var(--color-text-muted)] font-semibold mb-0.5">Toplam tk.</div>
                                                                <div className="font-mono text-[var(--color-text-primary)]">{m.metrics.totalTokens}</div>
                                                            </div>
                                                            {estimatedCost != null && (
                                                                <div className="col-span-3 mt-0.5 pt-1.5 border-t border-[var(--color-border)]">
                                                                    <div className="text-[var(--color-text-muted)] font-semibold mb-0.5 flex items-center gap-1"><Activity size={10} /> Tahmini maliyet</div>
                                                                    <div className="font-mono text-amber-400">${estimatedCost.toFixed(6)}</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                    {isLoading && (
                        <div className="flex justify-start animate-fade-in px-1">
                            <div className="px-5 py-3.5 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-text-secondary)] text-[13px] font-medium rounded-tl-sm flex flex-col gap-2">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:-0.3s]" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:-0.15s]" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input form */}
                <div className="p-5 sm:p-6 border-t border-[var(--color-border)] bg-[var(--color-surface-pure)] z-10 w-full">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSendMessage();
                        }}
                        className="flex gap-3 max-w-4xl mx-auto items-end"
                    >
                        <div className="flex-1 relative group">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Test mesajınızı buraya yazın..."
                                className="w-full max-h-[140px] min-h-[48px] bg-[var(--color-surface-base)] border border-[var(--color-border)] focus:border-[var(--color-brand-dark)] text-[14px] text-[var(--color-text-primary)] rounded-2xl py-3 pl-4 pr-12 focus:ring-1 focus:ring-[var(--color-brand-dark)] outline-none resize-none transition-all shadow-sm"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                disabled={isLoading}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="flex-shrink-0 w-12 h-12 bg-[var(--color-brand-dark)] hover:bg-[var(--color-brand-pressed)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl flex items-center justify-center transition-all shadow-md hover:shadow-lg active:scale-95"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            </div>

            {/* ── Edit Prompt Modal ── */}
            {editingPrompt && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-[var(--color-surface-pure)] border border-[var(--color-border)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-scale-up">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[var(--color-brand-light)] border border-[var(--color-brand-glow)] flex items-center justify-center">
                                    <Pencil size={16} className="text-[var(--color-brand-dark)]" />
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-bold text-[var(--color-text-primary)]">Prompt Düzenle</h3>
                                    <p className="text-[11px] text-[var(--color-text-muted)]">İsim ve içeriği güncelleyin</p>
                                </div>
                            </div>
                            <button
                                onClick={handleCancelEdit}
                                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                                <span className="text-[20px]">×</span>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(80vh-140px)]">
                            {/* Title Input */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">
                                    Prompt Başlığı
                                </label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full bg-[var(--color-surface-base)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-dark)] focus:ring-1 focus:ring-[var(--color-brand-dark)] transition-all"
                                    placeholder="Örn: Müşteri Hizmetleri Prompt"
                                />
                            </div>

                            {/* Content Textarea */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">
                                    Prompt İçeriği
                                </label>
                                <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="w-full h-64 bg-[var(--color-surface-base)] border border-[var(--color-border)] rounded-xl p-4 text-[13px] leading-[1.6] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-dark)] focus:ring-1 focus:ring-[var(--color-brand-dark)] transition-all resize-none font-mono"
                                    placeholder="Sistem prompt'unu buraya yazın..."
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-3">
                            <button
                                onClick={handleCancelEdit}
                                className="px-4 py-2 text-[13px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={!editTitle.trim()}
                                className="px-5 py-2 bg-[var(--color-brand-dark)] hover:bg-[var(--color-brand-pressed)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold rounded-lg transition-all flex items-center gap-2"
                            >
                                <Save size={14} />
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
