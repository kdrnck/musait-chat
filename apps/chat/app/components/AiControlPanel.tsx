/* eslint-disable */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Settings2, X, Save, RefreshCw, Sparkles, Cpu, Zap, Globe,
} from "lucide-react";
import { type OutboundNumberMode } from "@/lib/ai/settings";

interface TenantAiSettings {
    tenantId: string;
    canEdit: boolean;
    model: string;
    promptText: string;
    outboundNumberMode: OutboundNumberMode;
    bookingFlowEnabled: boolean;
    maxIterations: number;
    llmTimeoutMs: number;
    globalPromptText: string;
    wabaPhoneNumberId: string;
    wabaAccessToken: string;
    wabaBusinessAccountId: string;
    wabaVerifyToken: string;
    wabaAppSecret: string;
}


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

interface RegistryModel {
    id: string;
    openrouter_id: string;
    display_name: string;
}

export default function AiControlPanel({ tenantId }: { tenantId: string | null }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [settings, setSettings] = useState<TenantAiSettings | null>(null);
    const [originalSettings, setOriginalSettings] = useState<TenantAiSettings | null>(null);
    const [registryModels, setRegistryModels] = useState<RegistryModel[]>([]);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    // Detect unsaved changes
    const hasUnsavedChanges = useMemo(() => {
        if (!settings || !originalSettings) return false;
        return JSON.stringify(settings) !== JSON.stringify(originalSettings);
    }, [settings, originalSettings]);;

    const canEdit = Boolean(settings?.canEdit);

    const loadRegistryModels = useCallback(async () => {
        try {
            const url = tenantId
                ? `/api/models?tenantId=${encodeURIComponent(tenantId)}`
                : "/api/models";
            const res = await fetch(url, { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                setRegistryModels(data);
            }
        } catch { /* ignore */ }
    }, [tenantId]);

    const openPanel = async () => {
        setOpen(true);
        await Promise.all([loadSettings(), loadRegistryModels()]);
    };

    const closePanel = () => {
        if (hasUnsavedChanges) {
            setShowCloseConfirm(true);
            return;
        }
        setOpen(false);
        setError(null);
        setSuccess(null);
    };

    const forceClosePanel = () => {
        setShowCloseConfirm(false);
        setOpen(false);
        setError(null);
        setSuccess(null);
        // Reset to original settings
        setSettings(originalSettings);
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
                body: JSON.stringify(settings),
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
                                <div className="w-9 h-9 rounded-xl bg-[var(--color-brand)] flex items-center justify-center">
                                    <Sparkles size={18} className="text-black" />
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
                                    <p className="text-[13px] text-red-400">{error}</p>
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
                                            title="Model"
                                        />
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                                Aktif Model
                                            </label>
                                            {registryModels.length > 0 ? (
                                                <select
                                                    value={settings.model}
                                                    onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                                                    disabled={!canEdit}
                                                    className="form-select"
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
                                                    {settings.model || "Model henüz atanmadı"}
                                                </div>
                                            )}
                                            <p className="text-[10px] text-[var(--color-text-muted)]">
                                                Kullanılabilir modeller plan tierınıza göre belirlenir.
                                            </p>
                                        </div>

                                        {/* Toggles */}
                                        <div className="mt-4 space-y-3">
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

                                        {/* Performance Tuning */}
                                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                                    Maks Tool İterasyon
                                                </label>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="range"
                                                        min={1}
                                                        max={10}
                                                        step={1}
                                                        value={settings.maxIterations ?? 5}
                                                        onChange={(e) => setSettings({ ...settings, maxIterations: parseInt(e.target.value, 10) })}
                                                        disabled={!canEdit}
                                                        className="flex-1 accent-[var(--color-brand)]"
                                                    />
                                                    <span className="text-[14px] font-bold text-[var(--color-text-primary)] w-8 text-center tabular-nums">
                                                        {settings.maxIterations ?? 5}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-[var(--color-text-muted)]">
                                                    Tool çağrısı sonrası LLM tekrar çağırma limiti (önerilen: 5)
                                                </p>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                                    LLM Zaman Aşımı
                                                </label>
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="range"
                                                        min={3000}
                                                        max={30000}
                                                        step={1000}
                                                        value={settings.llmTimeoutMs ?? 8000}
                                                        onChange={(e) => setSettings({ ...settings, llmTimeoutMs: parseInt(e.target.value, 10) })}
                                                        disabled={!canEdit}
                                                        className="flex-1 accent-[var(--color-brand)]"
                                                    />
                                                    <span className="text-[14px] font-bold text-[var(--color-text-primary)] w-12 text-right tabular-nums">
                                                        {((settings.llmTimeoutMs ?? 8000) / 1000).toFixed(0)}s
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-[var(--color-text-muted)]">
                                                    Her LLM isteği için maks bekleme süresi (önerilen: 8s)
                                                </p>
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
                                                    onClick={() =>
                                                        setSettings({
                                                            ...settings,
                                                            promptText: settings.globalPromptText || "",
                                                        })
                                                    }
                                                    className="btn-secondary px-3 py-1.5 text-[11px]"
                                                >
                                                    Global Prompt'u Yükle
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
                            <div className="text-[12px] flex items-center gap-2">
                                {hasUnsavedChanges && !error && !success && (
                                    <span className="text-amber-400 font-medium">• Kaydedilmemiş değişiklikler var</span>
                                )}
                                {error && <span className="text-red-400 font-medium">{error}</span>}
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
                                    onClick={forceClosePanel}
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
