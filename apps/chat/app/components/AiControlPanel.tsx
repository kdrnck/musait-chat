/* eslint-disable */
"use client";

import { useMemo, useState } from "react";
import {
    Settings2, X, Save, RefreshCw, Sparkles, Cpu, Zap, Globe,
    ChevronDown,
} from "lucide-react";
import {
    AI_MODEL_PRESETS,
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

type ProviderStrategyKey = "groq_first" | "deepinfra_first" | "groq_only" | "deepinfra_only" | "custom";

const PROVIDER_STRATEGIES: Record<
    Exclude<ProviderStrategyKey, "custom">,
    { label: string; providers: string[] }
> = {
    groq_first: { label: "Groq öncelikli (Groq → DeepInfra)", providers: ["groq", "deepinfra"] },
    deepinfra_first: { label: "DeepInfra öncelikli (DeepInfra → Groq)", providers: ["deepinfra", "groq"] },
    groq_only: { label: "Sadece Groq", providers: ["groq"] },
    deepinfra_only: { label: "Sadece DeepInfra", providers: ["deepinfra"] },
};

/* ── Toggle component ── */
function Toggle({
    checked,
    onChange,
    disabled,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                checked ? "bg-[var(--color-brand-dim)]" : "bg-[var(--color-border)]"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    checked ? "translate-x-6" : "translate-x-1"
                }`}
            />
        </button>
    );
}

/* ── Section header ── */
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

export default function AiControlPanel({ tenantId }: { tenantId: string | null }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [settings, setSettings] = useState<TenantAiSettings | null>(null);

    const selectedProviderStrategy = useMemo<ProviderStrategyKey>(() => {
        if (!settings) return "groq_first";
        const normalized = settings.providerPriority.join(",").toLowerCase();
        if (normalized === "groq,deepinfra") return "groq_first";
        if (normalized === "deepinfra,groq") return "deepinfra_first";
        if (normalized === "groq") return "groq_only";
        if (normalized === "deepinfra") return "deepinfra_only";
        return "custom";
    }, [settings]);

    const canEdit = Boolean(settings?.canEdit);

    const openPanel = async () => {
        setOpen(true);
        await loadSettings();
    };

    const closePanel = () => {
        setOpen(false);
        setError(null);
        setSuccess(null);
    };

    const loadSettings = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetch(
                tenantId
                    ? `/api/tenant-ai-settings?tenantId=${encodeURIComponent(tenantId)}`
                    : "/api/tenant-ai-settings",
                { method: "GET", cache: "no-store" }
            );
            let payload: any;
            try { payload = await response.json(); } catch {
                throw new Error("Sunucudan geçersiz yanıt alındı.");
            }
            if (!response.ok) throw new Error(payload?.error || "AI ayarları alınamadı.");
            setSettings(payload);
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
                body: JSON.stringify(settings),
            });
            let payload: any;
            try { payload = await response.json(); } catch {
                throw new Error("Sunucudan geçersiz yanıt alındı.");
            }
            if (!response.ok) throw new Error(payload?.error || "AI ayarları kaydedilemedi.");
            setSettings(payload);
            setSuccess("Ayarlar başarıyla kaydedildi.");
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata.");
        } finally {
            setSaving(false);
        }
    };

    if (!tenantId) return null;

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
                <div className="modal-overlay animate-fade-in" onClick={closePanel}>
                    <div
                        className="modal-container animate-scale-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-[var(--color-border)] flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[var(--color-text-primary)] flex items-center justify-center">
                                    <Sparkles size={18} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-[16px] font-bold text-[var(--color-text-primary)]">AI Yapılandırması</h2>
                                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Zeka çekirdeği & prompt ayarları</p>
                                </div>
                            </div>
                            <button onClick={closePanel} className="btn-ghost">
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
                                    {/* Section: Model & Provider */}
                                    <section>
                                        <SectionHeader
                                            icon={<Cpu size={15} className="text-[var(--color-brand-dim)]" />}
                                            title="Model & Sağlayıcı"
                                        />
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                                    Model Profili
                                                </label>
                                                <select
                                                    value={settings.modelProfile}
                                                    onChange={(e) => {
                                                        const preset = AI_MODEL_PRESETS[e.target.value as AiModelProfile];
                                                        setSettings({
                                                            ...settings,
                                                            modelProfile: e.target.value as AiModelProfile,
                                                            model: preset.model,
                                                            providerPriority: [...preset.providerPriority],
                                                            allowFallbacks: preset.allowFallbacks,
                                                        });
                                                    }}
                                                    disabled={!canEdit}
                                                    className="form-select"
                                                >
                                                    {(Object.keys(AI_MODEL_PRESETS) as AiModelProfile[]).map((p) => (
                                                        <option key={p} value={p}>{AI_MODEL_PRESETS[p].label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                                    Model ID
                                                </label>
                                                <input
                                                    type="text"
                                                    value={settings.model}
                                                    onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                                                    disabled={!canEdit}
                                                    className="form-input font-mono"
                                                    placeholder="model/id..."
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                                    Sağlayıcı Stratejisi
                                                </label>
                                                <select
                                                    value={selectedProviderStrategy}
                                                    onChange={(e) => {
                                                        const strat = e.target.value as ProviderStrategyKey;
                                                        if (strat !== "custom") {
                                                            setSettings({ ...settings, providerPriority: PROVIDER_STRATEGIES[strat].providers });
                                                        }
                                                    }}
                                                    disabled={!canEdit}
                                                    className="form-select"
                                                >
                                                    {(Object.keys(PROVIDER_STRATEGIES) as Array<Exclude<ProviderStrategyKey, "custom">>).map((k) => (
                                                        <option key={k} value={k}>{PROVIDER_STRATEGIES[k].label}</option>
                                                    ))}
                                                    <option value="custom" disabled>Özel Yapılandırma</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Toggles */}
                                        <div className="mt-4 space-y-3">
                                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                                                <div>
                                                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">Yedek Sağlayıcı (Fallback)</p>
                                                    <p className="text-[11px] text-[var(--color-text-muted)]">Birincil başarısız olunca yedek devreye girer</p>
                                                </div>
                                                <Toggle
                                                    checked={settings.allowFallbacks}
                                                    onChange={(v) => setSettings({ ...settings, allowFallbacks: v })}
                                                    disabled={!canEdit}
                                                />
                                            </div>

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
                                            className="form-textarea min-h-[200px] resize-y font-mono text-[13px] leading-relaxed"
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
                            <div className="text-[12px]">
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
            )}
        </>
    );
}
