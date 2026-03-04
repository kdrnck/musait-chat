"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Settings2, X, Save, RefreshCw, Cpu, Zap, Layers, FileText, Check,
} from "lucide-react";
import PromptPickerModal from "./PromptPickerModal";

interface TenantAiSettings {
    tenantId: string;
    canEdit: boolean;
    model: string;
    promptText: string;
    globalPromptText: string;
    [key: string]: unknown;
}

interface TenantTierInfo {
    tier_id: string;
    tier_name: string;
    tier_display_name: string;
    is_explicit: boolean;
}

interface RegistryModel {
    id: string;
    openrouter_id: string;
    display_name: string;
    tier: string;
    supports_tools: boolean;
    supports_reasoning: boolean;
}

interface ModelTier {
    id: string;
    name: string;
    display_name: string;
}

interface PromptTemplate {
    id: string;
    name: string;
    description?: string;
    category: string;
    prompt_text: string;
}

interface AdminTenantSettingsModalProps {
    tenantId: string;
    tenantName: string;
    onClose: () => void;
}

export default function AdminTenantSettingsModal({ tenantId, tenantName, onClose }: AdminTenantSettingsModalProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [settings, setSettings] = useState<TenantAiSettings | null>(null);
    const [originalSettings, setOriginalSettings] = useState<TenantAiSettings | null>(null);
    const [registryModels, setRegistryModels] = useState<RegistryModel[]>([]);
    const [tenantTier, setTenantTier] = useState<TenantTierInfo | null>(null);
    const [allTiers, setAllTiers] = useState<ModelTier[]>([]);
    const [showPromptPicker, setShowPromptPicker] = useState(false);
    const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
    const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    // Detect unsaved changes
    const hasUnsavedChanges = useMemo(() => {
        if (!settings || !originalSettings) return false;
        return JSON.stringify(settings) !== JSON.stringify(originalSettings);
    }, [settings, originalSettings]);

    // Safe close function that checks for unsaved changes
    const handleClose = () => {
        if (hasUnsavedChanges) {
            setShowCloseConfirm(true);
            return;
        }
        onClose();
    };

    const forceClose = () => {
        setShowCloseConfirm(false);
        onClose();
    };

    const loadSettings = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetch(
                `/api/tenant-ai-settings?tenantId=${encodeURIComponent(tenantId)}`,
                { method: "GET", cache: "no-store" }
            );
            let payload: any;
            try { payload = await response.json(); } catch {
                throw new Error("Sunucudan geçersiz yanıt alındı.");
            }
            if (!response.ok) throw new Error(payload?.error || "AI ayarları alınamadı.");
            setSettings(payload);
            setOriginalSettings(payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetch("/api/tenant-ai-settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...settings, tenantId }),
            });
            let payload: any;
            try { payload = await response.json(); } catch {
                throw new Error("Sunucudan geçersiz yanıt alındı.");
            }
            if (!response.ok) throw new Error(payload?.error || "AI ayarları kaydedilemedi.");
            setSettings(payload);
            setOriginalSettings(payload); // Update original after successful save
            setSuccess("Ayarlar başarıyla kaydedildi.");
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata.");
        } finally {
            setSaving(false);
        }
    };

    const loadRegistryModels = useCallback(async () => {
        try {
            const [modelsRes, tierRes, allTiersRes] = await Promise.all([
                fetch(`/api/models?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
                fetch(`/api/admin/tenant-tier?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
                fetch("/api/admin/model-tiers", { cache: "no-store" }),
            ]);
            if (modelsRes.ok) setRegistryModels(await modelsRes.json());
            if (tierRes.ok) setTenantTier(await tierRes.json());
            if (allTiersRes.ok) {
                const data = await allTiersRes.json();
                if (Array.isArray(data)) setAllTiers(data);
            }
        } catch { /* ignore */ }
    }, [tenantId]);

    const loadPromptTemplates = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/prompt-templates?category=system", { cache: "no-store" });
            if (res.ok) setPromptTemplates(await res.json());
        } catch { /* ignore */ }
    }, []);

    // Match current prompt text to a known template
    useEffect(() => {
        if (!settings || promptTemplates.length === 0) return;
        const matched = promptTemplates.find(t => t.prompt_text.trim() === (settings.promptText as string)?.trim());
        setSelectedPromptId(matched?.id ?? null);
    }, [settings, promptTemplates]);

    useEffect(() => {
        void loadSettings();
        void loadRegistryModels();
        void loadPromptTemplates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenantId]);

    const selectedPromptName = promptTemplates.find(p => p.id === selectedPromptId)?.name;

    return (
        <>
        {/* Centered modal overlay — fixed to viewport, not parent */}
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={handleClose}>
            <div
                className="bg-[var(--color-surface-pure)] rounded-2xl border border-[var(--color-border)] shadow-2xl w-full max-w-[560px] max-h-[85vh] overflow-hidden flex flex-col animate-scale-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="px-6 py-5 border-b border-[var(--color-border)] flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[var(--color-brand)] flex items-center justify-center">
                            <Settings2 size={18} className="text-black" />
                        </div>
                        <div>
                            <h2 className="text-[16px] font-bold text-[var(--color-text-primary)]">İşletme Yapılandırması</h2>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                                <span className="font-semibold text-[var(--color-brand-dim)]">{tenantName}</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="btn-ghost p-1.5">
                        <X size={18} />
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="w-8 h-8 border-2 border-t-transparent border-[var(--color-brand)] rounded-full animate-spin" />
                            <span className="text-[13px] text-[var(--color-text-muted)]">Ayarlar yükleniyor...</span>
                        </div>
                    ) : error && !settings ? (
                        <div className="py-8 text-center">
                            <p className="text-[13px] text-red-500">{error}</p>
                            <button onClick={loadSettings} className="btn-secondary mt-3 mx-auto">
                                <RefreshCw size={14} />
                                Tekrar Dene
                            </button>
                        </div>
                    ) : settings && (
                        <>
                            {/* ── Model Seçimi ── */}
                            <section>
                                <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-[var(--color-border)]">
                                    <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center">
                                        <Cpu size={15} className="text-[var(--color-brand-dim)]" />
                                    </div>
                                    <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">Model Seçimi</h3>
                                </div>

                                {/* Tier badge + tier changer */}
                                {tenantTier && (
                                    <div className="mb-4 p-3 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <Layers size={14} className="text-[var(--color-text-muted)]" />
                                            <span className="text-[12px] text-[var(--color-text-muted)]">Tier:</span>
                                            <span className={`inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                                                tenantTier.tier_name === "premium" ? "bg-amber-900/30 text-amber-400 border border-amber-800" :
                                                tenantTier.tier_name === "enterprise" ? "bg-purple-900/30 text-purple-400 border border-purple-800" :
                                                "bg-[var(--color-surface-active)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                                            }`}>
                                                {tenantTier.tier_display_name}
                                            </span>
                                        </div>
                                        {allTiers.length > 0 && (
                                            <select
                                                value={tenantTier.tier_name}
                                                onChange={async (e) => {
                                                    const newTierName = e.target.value;
                                                    const selectedTier = allTiers.find((t) => t.name === newTierName);
                                                    if (!selectedTier) return;
                                                    try {
                                                        const res = await fetch("/api/admin/tenant-tier", {
                                                            method: "PUT",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({ tenant_id: tenantId, tier_id: selectedTier.id }),
                                                        });
                                                        if (res.ok) {
                                                            setTenantTier({ tier_id: selectedTier.id, tier_name: selectedTier.name, tier_display_name: selectedTier.display_name, is_explicit: true });
                                                            const modelsRes = await fetch(`/api/models?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
                                                            if (modelsRes.ok) setRegistryModels(await modelsRes.json());
                                                        }
                                                    } catch { /* ignore */ }
                                                }}
                                                className="form-select text-[11px] py-1 px-2 w-auto min-h-0"
                                            >
                                                {allTiers.map((t) => <option key={t.name} value={t.name}>{t.display_name}</option>)}
                                            </select>
                                        )}
                                    </div>
                                )}

                                {/* Model dropdown */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                        Aktif Model
                                    </label>
                                    {registryModels.length > 0 ? (
                                        <select
                                            value={registryModels.find((m) => m.openrouter_id === (settings.model as string))?.openrouter_id || ""}
                                            onChange={(e) => {
                                                const rm = registryModels.find((m) => m.openrouter_id === e.target.value);
                                                if (rm) setSettings({ ...settings, model: rm.openrouter_id });
                                            }}
                                            className="form-select"
                                        >
                                            {!registryModels.find((m) => m.openrouter_id === (settings.model as string)) && (
                                                <option value="" disabled>— mevcut model tier dışında —</option>
                                            )}
                                            {registryModels.map((m) => (
                                                <option key={m.id} value={m.openrouter_id}>
                                                    {m.display_name}{m.supports_reasoning ? " 🧠" : ""}{m.supports_tools ? " 🔧" : ""}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="form-input font-mono text-[12px] text-[var(--color-text-muted)] cursor-default">
                                            {(settings.model as string) || "—"}
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* ── Prompt Seçimi ── */}
                            <section>
                                <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-[var(--color-border)]">
                                    <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center">
                                        <Zap size={15} className="text-[var(--color-brand-dim)]" />
                                    </div>
                                    <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">Sistem Promptu</h3>
                                </div>

                                <div className="p-4 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileText size={14} className="text-[var(--color-text-muted)]" />
                                            <span className="text-[12px] text-[var(--color-text-muted)]">Aktif Prompt:</span>
                                        </div>
                                        <button
                                            onClick={() => setShowPromptPicker(true)}
                                            className="text-[12px] font-semibold text-[var(--color-brand-dark)] hover:text-[var(--color-brand)] transition-colors"
                                        >
                                            Değiştir
                                        </button>
                                    </div>

                                    {selectedPromptName ? (
                                        <div className="flex items-center gap-2">
                                            <Check size={14} className="text-[var(--color-brand)] flex-shrink-0" />
                                            <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{selectedPromptName}</span>
                                        </div>
                                    ) : (settings.promptText as string) ? (
                                        <p className="text-[12px] text-[var(--color-text-secondary)] italic">Özel prompt (kütüphane dışı)</p>
                                    ) : (
                                        <p className="text-[12px] text-[var(--color-text-muted)]">Global prompt kullanılıyor</p>
                                    )}

                                    {(settings.promptText as string) && (
                                        <pre className="text-[11px] font-mono text-[var(--color-text-muted)] whitespace-pre-wrap bg-[var(--color-surface-active)] rounded-lg p-3 max-h-[120px] overflow-y-auto border border-[var(--color-border)]">
                                            {(settings.promptText as string).slice(0, 300)}{(settings.promptText as string).length > 300 ? "..." : ""}
                                        </pre>
                                    )}
                                </div>
                            </section>
                        </>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-between flex-shrink-0 bg-[var(--color-surface-hover)]">
                    <div className="text-[12px] flex items-center gap-2 min-w-0 flex-1">
                        {hasUnsavedChanges && !error && !success && (
                            <span className="text-amber-400 font-medium">• Kaydedilmemiş değişiklikler</span>
                        )}
                        {error && <span className="text-red-500 font-medium truncate">{error}</span>}
                        {success && <span className="text-[var(--color-brand-dim)] font-semibold">{success}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={loadSettings} disabled={loading || saving} className="btn-secondary px-3 py-2">
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || loading || !settings}
                            className="btn-primary px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                            {saving ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* ── Unsaved Changes Confirm ── */}
        {showCloseConfirm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowCloseConfirm(false)}>
                <div
                    className="bg-[var(--color-surface-pure)] rounded-2xl border border-[var(--color-border)] shadow-2xl max-w-[380px] w-full animate-scale-up"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-6 text-center">
                        <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
                            <X size={24} className="text-amber-400" />
                        </div>
                        <h3 className="text-[16px] font-bold text-[var(--color-text-primary)] mb-2">Kaydedilmemiş Değişiklikler</h3>
                        <p className="text-[13px] text-[var(--color-text-muted)] mb-6">
                            Yaptığınız değişiklikler kaydedilmedi. Çıkmak istediğinize emin misiniz?
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowCloseConfirm(false)} className="btn-secondary flex-1 py-3">İptal</button>
                            <button onClick={forceClose} className="btn-primary flex-1 py-3 !bg-red-500 hover:!bg-red-600">Kaydetmeden Çık</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ── Prompt Picker ── */}
        {showPromptPicker && (
            <PromptPickerModal
                category="system"
                onSelect={(promptText) => {
                    if (settings) setSettings({ ...settings, promptText });
                }}
                onClose={() => setShowPromptPicker(false)}
            />
        )}
        </>
    );
}
