/* eslint-disable */
"use client";

import { useMemo, useState } from "react";
import { Settings2, X, Save, RefreshCw, Sparkles, Shield, Cpu, Zap, Globe } from "lucide-react";
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

type ProviderStrategyKey =
  | "groq_first"
  | "deepinfra_first"
  | "groq_only"
  | "deepinfra_only"
  | "custom";

const PROVIDER_STRATEGIES: Record<
  Exclude<ProviderStrategyKey, "custom">,
  { label: string; providers: string[] }
> = {
  groq_first: {
    label: "Groq öncelikli",
    providers: ["groq", "deepinfra"],
  },
  deepinfra_first: {
    label: "DeepInfra öncelikli",
    providers: ["deepinfra", "groq"],
  },
  groq_only: {
    label: "Sadece Groq",
    providers: ["groq"],
  },
  deepinfra_only: {
    label: "Sadece DeepInfra",
    providers: ["deepinfra"],
  },
};

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
      const response = await fetch("/api/tenant-ai-settings", {
        method: "GET",
        cache: "no-store",
      });

      let payload: any;
      try {
        payload = await response.json();
      } catch {
        throw new Error("Sunucudan geçersiz yanıt alındı.");
      }

      if (!response.ok) {
        throw new Error(payload?.error || "AI ayarları alınamadı.");
      }

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
      try {
        payload = await response.json();
      } catch {
        throw new Error("Sunucudan geçersiz yanıt alındı.");
      }

      if (!response.ok) {
        throw new Error(payload?.error || "AI ayarları kaydedilemedi.");
      }

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
      <button
        type="button"
        onClick={openPanel}
        className="flex items-center gap-2 w-full px-4 py-3 rounded-2xl neu-convex text-[var(--color-text-secondary)] hover:text-[var(--color-brand-dim)] transition-all group"
      >
        <Settings2 size={16} className="group-hover:rotate-90 transition-transform duration-500" />
        <span className="text-[12px] font-bold uppercase tracking-wider">AI Yapılandırması</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-fade-in">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closePanel} />

          <div className="w-full max-w-4xl max-h-full overflow-hidden flex flex-col bg-[var(--color-surface-base)] rounded-[40px] shadow-2xl relative z-10 neu-panel">
            {/* Header */}
            <div className="px-8 py-6 flex items-center justify-between border-b-2 border-white neu-flat">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl neu-brand flex items-center justify-center font-bold">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">AI Kontrol Paneli</h2>
                  <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-1">Gelişmiş Zeka & Altyapı Ayarları</p>
                </div>
              </div>
              <button onClick={closePanel} className="p-3 rounded-2xl neu-convex text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10 sidebar-scroll">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-12 h-12 border-4 border-t-transparent border-[var(--color-brand)] rounded-full animate-spin" />
                  <span className="text-sm font-bold text-[#666] uppercase tracking-widest">Yükleniyor...</span>
                </div>
              ) : settings && (
                <>
                  {/* Model & Provider Section */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Cpu size={18} className="text-[var(--color-brand-dim)]" />
                      <h3 className="text-[14px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">Zeka Çekirdeği</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase ml-1">Model Profili</label>
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
                          className="w-full neu-pressed border-none rounded-2xl px-4 py-3.5 text-[var(--color-text-primary)] outline-none transition-all"
                        >
                          {(Object.keys(AI_MODEL_PRESETS) as AiModelProfile[]).map((p) => (
                            <option key={p} value={p} className="bg-[var(--color-surface-base)]">{AI_MODEL_PRESETS[p].label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase ml-1">Aktif Model ID</label>
                        <input
                          type="text"
                          value={settings.model}
                          onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                          disabled={!canEdit}
                          className="w-full neu-pressed border-none rounded-2xl px-4 py-3.5 text-[var(--color-text-primary)] outline-none transition-all font-mono text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase ml-1">Sağlayıcı Stratejisi</label>
                        <select
                          value={selectedProviderStrategy}
                          onChange={(e) => {
                            const strat = e.target.value as ProviderStrategyKey;
                            if (strat !== "custom") {
                              setSettings({ ...settings, providerPriority: PROVIDER_STRATEGIES[strat].providers });
                            }
                          }}
                          disabled={!canEdit}
                          className="w-full neu-pressed border-none rounded-2xl px-4 py-3.5 text-[var(--color-text-primary)] outline-none transition-all"
                        >
                          {(Object.keys(PROVIDER_STRATEGIES) as Array<Exclude<ProviderStrategyKey, "custom">>).map((k) => (
                            <option key={k} value={k} className="bg-[var(--color-surface-base)]">{PROVIDER_STRATEGIES[k].label}</option>
                          ))}
                          <option value="custom" className="bg-[var(--color-surface-base)]" disabled>Özel Yapılandırma</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-3 pt-6">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.allowFallbacks}
                            onChange={(e) => setSettings({ ...settings, allowFallbacks: e.target.checked })}
                            disabled={!canEdit}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 neu-pressed peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-brand-dim)]" />
                        </label>
                        <span className="text-sm font-bold text-[var(--color-text-primary)]">Yedek Sağlayıcı (Fallback) Aktif</span>
                      </div>

                      <div className="flex items-center gap-3 pt-6">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.bookingFlowEnabled}
                            onChange={(e) => setSettings({ ...settings, bookingFlowEnabled: e.target.checked })}
                            disabled={!canEdit}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 neu-pressed peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-brand-dim)]" />
                        </label>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-[var(--color-text-primary)]">Yapılandırılmış Randevu Akışı</span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">Kapalı: LLM sohbeti yönetir (önerilen)</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Prompt Section */}
                  <section className="space-y-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Zap size={18} className="text-[var(--color-brand-dim)]" />
                        <h3 className="text-[14px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">Karakter & Talimatlar</h3>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, promptText: DEFAULT_AI_SYSTEM_PROMPT })}
                        className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)] transition-all neu-convex"
                      >
                        Sıfırla
                      </button>
                    </div>
                    <textarea
                      value={settings.promptText}
                      onChange={(e) => setSettings({ ...settings, promptText: e.target.value })}
                      disabled={!canEdit}
                      className="w-full min-h-[300px] neu-pressed border-none rounded-3xl p-6 text-[var(--color-text-primary)] outline-none transition-all text-[15px] leading-relaxed font-medium"
                      placeholder="Asistanın karakterini ve görevlerini tanımlayın..."
                    />
                  </section>

                  {/* Communication Section */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Globe size={18} className="text-[var(--color-brand-dim)]" />
                      <h3 className="text-[14px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">İletişim Kanalları</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase ml-1">Cevaplama Modu</label>
                        <select
                          value={settings.outboundNumberMode}
                          onChange={(e) => setSettings({ ...settings, outboundNumberMode: e.target.value as OutboundNumberMode })}
                          disabled={!canEdit}
                          className="w-full neu-pressed border-none rounded-2xl px-4 py-3.5 text-[var(--color-text-primary)] outline-none transition-all"
                        >
                          <option value="inbound" className="bg-[var(--color-surface-base)]">Gelen numaradan cevapla</option>
                          <option value="musait" className="bg-[var(--color-surface-base)]">Müsait numarasından cevapla</option>
                          <option value="tenant" className="bg-[var(--color-surface-base)]">Özel WABA numarasından cevapla</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase ml-1">İşletme Kimliği (Tenant ID)</label>
                        <div className="w-full neu-pressed rounded-2xl px-4 py-3.5 text-[var(--color-text-secondary)] font-mono text-xs">
                          {settings.tenantId}
                        </div>
                      </div>
                    </div>

                    {settings.outboundNumberMode === "tenant" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-[32px] neu-pressed animate-fade-in">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase ml-1">Phone Number ID</label>
                          <input
                            type="text"
                            value={settings.wabaPhoneNumberId}
                            onChange={(e) => setSettings({ ...settings, wabaPhoneNumberId: e.target.value })}
                            className="w-full neu-pressed border-none rounded-2xl px-4 py-3 text-[var(--color-text-primary)] outline-none transition-all text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase ml-1">Business Account ID</label>
                          <input
                            type="text"
                            value={settings.wabaBusinessAccountId}
                            onChange={(e) => setSettings({ ...settings, wabaBusinessAccountId: e.target.value })}
                            className="w-full neu-pressed border-none rounded-2xl px-4 py-3 text-[var(--color-text-primary)] outline-none transition-all text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-8 py-6 border-t-2 border-white neu-flat flex items-center justify-between">
              <div className="flex flex-col">
                {error && <span className="text-red-400 text-[12px] font-bold animate-fade-in">{error}</span>}
                {success && <span className="text-[var(--color-brand-dim)] text-[12px] font-bold animate-fade-in">{success}</span>}
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={loadSettings}
                  disabled={loading || saving}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-[13px] font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-brand-dim)] neu-convex transition-all"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  Yenile
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canEdit || saving || loading || !settings}
                  className="flex items-center gap-2 px-8 py-3 rounded-2xl neu-brand text-[13px] font-bold transition-all disabled:opacity-50 hover:-translate-y-1 active:translate-y-0"
                >
                  {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{saving ? "Kaydediliyor..." : "Ayarları Uygula"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
