"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Save, Sliders } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  logo_url: string | null;
}

export default function TenantSystemPromptPanel({
  tenants,
}: {
  tenants: Tenant[];
}) {
  const firstTenantId = useMemo(() => tenants[0]?.id ?? "", [tenants]);
  const [tenantId, setTenantId] = useState<string>(firstTenantId);
  const [promptText, setPromptText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId && firstTenantId) setTenantId(firstTenantId);
  }, [firstTenantId, tenantId]);

  const loadPrompt = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/tenant-system-prompt?tenantId=${encodeURIComponent(id)}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Prompt alınamadı.");
      setPromptText(data.promptText || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beklenmeyen hata.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) void loadPrompt(tenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const handleSave = async () => {
    if (!tenantId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/tenant-system-prompt", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, promptText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Kaydedilemedi.");

      setPromptText(data.promptText || promptText);
      setSuccess("Tenant prompt başarıyla kaydedildi.");
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beklenmeyen hata.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-black/[0.03] rounded-[32px] overflow-hidden shadow-sm animate-fade-in">
      <div className="flex items-center justify-between px-8 py-6 border-b border-black/[0.03] bg-gradient-to-br from-white to-[var(--color-surface-base)]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-black/[0.02] border border-black/[0.05] flex items-center justify-center text-[var(--color-text-primary)]">
            <Sliders size={20} />
          </div>
          <div>
            <h2 className="text-[14px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">
              Tenant Sistem Prompt
            </h2>
            <p className="text-[11px] font-medium text-[var(--color-text-muted)] mt-0.5">
              Seçili işletme için system prompt override
            </p>
          </div>
        </div>

        <button
          onClick={() => loadPrompt(tenantId)}
          disabled={loading || saving || !tenantId}
          className="p-2.5 rounded-xl hover:bg-black/5 text-[var(--color-text-muted)] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading && !saving ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
              İşletme
            </label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              disabled={loading || saving}
              className="w-full bg-[var(--color-surface-base)] border border-black/[0.03] text-[var(--color-text-primary)] rounded-[18px] px-4 py-3 outline-none focus:border-[var(--color-brand-glow-strong)] focus:bg-white transition-all"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end justify-end">
            <div className="text-[11px] font-bold text-[var(--color-brand-dim)] bg-[var(--color-brand-light)] px-2.5 py-1 rounded-lg">
              {promptText.length} Karakter
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[12px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
            System Prompt
          </label>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            disabled={loading || saving}
            className="w-full min-h-[400px] px-6 py-6 text-sm font-medium leading-relaxed bg-[var(--color-surface-base)] border border-black/[0.03] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-glow-strong)] focus:bg-white transition-all rounded-[24px] shadow-inner"
            placeholder="Seçili tenant için prompt'u buraya yaz..."
          />
        </div>

        {(error || success) && (
          <div
            className={`p-4 rounded-2xl text-[13px] font-bold animate-fade-in text-center ${
              error
                ? "bg-red-50 text-red-500 border border-red-100"
                : "bg-[var(--color-brand-light)] text-[var(--color-brand-dim)] border border-[var(--color-brand-glow-strong)]"
            }`}
          >
            {error || success}
          </div>
        )}
      </div>

      <div className="px-8 py-6 border-t border-black/[0.03] flex items-center justify-end bg-gradient-to-br from-white to-[var(--color-surface-base)]">
        <button
          onClick={handleSave}
          disabled={saving || loading || !tenantId || !promptText.trim()}
          className="flex items-center gap-2 px-8 py-3.5 bg-[var(--color-brand)] text-[#111111] text-[14px] font-black rounded-2xl shadow-xl shadow-[var(--color-brand-glow)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
        >
          <Save size={18} />
          {saving ? "Kaydediliyor..." : "Tenant'a Uygula"}
        </button>
      </div>
    </div>
  );
}
