"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Settings2, X, Save, RefreshCw, Cpu, Zap, Globe,
} from "lucide-react";
import {
    DEFAULT_AI_SYSTEM_PROMPT,
    type AiModelProfile,
    type OutboundNumberMode,
} from "@/lib/ai/settings";

interface TenantAiSettings {
    tenantId: string;
    canEdit: boolean;
    modelProfile: AiModelProfile;
    model: string;
    providerPriority: string[];
    allowFallbacks: boolean;
    promptText: string;
    outboundNumberMode: OutboundNumberMode;
    bookingFlowEnabled: boolean;
    wabaPhoneNumberId: string;
    wabaAccessToken: string;
    wabaBusinessAccountId: string;
    wabaVerifyToken: string;
    wabaAppSecret: string;
}

interface TenantTierInfo {
    tier_id: string;
    tier_name: string;
    tier_display_name: string;
    is_explicit: boolean;
}


function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? "bg-[var(--color-brand-dim)]" : "bg-[var(--color-border)]"
                } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
        </button>
    );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
        <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-[var(--color-border)]">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center">
                {icon}
            </div>
            <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">{title}</h3>
        </div>
    );
}

interface AdminTenantSettingsModalProps {
    tenantId: string;
    tenantName: string;
    onClose: () => void;
}

interface RegistryModel {
    id: string;
    openrouter_id: string;
    display_name: string;
    tier: string;
    provider_config: Record<string, unknown> | null;
    supports_tools: boolean;
    supports_reasoning: boolean;
}

interface ModelTier {
    id: string;
    name: string;
    display_name: string;
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
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    // Detect unsaved changes
    const hasUnsavedChanges = useMemo(() => {
        if (!settings || !originalSettings) return false;
        return JSON.stringify(settings) !== JSON.stringify(originalSettings);
    }, [settings, originalSettings]);

