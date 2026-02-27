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
        className="flex items-center gap-2 w-full px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/5 text-[#666666] hover:text-[var(--color-brand)] hover:border-[var(--color-brand-glow-strong)] transition-all group"
      >
        <Settings2 size={16} className="group-hover:rotate-90 transition-transform duration-500" />
        <span className="text-[12px] font-bold uppercase tracking-wider">AI Yapılandırması</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closePanel} />
          
          <div className="w-full max-w-4xl max-h-full overflow-hidden flex flex-col glass rounded-[40px] shadow-2xl border-white/10 relative z-10">
            {/* Header */}
            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-brand-glow)] flex items-center justify-center text-[var(--color-brand)] border border-[var(--color-brand-glow-strong)]">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">AI Kontrol Paneli</h2>
                  <p className="text-[11px] font-bold text-[#666666] uppercase tracking-widest mt-1">Gelişmiş Zeka & Altyapı Ayarları</p>
                </div>
              </div>
              <button onClick={closePanel} className="p-3 rounded-2xl hover:bg-white/5 text-[#666666] hover:text-white transition-colors">
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
                      <Cpu size={18} className="text-[var(--color-brand)]" />
                      <h3 className="text-[14px] font-black uppercase tracking-widest text-white">Zeka Çekirdeği</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[#666] uppercase ml-1">Model Profili</label>
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
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-[var(--color-brand-glow-strong)] transition-all"
                        >
                          {(Object.keys(AI_MODEL_PRESETS) as AiModelProfile[]).map((p) => (
                            <option key={p} value={p} className="bg-[#1a1a1a]">{AI_MODEL_PRESETS[p].label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[#666] uppercase ml-1">Aktif Model ID</label>
                        <input
                          type="text"
                          value={settings.model}
                          onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                          disabled={!canEdit}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-[var(--color-brand-glow-strong)] transition-all font-mono text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[#666] uppercase ml-1">Sağlayıcı Stratejisi</label>
                        <select
                          value={selectedProviderStrategy}
                          onChange={(e) => {
                            const strat = e.target.value as ProviderStrategyKey;
                            if (strat !== "custom") {
                              setSettings({ ...settings, providerPriority: PROVIDER_STRATEGIES[strat].providers });
                            }
                          }}
                          disabled={!canEdit}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-[var(--color-brand-glow-strong)] transition-all"
                        >
                          {(Object.keys(PROVIDER_STRATEGIES) as Array<Exclude<ProviderStrategyKey, "custom">>).map((k) => (
                            <option key={k} value={k} className="bg-[#1a1a1a]">{PROVIDER_STRATEGIES[k].label}</option>
                          ))}
                          <option value="custom" className="bg-[#1a1a1a]" disabled>Özel Yapılandırma</option>
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
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-brand)]" />
                        </label>
                        <span className="text-sm font-bold text-white">Yedek Sağlayıcı (Fallback) Aktif</span>
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
                          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-brand)]" />
                        </label>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">Yapılandırılmış Randevu Akışı</span>
                          <span className="text-[10px] text-[#666]">Kapalı: LLM sohbeti yönetir (önerilen)</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Prompt Section */}
                  <section className="space-y-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Zap size={18} className="text-[var(--color-brand)]" />
                        <h3 className="text-[14px] font-black uppercase tracking-widest text-white">Karakter & Talimatlar</h3>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, promptText: DEFAULT_AI_SYSTEM_PROMPT })}
                        className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-white/10 text-[#666] hover:text-white hover:border-white/20 transition-all"
                      >
                        Sıfırla
                      </button>
                    </div>
                    <textarea
                      value={settings.promptText}
                      onChange={(e) => setSettings({ ...settings, promptText: e.target.value })}
                      disabled={!canEdit}
                      className="w-full min-h-[300px] bg-white/5 border border-white/10 rounded-3xl p-6 text-white outline-none focus:border-[var(--color-brand-glow-strong)] transition-all text-sm leading-relaxed font-medium"
                      placeholder="Asistanın karakterini ve görevlerini tanımlayın..."
                    />
                  </section>

                  {/* Communication Section */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Globe size={18} className="text-[var(--color-brand)]" />
                      <h3 className="text-[14px] font-black uppercase tracking-widest text-white">İletişim Kanalları</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[#666] uppercase ml-1">Cevaplama Modu</label>
                        <select
                          value={settings.outboundNumberMode}
                          onChange={(e) => setSettings({ ...settings, outboundNumberMode: e.target.value as OutboundNumberMode })}
                          disabled={!canEdit}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-[var(--color-brand-glow-strong)] transition-all"
                        >
                          <option value="inbound" className="bg-[#1a1a1a]">Gelen numaradan cevapla</option>
                          <option value="musait" className="bg-[#1a1a1a]">Müsait numarasından cevapla</option>
                          <option value="tenant" className="bg-[#1a1a1a]">Özel WABA numarasından cevapla</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[#666] uppercase ml-1">İşletme Kimliği (Tenant ID)</label>
                        <div className="w-full bg-white/[0.02] border border-white/5 rounded-2xl px-4 py-3.5 text-[#444] font-mono text-xs">
                          {settings.tenantId}
                        </div>
                      </div>
                    </div>

                    {settings.outboundNumberMode === "tenant" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-[32px] bg-white/[0.02] border border-white/5 animate-fade-in">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-[#666] uppercase ml-1">Phone Number ID</label>
                          <input
                            type="text"
                            value={settings.wabaPhoneNumberId}
                            onChange={(e) => setSettings({ ...settings, wabaPhoneNumberId: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-[var(--color-brand-glow-strong)] transition-all text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-[#666] uppercase ml-1">Business Account ID</label>
                          <input
                            type="text"
                            value={settings.wabaBusinessAccountId}
                            onChange={(e) => setSettings({ ...settings, wabaBusinessAccountId: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-[var(--color-brand-glow-strong)] transition-all text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-8 py-6 border-t border-white/5 bg-white/[0.02] flex items-center justify-between">
              <div className="flex flex-col">
                {error && <span className="text-red-400 text-[12px] font-bold animate-fade-in">{error}</span>}
                {success && <span className="text-[var(--color-brand)] text-[12px] font-bold animate-fade-in">{success}</span>}
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={loadSettings}
                  disabled={loading || saving}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-[13px] font-bold text-[#666] hover:text-white transition-all"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  Yenile
                </button>
                <button
                  onClick={handleSave}
                  disabled={!canEdit || saving || loading || !settings}
                  className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-[var(--color-brand)] text-[#111111] text-[13px] font-bold shadow-xl shadow-[var(--color-brand-glow)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
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
