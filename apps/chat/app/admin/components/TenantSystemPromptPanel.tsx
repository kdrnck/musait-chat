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
    <div className="bg-[var(--color-surface-pure)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm animate-fade-in">
      <div className="flex items-center justify-between px-6 sm:px-8 py-5 sm:py-6 border-b border-[var(--color-border)] bg-[var(--color-surface-pure)]">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-brand-dark)]">
            <Sliders size={18} />
          </div>
          <div>
            <h2 className="text-[14px] font-bold tracking-tight text-[var(--color-text-primary)]">
              Tenant Sistem Prompt
            </h2>
            <p className="text-[12px] font-medium text-[var(--color-text-secondary)] mt-0.5">
              Seçmeli işletme sistemi
            </p>
          </div>
        </div>

        <button
          onClick={() => loadPrompt(tenantId)}
          disabled={loading || saving || !tenantId}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--color-surface-pure)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all disabled:opacity-50"
          title="Yenile"
        >
          <RefreshCw size={16} className={loading && !saving ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="p-6 sm:p-8 space-y-6 bg-[var(--color-bg-base)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[12px] font-semibold text-[var(--color-text-primary)] tracking-tight">
              İşletme Seçimi
            </label>
            <div className="relative">
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                disabled={loading || saving}
                className="w-full bg-[var(--color-surface-pure)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-[var(--color-brand-dark)] focus:border-[var(--color-brand-dark)] transition-all appearance-none text-[13px] shadow-sm"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[var(--color-text-secondary)]">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex items-end justify-end">
            <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] mb-2.5">
              {promptText.length} Karakter
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[12px] font-semibold text-[var(--color-text-primary)] tracking-tight">
            System Prompt
          </label>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            disabled={loading || saving}
            className="w-full min-h-[400px] px-5 py-5 text-[14px] font-medium leading-relaxed bg-[var(--color-surface-pure)] border border-[var(--color-border-hover)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-dark)] focus:ring-1 focus:ring-[var(--color-brand-dark)] transition-all rounded-xl shadow-sm placeholder-[var(--color-text-muted)] resize-y"
            placeholder="Seçili tenant için prompt'u buraya yaz..."
          />
        </div>

        {(error || success) && (
          <div className={`p-4 rounded-xl text-[13px] font-medium animate-fade-in text-center border shadow-sm ${error ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"
            }`}>
            {error || success}
          </div>
        )}
      </div>

      <div className="px-6 sm:px-8 py-5 border-t border-[var(--color-border)] bg-[var(--color-surface-pure)] flex items-center justify-end">
        <button
          onClick={handleSave}
          disabled={saving || loading || !tenantId || !promptText.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-[var(--color-brand-dark)] hover:bg-[var(--color-brand-pressed)] text-white text-[13px] font-semibold rounded-xl transition-all disabled:opacity-50 shadow-[0_2px_10px_rgba(20,83,45,0.2)]"
        >
          <Save size={16} />
          {saving ? "Kaydediliyor..." : "Tenant'a Uygula"}
        </button>
      </div>
    </div>
  );
}