    const canEdit = Boolean(settings?.canEdit);
    
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
            if (modelsRes.ok) {
                const data = await modelsRes.json();
                setRegistryModels(data);
            }
            if (tierRes.ok) {
                const data = await tierRes.json();
                setTenantTier(data);
            }
            if (allTiersRes.ok) {
                const data = await allTiersRes.json();
                if (Array.isArray(data)) setAllTiers(data);
            }
        } catch { /* ignore */ }
    }, [tenantId]);

    useEffect(() => {
        void loadSettings();
        void loadRegistryModels();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenantId]);

    return (
        <>
        <div className="modal-overlay animate-fade-in" onClick={handleClose}>
            <div
                className="modal-container animate-scale-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="px-6 py-5 border-b border-[var(--color-border)] flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[var(--color-text-primary)] flex items-center justify-center">
                            <Settings2 size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-[16px] font-bold text-[var(--color-text-primary)]">İşletme AI Yapılandırması</h2>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                                <span className="font-semibold text-[var(--color-brand-dim)]">{tenantName}</span>
                                {" "}— model & prompt ayarları
                            </p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="btn-ghost">
                        <X size={18} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="w-8 h-8 border-2 border-t-transparent border-[var(--color-brand)] rounded-full animate-spin" />
                            <span className="text-[13px] text-[var(--color-text-muted)]">Ayarlar yükleniyor...</span>
                        </div>
                    ) : error && !settings ? (
                        <div className="py-8 text-center">
                            <p className="text-[13px] text-red-600">{error}</p>
                            <button onClick={loadSettings} className="btn-secondary mt-3 mx-auto">
                                <RefreshCw size={14} />
                                Tekrar Dene
                            </button>
                        </div>
                    ) : settings && (
                        <>
                            {/* Section: Model */}
                            <section>
                                <SectionHeader
                                    icon={<Cpu size={15} className="text-[var(--color-brand-dim)]" />}
                                    title="Model Seçimi"
                                />

                                {/* Tier Badge & Change */}
                                {tenantTier && (
                                    <div className="mb-4 p-3.5 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-[12px] text-[var(--color-text-muted)]">Model Tier:</span>
                                            <span className={`inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                                                tenantTier.tier_name === "premium" ? "bg-amber-900/30 text-amber-400 border border-amber-800" :
                                                tenantTier.tier_name === "enterprise" ? "bg-purple-900/30 text-purple-400 border border-purple-800" :
                                                "bg-[var(--color-surface-active)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                                            }`}>
                                                {tenantTier.tier_display_name}
                                            </span>
                                            {!tenantTier.is_explicit && (
                                                <span className="text-[10px] text-[var(--color-text-muted)]">(varsayılan)</span>
                                            )}
                                        </div>
                                        {canEdit && allTiers.length > 0 && (
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
                                                            setTenantTier({
                                                                tier_id: selectedTier.id,
                                                                tier_name: selectedTier.name,
                                                                tier_display_name: selectedTier.display_name,
                                                                is_explicit: true,
                                                            });
                                                            // Reload models for new tier
                                                            const modelsRes = await fetch(`/api/models?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
                                                            if (modelsRes.ok) setRegistryModels(await modelsRes.json());
                                                        }
                                                    } catch { /* ignore */ }
                                                }}
                                                className="form-select text-[11px] py-1 px-2 w-auto"
                                            >
                                                {allTiers.map((t) => <option key={t.name} value={t.name}>{t.display_name}</option>)}
                                            </select>
                                        )}
                                    </div>
                                )}


                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                        Model
                                    </label>
                                    {registryModels.length > 0 ? (
                                        <select
                                            value={registryModels.find((m) => m.openrouter_id === settings.model)?.openrouter_id || ""}
                                            onChange={(e) => {
                                                const rm = registryModels.find((m) => m.openrouter_id === e.target.value);
                                                if (rm) setSettings({ ...settings, modelProfile: "fast" as AiModelProfile, model: rm.openrouter_id });
                                            }}
                                            disabled={!canEdit}
                                            className="form-select"
                                        >
                                            {!registryModels.find((m) => m.openrouter_id === settings.model) && (
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
                                            {settings.model || "—"}
                                        </div>
                                    )}
                                    <p className="text-[10px] text-[var(--color-text-muted)]">
                                        Provider ayarları seçilen modele göre otomatik uygulanır.
                                    </p>
                                </div>

                                {/* Booking flow toggle */}
                                <div className="mt-4">
                                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                                        <div>
                                            <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">Yapılandırılmış Randevu Akışı</p>
                                            <p className="text-[11px] text-[var(--color-text-muted)]">Kapalı: LLM serbest sohbet yönetir (önerilen)</p>
                                        </div>
                                        <Toggle
                                            checked={settings.bookingFlowEnabled}
                                            onChange={(v) => setSettings({ ...settings, bookingFlowEnabled: v })}
                                            disabled={!canEdit}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Section: System Prompt */}
                            <section>
                                <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--color-border)]">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center">
                                            <Zap size={15} className="text-[var(--color-brand-dim)]" />
                                        </div>
                                        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">Sistem Prompt</h3>
                                    </div>
                                    {canEdit && (
                                        <button
                                            onClick={() => setSettings({ ...settings, promptText: DEFAULT_AI_SYSTEM_PROMPT })}
                                            className="btn-secondary px-3 py-1.5 text-[11px]"
                                        >
                                            Varsayılana Sıfırla
                                        </button>
                                    )}
                                </div>
                                <textarea
                                    value={settings.promptText}
                                    onChange={(e) => setSettings({ ...settings, promptText: e.target.value })}
                                    disabled={!canEdit}
                                    className="form-textarea min-h-[220px] resize-y font-mono text-[13px] leading-relaxed"
                                    placeholder="Asistanın karakterini ve görevlerini tanımlayın..."
                                />
                            </section>

                            {/* Section: Communication */}
                            <section>
                                <SectionHeader
                                    icon={<Globe size={15} className="text-[var(--color-brand-dim)]" />}
                                    title="İletişim Kanalları"
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                            Cevaplama Modu
                                        </label>
                                        <select
                                            value={settings.outboundNumberMode}
                                            onChange={(e) => setSettings({ ...settings, outboundNumberMode: e.target.value as OutboundNumberMode })}
                                            disabled={!canEdit}
                                            className="form-select"
                                        >
                                            <option value="inbound">Gelen numaradan cevapla</option>
                                            <option value="musait">Müsait numarasından cevapla</option>
                                            <option value="tenant">Özel WABA numarasından cevapla</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                            Tenant ID
                                        </label>
                                        <div className="form-input font-mono text-[12px] text-[var(--color-text-muted)] cursor-default">
                                            {settings.tenantId}
                                        </div>
                                    </div>
                                </div>

                                {settings.outboundNumberMode === "tenant" && (
                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                                Phone Number ID
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.wabaPhoneNumberId}
                                                onChange={(e) => setSettings({ ...settings, wabaPhoneNumberId: e.target.value })}
                                                className="form-input"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                                Business Account ID
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.wabaBusinessAccountId}
                                                onChange={(e) => setSettings({ ...settings, wabaBusinessAccountId: e.target.value })}
                                                className="form-input"
                                            />
                                        </div>
                                    </div>
                                )}
                            </section>
                        </>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-between flex-shrink-0 bg-[var(--color-surface-hover)]">
                    <div className="text-[12px] flex items-center gap-2">
                        {hasUnsavedChanges && !error && !success && (
                            <span className="text-amber-400 font-medium">• Kaydedilmemiş değişiklikler var</span>
                        )}
                        {error && <span className="text-red-600 font-medium">{error}</span>}
                        {success && <span className="text-[var(--color-brand-dim)] font-semibold">{success}</span>}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadSettings}
                            disabled={loading || saving}
                            className="btn-secondary px-4 py-2"
                        >
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                            Yenile
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!canEdit || saving || loading || !settings}
                            className="btn-primary px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                            {saving ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Unsaved Changes Confirmation Dialog */}
        {showCloseConfirm && (
            <div className="modal-overlay animate-fade-in" style={{ zIndex: 110 }} onClick={() => setShowCloseConfirm(false)}>
                <div 
                    className="bg-[var(--color-surface-pure)] rounded-2xl border border-[var(--color-border)] shadow-2xl max-w-[380px] w-full mx-4 animate-scale-up"
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
                            <button 
                                onClick={() => setShowCloseConfirm(false)}
                                className="btn-secondary flex-1 py-3"
                            >
                                İptal
                            </button>
                            <button 
                                onClick={forceClose}
                                className="btn-primary flex-1 py-3 !bg-red-500 hover:!bg-red-600"
                            >
                                Kaydetmeden Çık
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
