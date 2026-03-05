/* eslint-disable */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Settings2, X, Save, RefreshCw, Sparkles, Cpu, FileText, Check, Loader2,
} from "lucide-react";
import PromptPickerModal from "@/app/admin/components/PromptPickerModal";

interface TenantAiSettings {
    tenantId: string;
    canEdit: boolean;
    model: string;
    promptText: string;
    globalPromptText: string;
    [key: string]: unknown;
}

interface RegistryModel {
    id: string;
    openrouter_id: string;
    display_name: string;
}

interface PromptTemplate {
    id: string;
    name: string;
    description?: string;
    category: string;
    prompt_text: string;
}

export default function AiControlPanel({ tenantId }: { tenantId: string | null }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const [error, setError] = useState<string | null>(null);
    const [settings, setSettings] = useState<TenantAiSettings | null>(null);
    const [registryModels, setRegistryModels] = useState<RegistryModel[]>([]);
    const [showPromptPicker, setShowPromptPicker] = useState(false);
    const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
    const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

    const loadRegistryModels = useCallback(async () => {
        try {
            const url = tenantId
                ? `/api/models?tenantId=${encodeURIComponent(tenantId)}`
                : "/api/models";
            const res = await fetch(url, { cache: "no-store" });
            if (res.ok) setRegistryModels(await res.json());
        } catch { /* ignore */ }
    }, [tenantId]);

    const loadPromptTemplates = useCallback(async () => {
        try {
            const res = await fetch("/api/prompt-templates", { cache: "no-store" });
            if (res.ok) setPromptTemplates(await res.json());
        } catch { /* ignore */ }
    }, []);

    const loadSettings = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const url = tenantId
                ? `/api/tenant-ai-settings?tenantId=${encodeURIComponent(tenantId)}`
                : "/api/tenant-ai-settings";
            const res = await fetch(url, { method: "GET", cache: "no-store" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "AI ayarları alınamadı.");
            setSettings(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata.");
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    // Match current promptText to a library template
    useEffect(() => {
        if (!settings || promptTemplates.length === 0) return;
        const matched = promptTemplates.find(
            (t) => t.prompt_text.trim() === (settings.promptText as string)?.trim()
        );
        setSelectedPromptId(matched?.id ?? null);
    }, [settings, promptTemplates]);

    const openPanel = async () => {
        setOpen(true);
        await Promise.all([loadSettings(), loadRegistryModels(), loadPromptTemplates()]);
    };

    const closePanel = () => {
        setOpen(false);
        setError(null);
        setSaveStatus("idle");
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        setError(null);
        setSaveStatus("idle");
        try {
            const res = await fetch("/api/tenant-ai-settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "AI ayarları kaydedilemedi.");
            setSettings(data);
            setSaveStatus("success");
            setTimeout(() => setSaveStatus("idle"), 2500);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata.");
            setSaveStatus("error");
        } finally {
            setSaving(false);
        }
    };

    if (!tenantId) return null;

    const selectedPromptName = promptTemplates.find((p) => p.id === selectedPromptId)?.name;
    const canEdit = Boolean(settings?.canEdit);

    return (
        <>
            {/* Trigger button */}
            <button
                type="button"
                onClick={openPanel}
                className="btn-secondary w-full justify-start gap-2.5 py-2.5 px-3"
            >
                <Settings2 size={15} className="text-[var(--color-text-muted)] flex-shrink-0" />
                <span className="text-[12px] font-semibold text-[var(--color-text-secondary)]">AI Yapılandırması</span>
            </button>

            {/* Modal */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in"
                    onClick={closePanel}
                >
                    <div
                        className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[85vh] flex flex-col animate-scale-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-[var(--color-border)] flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[var(--color-brand)] flex items-center justify-center">
                                    <Sparkles size={18} className="text-black" />
                                </div>
                                <div>
                                    <h2 className="text-[16px] font-bold text-[var(--color-text-primary)]">AI Yapılandırması</h2>
                                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Model ve sistem prompt ayarları</p>
                                </div>
                            </div>
                            <button onClick={closePanel} className="btn-ghost">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3">
                                    <Loader2 size={28} className="animate-spin text-[var(--color-brand)]" />
                                    <span className="text-[13px] text-[var(--color-text-muted)]">Ayarlar yükleniyor...</span>
                                </div>
                            ) : error && !settings ? (
                                <div className="py-8 text-center">
                                    <p className="text-[13px] text-red-400">{error}</p>
                                    <button onClick={loadSettings} className="btn-secondary mt-3 mx-auto">
                                        <RefreshCw size={14} /> Tekrar Dene
                                    </button>
                                </div>
                            ) : settings ? (
                                <>
                                    {/* Model Seçimi */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Cpu size={16} className="text-[var(--color-brand)]" />
                                            <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">Model Seçimi</h3>
                                        </div>
                                        <div className="form-group !mb-0">
                                            <label className="form-label">AI Model</label>
                                            {registryModels.length > 0 ? (
                                                <select
                                                    value={settings.model as string}
                                                    onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                                                    disabled={!canEdit}
                                                    className="form-select disabled:opacity-60"
                                                >
                                                    <option value="">— Model seçin —</option>
                                                    {registryModels.map((m) => (
                                                        <option key={m.id} value={m.openrouter_id}>
                                                            {m.display_name}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="form-input text-[var(--color-text-muted)] text-[12px] font-mono">
                                                    {settings.model as string || "Model henüz atanmadı"}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sistem Promptu */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} className="text-purple-400" />
                                            <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">Sistem Promptu</h3>
                                        </div>

                                        {selectedPromptId && selectedPromptName ? (
                                            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <FileText size={15} className="text-purple-400 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-[13px] text-[var(--color-text-primary)] truncate">{selectedPromptName}</p>
                                                        <p className="text-[11px] text-[var(--color-text-muted)]">Prompt kütüphanesinden seçildi</p>
                                                    </div>
                                                </div>
                                                {canEdit && (
                                                    <button
                                                        onClick={() => setShowPromptPicker(true)}
                                                        className="shrink-0 ml-3 text-[12px] font-semibold text-[var(--color-brand-dark)] hover:text-[var(--color-brand)] transition-colors"
                                                    >
                                                        Değiştir
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-3 py-6 rounded-xl border-2 border-dashed border-[var(--color-border)]">
                                                <FileText size={22} className="text-[var(--color-text-muted)]" />
                                                <div className="text-center">
                                                    <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Prompt seçilmedi</p>
                                                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                                                        {canEdit ? "Kütüphaneden bir prompt seçin" : "Henüz bir prompt atanmamış"}
                                                    </p>
                                                </div>
                                                {canEdit && (
                                                    <button
                                                        onClick={() => setShowPromptPicker(true)}
                                                        className="btn-chunky !py-2 !px-4 text-[12px]"
                                                    >
                                                        <FileText size={13} />
                                                        Kütüphaneden Seç
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {error && (
                                        <p className="text-[12px] text-red-400 font-medium">{error}</p>
                                    )}
                                </>
                            ) : null}
                        </div>

                        {/* Footer */}
                        {settings && (
                            <div className="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-between flex-shrink-0 bg-[var(--color-surface-hover)]">
                                <button
                                    onClick={loadSettings}
                                    disabled={loading || saving}
                                    className="btn-secondary px-4 py-2 text-[12px]"
                                >
                                    <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                                    Yenile
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!canEdit || saving || loading}
                                    className="btn-primary px-5 py-2 text-[12px] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? (
                                        <><Loader2 size={13} className="animate-spin" /> Kaydediliyor...</>
                                    ) : saveStatus === "success" ? (
                                        <><Check size={13} /> Kaydedildi!</>
                                    ) : (
                                        <><Save size={13} /> Kaydet</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Prompt Picker Modal */}
            {showPromptPicker && (
                <PromptPickerModal
                    apiBase="/api/prompt-templates"
                    onSelect={(promptText) => {
                        if (settings) setSettings({ ...settings, promptText });
                        setShowPromptPicker(false);
                    }}
                    onClose={() => setShowPromptPicker(false)}
                />
            )}
        </>
    );
}
