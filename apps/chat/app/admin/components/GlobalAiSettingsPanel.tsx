"use client";

import { useState, useEffect } from "react";
import { Save, RefreshCw, Shield, Sparkles } from "lucide-react";

export default function GlobalAiSettingsPanel() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [promptText, setPromptText] = useState("");

    const loadSettings = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch("/api/admin/global-settings", {
                method: "GET",
                cache: "no-store",
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Global ayarlar alınamadı.");
            }

            setPromptText(data.promptText || "");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch("/api/admin/global-settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ promptText }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Ayarlar kaydedilemedi.");
            }

            setPromptText(data.promptText);
            setSuccess("Global Master Prompt başarıyla güncellendi.");
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
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-brand-dark)]">
                        <Shield size={18} />
                    </div>
                    <div>
                        <h2 className="text-[14px] font-bold tracking-tight text-[var(--color-text-primary)]">
                            Global Master Prompt
                        </h2>
                        <p className="text-[12px] font-medium text-[var(--color-text-secondary)] mt-0.5">
                            Tüm işletmeler için temel AI yönergeleri
                        </p>
                    </div>
                </div>
                <button
                    onClick={loadSettings}
                    disabled={loading || saving}
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--color-surface-pure)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all disabled:opacity-50"
                    title="Yenile"
                >
                    <RefreshCw size={16} className={loading && !saving ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6 bg-[var(--color-bg-base)]">
                {loading && !promptText ? (
                    <div className="flex items-center gap-3 py-10 justify-center">
                        <div className="w-6 h-6 border-[3px] border-t-transparent border-[var(--color-brand-dark)] rounded-full animate-spin" />
                        <span className="text-[13px] font-medium text-[var(--color-text-secondary)] tracking-wide">Ayarlar yükleniyor...</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[12px] font-semibold text-[var(--color-text-primary)] tracking-tight">
                                Sistem Talimatları
                            </label>
                            <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                {promptText.length} Karakter
                            </span>
                        </div>
                        <textarea
                            value={promptText}
                            onChange={(e) => setPromptText(e.target.value)}
                            disabled={loading || saving}
                            className="w-full min-h-[400px] px-5 py-5 text-[14px] font-medium leading-relaxed bg-[var(--color-surface-pure)] border border-[var(--color-border-hover)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-dark)] focus:ring-1 focus:ring-[var(--color-brand-dark)] transition-all rounded-xl shadow-sm placeholder-[var(--color-text-muted)] resize-y"
                            placeholder="Tüm sistem için varsayılan prompt'u buraya yazın..."
                        />
                    </div>
                )}

                {(error || success) && (
                    <div className={`p-4 rounded-xl text-[13px] font-medium animate-fade-in text-center border shadow-sm ${error ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"
                        }`}>
                        {error || success}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-6 sm:px-8 py-5 border-t border-[var(--color-border)] bg-[var(--color-surface-pure)] flex items-center justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving || loading || !promptText}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[var(--color-brand-dark)] hover:bg-[var(--color-brand-pressed)] text-white text-[13px] font-semibold rounded-xl transition-all disabled:opacity-50 shadow-[0_2px_10px_rgba(20,83,45,0.2)]"
                >
                    <Save size={16} />
                    {saving ? "Güncelleniyor..." : "Sisteme Uygula"}
                </button>
            </div>
        </div>
    );
}
