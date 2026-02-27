"use client";

import { useState, useEffect } from "react";
import { Save, RefreshCw, Network, Info } from "lucide-react";

/**
 * RouterAgentMasterPromptPanel
 * 
 * Manages the system prompt for the RouterAgent — the agent that handles
 * conversations not yet bound to any business (unbound / limbo state).
 * 
 * This prompt teaches the agent how to greet customers, ask which business
 * they want, and call the bind_tenant tool to link them up. The live tenant
 * list is automatically appended to this prompt at runtime.
 * 
 * When empty, the system falls back to the built-in UNBOUND_ROUTING_PROMPT.
 */
export default function RouterAgentMasterPromptPanel() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [promptText, setPromptText] = useState("");

    const loadPrompt = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch("/api/admin/router-agent-prompt", {
                method: "GET",
                cache: "no-store",
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "RouterAgent prompt alınamadı.");
            }

            setPromptText(data.promptText || "");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPrompt();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch("/api/admin/router-agent-prompt", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ promptText }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Prompt kaydedilemedi.");
            }

            setPromptText(data.promptText || "");
            setSuccess("RouterAgent Master Prompt başarıyla güncellendi.");
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata.");
        } finally {
            setSaving(false);
        }
    };

    const handleClear = async () => {
        if (!confirm("Prompt silinsin mi? Sistem varsayılan (hardcoded) prompt'a geri döner.")) return;
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch("/api/admin/router-agent-prompt", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ promptText: "" }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Temizleme başarısız.");

            setPromptText("");
            setSuccess("Prompt temizlendi. Sistem varsayılan prompt'a döndü.");
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-[var(--color-surface-pure)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 sm:px-8 py-5 sm:py-6 border-b border-[var(--color-border)] bg-[var(--color-surface-pure)]">
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-status-attention)]">
                        <Network size={18} />
                    </div>
                    <div>
                        <h2 className="text-[14px] font-bold tracking-tight text-[var(--color-text-primary)]">
                            RouterAgent Master Prompt
                        </h2>
                        <p className="text-[12px] font-medium text-[var(--color-text-secondary)] mt-0.5">
                            İşletme seçilmemiş (limbo) sohbetlerdeki agent davranışı
                        </p>
                    </div>
                </div>
                <button
                    onClick={loadPrompt}
                    disabled={loading || saving}
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--color-surface-pure)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all disabled:opacity-50"
                    title="Yenile"
                >
                    <RefreshCw size={16} className={loading && !saving ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6 bg-[var(--color-bg-base)]">
                {/* Info banner */}
                <div className="flex items-start gap-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-pure)]">
                    <Info size={15} className="flex-shrink-0 mt-0.5 text-[var(--color-status-attention)]" />
                    <p className="text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                        Bu prompt, henüz bir işletmeye bağlanmamış müşterilere cevap veren agent&#39;ın sistem talimatıdır.
                        Agent bu prompt ile müşteriyi selamlar, hangi işletmeyi istediğini öğrenir ve{" "}
                        <code className="text-[11px] font-mono bg-[var(--color-surface-hover)] px-1.5 py-0.5 rounded">bind_tenant</code>{" "}
                        aracını çağırarak sohbeti işletmeye bağlar.
                        <br />
                        <span className="font-semibold text-[var(--color-text-primary)]">
                            Aktif işletme listesi prompt&#39;a otomatik eklenir.
                        </span>{" "}
                        Boş bırakırsanız sistem varsayılan prompt&#39;ı kullanır.
                    </p>
                </div>

                {loading && !promptText ? (
                    <div className="flex items-center gap-3 py-10 justify-center">
                        <div className="w-6 h-6 border-[3px] border-t-transparent border-[var(--color-status-attention)] rounded-full animate-spin" />
                        <span className="text-[13px] font-medium text-[var(--color-text-secondary)] tracking-wide">
                            Prompt yükleniyor...
                        </span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[12px] font-semibold text-[var(--color-text-primary)] tracking-tight">
                                RouterAgent Sistem Talimatları
                            </label>
                            <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                {promptText.length} Karakter
                                {promptText.length === 0 && (
                                    <span className="ml-2 text-[var(--color-status-attention)]">(Varsayılan aktif)</span>
                                )}
                            </span>
                        </div>
                        <textarea
                            value={promptText}
                            onChange={(e) => setPromptText(e.target.value)}
                            disabled={loading || saving}
                            className="w-full min-h-[380px] px-5 py-5 text-[14px] font-medium leading-relaxed bg-[var(--color-surface-pure)] border border-[var(--color-border-hover)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-status-attention)] focus:ring-1 focus:ring-[var(--color-status-attention)] transition-all rounded-xl shadow-sm placeholder-[var(--color-text-muted)] resize-y font-mono"
                            placeholder={`Örnek:\nSen Musait RouterAgent'ısın. Müşterileri doğru işletmeye yönlendirirsin.\n\n## Görevin\n1. Müşteriyi samimice selamla\n2. Hangi işletmeyle ilgilendiğini sor\n3. Aşağıdaki işletme listesinden eşleştir\n4. bind_tenant aracını çağır\n5. Bağlandıktan sonra müşteriyi tebrikle ve nasıl yardımcı olabileceğini sor`}
                        />
                    </div>
                )}

                {(error || success) && (
                    <div
                        className={`p-4 rounded-xl text-[13px] font-medium animate-fade-in text-center border shadow-sm ${
                            error
                                ? "bg-red-50 border-red-200 text-red-700"
                                : "bg-green-50 border-green-200 text-green-700"
                        }`}
                    >
                        {error || success}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-6 sm:px-8 py-5 border-t border-[var(--color-border)] bg-[var(--color-surface-pure)] flex items-center justify-between gap-4">
                <button
                    onClick={handleClear}
                    disabled={saving || loading || promptText.length === 0}
                    className="text-[12px] font-medium text-[var(--color-text-muted)] hover:text-red-500 transition-colors disabled:opacity-40"
                >
                    Varsayılana Dön
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving || loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[var(--color-status-attention)] hover:opacity-90 text-white text-[13px] font-semibold rounded-xl transition-all disabled:opacity-50 shadow-sm"
                >
                    <Save size={16} />
                    {saving ? "Güncelleniyor..." : "RouterAgent&#39;a Uygula"}
                </button>
            </div>
        </div>
    );
}
