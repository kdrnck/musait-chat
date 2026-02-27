"use client";

import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import { Settings2, X, Save, RefreshCw } from "lucide-react";
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
      const payload = (await response.json()) as
        | TenantAiSettings
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          isErrorPayload(payload) ? payload.error || "AI ayarları alınamadı." : "AI ayarları alınamadı."
        );
      }

      setSettings(payload as TenantAiSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beklenmeyen hata.");
    } finally {
      setLoading(false);
    }
  };

  const setProviderStrategy = (strategy: ProviderStrategyKey) => {
    if (!settings || strategy === "custom") return;

    setSettings({
      ...settings,
      providerPriority: PROVIDER_STRATEGIES[strategy].providers,
    });
  };

  const handlePresetChange = (profile: AiModelProfile) => {
    if (!settings) return;

    const preset = AI_MODEL_PRESETS[profile];
    setSettings({
      ...settings,
      modelProfile: profile,
      model: preset.model,
      providerPriority: [...preset.providerPriority],
      allowFallbacks: preset.allowFallbacks,
    });
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/tenant-ai-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelProfile: settings.modelProfile,
          model: settings.model,
          providerPriority: settings.providerPriority,
          allowFallbacks: settings.allowFallbacks,
          promptText: settings.promptText,
          outboundNumberMode: settings.outboundNumberMode,
          wabaPhoneNumberId: settings.wabaPhoneNumberId,
          wabaAccessToken: settings.wabaAccessToken,
          wabaBusinessAccountId: settings.wabaBusinessAccountId,
          wabaVerifyToken: settings.wabaVerifyToken,
          wabaAppSecret: settings.wabaAppSecret,
        }),
      });

      const payload = (await response.json()) as
        | TenantAiSettings
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          isErrorPayload(payload)
            ? payload.error || "AI ayarları kaydedilemedi."
            : "AI ayarları kaydedilemedi."
        );
      }

      setSettings(payload as TenantAiSettings);
      setSuccess("Ayarlar kaydedildi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beklenmeyen hata.");
    } finally {
      setSaving(false);
    }
  };

  if (!tenantId) {
    return (
      <button
        type="button"
        disabled
        className="p-1.5 flex-shrink-0"
        style={{ color: "var(--color-text-muted)", opacity: 0.5 }}
        title="Tenant bulunamadı"
      >
        <Settings2 size={15} />
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="p-1.5 flex-shrink-0 transition-colors"
        style={{ color: "var(--color-text-muted)" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.color = "var(--color-brand)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = "var(--color-text-muted)")
        }
        title="AI Kontrol Paneli"
      >
        <Settings2 size={15} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            style={{
              background: "var(--color-surface-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div>
                <h2
                  className="text-sm font-bold uppercase tracking-widest"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  AI Kontrol Paneli
                </h2>
                <p
                  className="text-[11px]"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Model, provider, prompt ve numara ayarları
                </p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="p-2"
                style={{ color: "var(--color-text-muted)" }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading && (
                <div
                  className="text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Ayarlar yükleniyor...
                </div>
              )}

              {!loading && settings && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Model Profili">
                      <select
                        value={settings.modelProfile}
                        onChange={(e) =>
                          handlePresetChange(e.target.value as AiModelProfile)
                        }
                        disabled={!canEdit}
                        className="w-full px-3 py-2 text-sm"
                        style={inputStyle}
                      >
                        {(Object.keys(AI_MODEL_PRESETS) as AiModelProfile[]).map(
                          (profile) => (
                            <option key={profile} value={profile}>
                              {AI_MODEL_PRESETS[profile].label}
                            </option>
                          )
                        )}
                      </select>
                    </Field>

                    <Field label="Model ID">
                      <input
                        type="text"
                        value={settings.model}
                        onChange={(e) =>
                          setSettings({ ...settings, model: e.target.value })
                        }
                        disabled={!canEdit}
                        className="w-full px-3 py-2 text-sm"
                        style={inputStyle}
                        placeholder="deepseek/deepseek-chat"
                      />
                    </Field>

                    <Field label="Provider Stratejisi">
                      <select
                        value={selectedProviderStrategy}
                        onChange={(e) =>
                          setProviderStrategy(e.target.value as ProviderStrategyKey)
                        }
                        disabled={!canEdit}
                        className="w-full px-3 py-2 text-sm"
                        style={inputStyle}
                      >
                        {(
                          Object.keys(PROVIDER_STRATEGIES) as Array<
                            Exclude<ProviderStrategyKey, "custom">
                          >
                        ).map((key) => (
                          <option key={key} value={key}>
                            {PROVIDER_STRATEGIES[key].label}
                          </option>
                        ))}
                        <option value="custom" disabled>
                          Custom ({settings.providerPriority.join(",") || "-"})
                        </option>
                      </select>
                    </Field>

                    <Field label="Fallback">
                      <label
                        className="flex items-center gap-2 px-3 py-2 text-sm"
                        style={inputStyle}
                      >
                        <input
                          type="checkbox"
                          checked={settings.allowFallbacks}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              allowFallbacks: e.target.checked,
                            })
                          }
                          disabled={!canEdit}
                        />
                        Provider fallback aktif
                      </label>
                    </Field>
                  </div>

                  <Field label="Mutlak Prompt (System Prompt)">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {settings.promptText.length} / 8000 karakter
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              promptText: DEFAULT_AI_SYSTEM_PROMPT,
                            })
                          }
                          className="text-[10px] px-2 py-0.5 transition-colors"
                          style={{
                            color: "var(--color-text-muted)",
                            border: "1px solid var(--color-border)",
                            background: "transparent",
                          }}
                          title="Varsayılan prompt'a sıfırla"
                        >
                          Varsayılana Sıfırla
                        </button>
                      )}
                    </div>
                    <textarea
                      value={settings.promptText}
                      onChange={(e) =>
                        setSettings({ ...settings, promptText: e.target.value })
                      }
                      disabled={!canEdit}
                      className="w-full min-h-[260px] px-3 py-2 text-xs resize-y"
                      style={inputStyle}
                      placeholder="Sistem prompt'unu buraya yazın..."
                    />
                  </Field>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Cevaplanan Numara">
                      <select
                        value={settings.outboundNumberMode}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            outboundNumberMode: e.target.value as OutboundNumberMode,
                          })
                        }
                        disabled={!canEdit}
                        className="w-full px-3 py-2 text-sm"
                        style={inputStyle}
                      >
                        <option value="inbound">Gelen numaradan cevapla</option>
                        <option value="musait">Musait numarasından cevapla</option>
                        <option value="tenant">İşletme WABA numarasından cevapla</option>
                      </select>
                    </Field>

                    <Field label="Tenant ID">
                      <input
                        type="text"
                        value={settings.tenantId}
                        disabled
                        className="w-full px-3 py-2 text-xs"
                        style={{ ...inputStyle, opacity: 0.75 }}
                      />
                    </Field>
                  </div>

                  {settings.outboundNumberMode === "tenant" && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="WABA Phone Number ID">
                          <input
                            type="text"
                            value={settings.wabaPhoneNumberId}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                wabaPhoneNumberId: e.target.value,
                              })
                            }
                            disabled={!canEdit}
                            className="w-full px-3 py-2 text-sm"
                            style={inputStyle}
                          />
                        </Field>

                        <Field label="WABA Access Token">
                          <input
                            type="password"
                            value={settings.wabaAccessToken}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                wabaAccessToken: e.target.value,
                              })
                            }
                            disabled={!canEdit}
                            className="w-full px-3 py-2 text-sm"
                            style={inputStyle}
                          />
                        </Field>

                        <Field label="WABA Business Account ID">
                          <input
                            type="text"
                            value={settings.wabaBusinessAccountId}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                wabaBusinessAccountId: e.target.value,
                              })
                            }
                            disabled={!canEdit}
                            className="w-full px-3 py-2 text-sm"
                            style={inputStyle}
                          />
                        </Field>

                        <Field label="WABA Verify Token">
                          <input
                            type="password"
                            value={settings.wabaVerifyToken}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                wabaVerifyToken: e.target.value,
                              })
                            }
                            disabled={!canEdit}
                            className="w-full px-3 py-2 text-sm"
                            style={inputStyle}
                          />
                        </Field>
                      </div>

                      <Field label="WABA App Secret">
                        <input
                          type="password"
                          value={settings.wabaAppSecret}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              wabaAppSecret: e.target.value,
                            })
                          }
                          disabled={!canEdit}
                          className="w-full px-3 py-2 text-sm"
                          style={inputStyle}
                        />
                      </Field>
                    </>
                  )}

                  {!canEdit && (
                    <div
                      className="text-xs px-3 py-2"
                      style={{
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface-2)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      Bu ayarlar sadece owner/admin kullanıcılar tarafından
                      düzenlenebilir.
                    </div>
                  )}
                </>
              )}

              {error && (
                <div
                  className="text-xs px-3 py-2"
                  style={{
                    border: "1px solid #f97316",
                    background: "rgba(249,115,22,0.1)",
                    color: "#fdba74",
                  }}
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  className="text-xs px-3 py-2"
                  style={{
                    border: "1px solid #22c55e",
                    background: "rgba(34,197,94,0.12)",
                    color: "#86efac",
                  }}
                >
                  {success}
                </div>
              )}
            </div>

            <div
              className="px-4 py-3 border-t flex items-center justify-between"
              style={{ borderColor: "var(--color-border)" }}
            >
              <button
                type="button"
                onClick={loadSettings}
                disabled={loading || saving}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs"
                style={secondaryButtonStyle}
              >
                <RefreshCw size={13} />
                Yenile
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={!canEdit || saving || loading || !settings}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold"
                style={{
                  ...primaryButtonStyle,
                  opacity: !canEdit || saving || loading ? 0.5 : 1,
                  cursor: !canEdit || saving || loading ? "not-allowed" : "pointer",
                }}
              >
                <Save size={13} />
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: CSSProperties = {
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text-primary)",
};

const primaryButtonStyle: CSSProperties = {
  background: "var(--color-brand)",
  border: "1px solid var(--color-border-brand)",
  color: "var(--color-surface-base)",
};

const secondaryButtonStyle: CSSProperties = {
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text-secondary)",
};

function isErrorPayload(
  payload: TenantAiSettings | { error?: string }
): payload is { error?: string } {
  return "error" in payload;
}
