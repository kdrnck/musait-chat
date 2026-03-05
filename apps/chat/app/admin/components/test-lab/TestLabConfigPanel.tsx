"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Cpu, Bot, User, Code2, Trash2, RefreshCw, Loader2, Variable, Eye, EyeOff } from "lucide-react";
import PromptPickerModal from "../PromptPickerModal";
import type { TestConfig } from "./useTestLabStream";

interface AiModel {
    id: string;
    openrouter_id: string;
    display_name: string;
    is_enabled: boolean;
}

interface Tenant {
    id: string;
    name: string;
}

interface TestLabConfigPanelProps {
    config: TestConfig;
    onConfigChange: React.Dispatch<React.SetStateAction<TestConfig>>;
    onClearChat: () => void;
}

export default function TestLabConfigPanel({
    config,
    onConfigChange,
    onClearChat,
}: TestLabConfigPanelProps) {
    const [models, setModels] = useState<AiModel[]>([]);
    const [loadingModels, setLoadingModels] = useState(true);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loadingTenants, setLoadingTenants] = useState(true);
    const [showPromptPicker, setShowPromptPicker] = useState(false);

    // Placeholder resolution state
    const [placeholders, setPlaceholders] = useState<Record<string, string>>({});
    const [resolvedPrompt, setResolvedPrompt] = useState("");
    const [unresolvedVars, setUnresolvedVars] = useState<string[]>([]);
    const [resolving, setResolving] = useState(false);
    const [showResolved, setShowResolved] = useState(false);
    const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load models
    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/admin/models", { cache: "no-store", headers: { 'Cache-Control': 'no-cache' } });
                if (!res.ok) throw new Error(`Models fetch failed: ${res.status}`);
                const data = await res.json();
                const enabled = Array.isArray(data) ? data.filter((m: AiModel) => m.is_enabled) : [];
                setModels(enabled);

                const saved = localStorage.getItem("modelTest_model");
                const exists = enabled.some((m: AiModel) => m.openrouter_id === saved);
                if (!saved || !exists) {
                    if (enabled.length > 0) {
                        onConfigChange((prev) => ({ ...prev, model: enabled[0].openrouter_id }));
                    }
                } else {
                    onConfigChange((prev) => ({ ...prev, model: saved }));
                }
            } catch (err) {
                console.error("TestLabConfigPanel models load error:", err);
            } finally {
                setLoadingModels(false);
            }
        };
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load tenants
    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/admin/tenants", { cache: "no-store", headers: { 'Cache-Control': 'no-cache' } });
                if (!res.ok) throw new Error("Tenants fetch res.ok: false");
                const data = await res.json();
                setTenants(Array.isArray(data) ? data : []);

                const saved = localStorage.getItem("modelTest_tenantId");
                const exists = Array.isArray(data) && data.some((t: Tenant) => t.id === saved);
                if (!saved || !exists) {
                    if (Array.isArray(data) && data.length > 0) {
                        onConfigChange((prev) => ({ ...prev, tenantId: data[0].id }));
                    }
                } else {
                    onConfigChange((prev) => ({ ...prev, tenantId: saved }));
                }
            } catch (err) {
                console.error("TestLabConfigPanel tenants load error:", err);
            } finally {
                setLoadingTenants(false);
            }
        };
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Persist to localStorage
    useEffect(() => {
        if (config.model) localStorage.setItem("modelTest_model", config.model);
    }, [config.model]);
    useEffect(() => {
        if (config.tenantId) localStorage.setItem("modelTest_tenantId", config.tenantId);
    }, [config.tenantId]);
    useEffect(() => {
        if (config.phone) localStorage.setItem("modelTest_phone", config.phone);
    }, [config.phone]);

    // ── Resolve placeholders (debounced) ──
    const resolveContext = useCallback(async () => {
        if (!config.tenantId || !config.system?.trim()) {
            setPlaceholders({});
            setResolvedPrompt("");
            setUnresolvedVars([]);
            return;
        }

        setResolving(true);
        try {
            const res = await fetch("/api/admin/model-test/resolve-context", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tenantId: config.tenantId,
                    phone: config.phone || "+905550000000",
                    system: config.system,
                }),
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setPlaceholders(data.placeholders || {});
            setResolvedPrompt(data.resolvedPrompt || "");
            setUnresolvedVars(data.unresolvedPlaceholders || []);
        } catch {
            // ignore
        } finally {
            setResolving(false);
        }
    }, [config.tenantId, config.phone, config.system]);

    // Debounce resolution when inputs change
    useEffect(() => {
        if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
        resolveTimerRef.current = setTimeout(() => {
            void resolveContext();
        }, 600);
        return () => {
            if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
        };
    }, [resolveContext]);

    // Count used variables in the prompt
    const usedVariables = config.system
        ? Array.from(config.system.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1])
        : [];
    const uniqueVars = Array.from(new Set(usedVariables));

    return (
        <div className="w-[340px] flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface-pure)] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
                <h2 className="text-[14px] font-bold text-[var(--color-text-primary)]">Test Lab Ayarları</h2>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Model, işletme ve kimlik</p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Model Selection */}
                <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                        <Cpu size={13} className="text-[var(--color-brand-dark)]" /> Model
                    </label>
                    <select
                        value={config.model}
                        onChange={(e) => onConfigChange((prev) => ({ ...prev, model: e.target.value }))}
                        disabled={loadingModels}
                        className="form-input text-[13px] w-full"
                    >
                        {loadingModels ? (
                            <option>Yükleniyor...</option>
                        ) : models.length === 0 ? (
                            <option>Model bulunamadı</option>
                        ) : (
                            models.map((m) => (
                                <option key={m.id} value={m.openrouter_id}>{m.display_name}</option>
                            ))
                        )}
                    </select>
                </div>

                {/* Tenant Selection */}
                <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                        <Bot size={13} className="text-[var(--color-brand-dark)]" /> Test İşletmesi
                    </label>
                    <select
                        value={config.tenantId}
                        onChange={(e) => onConfigChange((prev) => ({ ...prev, tenantId: e.target.value }))}
                        disabled={loadingTenants}
                        className="form-input text-[13px] w-full"
                    >
                        {loadingTenants ? (
                            <option>Yükleniyor...</option>
                        ) : tenants.length === 0 ? (
                            <option>İşletme bulunamadı</option>
                        ) : (
                            tenants.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))
                        )}
                    </select>
                </div>

                {/* Phone / Identity */}
                <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                        <User size={13} className="text-[var(--color-brand-dark)]" /> Kimlik Simülasyonu
                    </label>
                    <input
                        type="text"
                        value={config.phone}
                        onChange={(e) => onConfigChange((prev) => ({ ...prev, phone: e.target.value }))}
                        className="form-input text-[13px] w-full"
                        placeholder="+905..."
                    />
                </div>

                {/* System Prompt */}
                <div className="space-y-2 flex-1 flex flex-col">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                            <Code2 size={13} className="text-[var(--color-brand-dark)]" /> Sistem Promptu
                        </label>
                        <div className="flex items-center gap-2">
                            {resolving && <Loader2 size={12} className="text-[var(--color-text-muted)] animate-spin" />}
                            <button
                                onClick={() => void resolveContext()}
                                title="Değişkenleri yenile"
                                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                                <RefreshCw size={12} />
                            </button>
                            <button
                                onClick={() => setShowPromptPicker(true)}
                                className="text-[10px] font-semibold text-[var(--color-brand-dark)] hover:text-[var(--color-brand)] transition-colors"
                            >
                                Kütüphaneden Seç
                            </button>
                        </div>
                    </div>

                    {/* Variable tags — shows available placeholder values above textarea */}
                    {uniqueVars.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 py-1.5">
                            {uniqueVars.map((varName) => {
                                const value = placeholders[varName];
                                const isResolved = value !== undefined && value !== "";
                                const isUnresolved = unresolvedVars.includes(`{{${varName}}}`);
                                return (
                                    <span
                                        key={varName}
                                        title={isResolved ? `${varName} = ${value.length > 100 ? value.slice(0, 100) + "…" : value}` : `${varName} — çözülmedi`}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border cursor-default transition-colors ${isUnresolved
                                            ? "bg-red-500/10 border-red-500/20 text-red-400"
                                            : isResolved
                                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                : "bg-[var(--color-surface-hover)] border-[var(--color-border)] text-[var(--color-text-muted)]"
                                            }`}
                                    >
                                        <Variable size={10} />
                                        {varName}
                                    </span>
                                );
                            })}
                        </div>
                    )}

                    {/* Toggle raw / resolved view */}
                    {resolvedPrompt && (
                        <button
                            onClick={() => setShowResolved(!showResolved)}
                            className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors self-start"
                        >
                            {showResolved ? <EyeOff size={11} /> : <Eye size={11} />}
                            {showResolved ? "Ham Promptu Göster" : "Çözülmüş Promptu Göster"}
                        </button>
                    )}

                    {showResolved ? (
                        /* Resolved prompt — read-only preview */
                        <div className="flex-1 min-h-[280px] max-h-[500px] overflow-y-auto rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                            <pre className="text-[11px] font-mono text-emerald-200/80 leading-relaxed whitespace-pre-wrap break-words">
                                {resolvedPrompt}
                            </pre>
                        </div>
                    ) : (
                        /* Editable prompt */
                        <textarea
                            value={config.system}
                            onChange={(e) => onConfigChange((prev) => ({ ...prev, system: e.target.value }))}
                            className="form-input text-[12px] font-mono w-full flex-1 min-h-[280px] max-h-[500px] resize-y rounded-xl leading-relaxed"
                            placeholder="Sen profesyonel bir yapay zeka asistanısın..."
                        />
                    )}
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                    <button
                        onClick={onClearChat}
                        className="w-full flex items-center justify-center gap-2 py-2 text-[12px] font-semibold text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                        <Trash2 size={13} />
                        Sohbeti Temizle
                    </button>
                </div>
            </div>

            {/* Prompt Picker Modal */}
            {showPromptPicker && (
                <PromptPickerModal
                    onSelect={(promptText) => {
                        onConfigChange((prev) => ({ ...prev, system: promptText }));
                    }}
                    onClose={() => setShowPromptPicker(false)}
                />
            )}
        </div>
    );
}
