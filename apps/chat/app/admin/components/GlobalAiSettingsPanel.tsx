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
        <div className="bg-white border border-black/[0.03] rounded-[32px] overflow-hidden shadow-sm animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-black/[0.03] bg-gradient-to-br from-white to-[var(--color-surface-base)]">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-black/[0.02] border border-black/[0.05] flex items-center justify-center text-[var(--color-text-primary)]">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h2 className="text-[14px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">
                            Global Master Prompt
                        </h2>
                        <p className="text-[11px] font-medium text-[var(--color-text-muted)] mt-0.5">
                            Tüm işletmeler için temel AI yönergeleri
                        </p>
                    </div>
                </div>
                <button
                    onClick={loadSettings}
                    disabled={loading || saving}
                    className="p-2.5 rounded-xl hover:bg-black/5 text-[var(--color-text-muted)] transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading && !saving ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="p-8 space-y-6">
                {loading && !promptText ? (
                    <div className="flex items-center gap-3 py-10">
                        <div className="w-5 h-5 border-2 border-t-transparent border-[var(--color-brand)] rounded-full animate-spin" />
                        <span className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Master ayarlar yükleniyor...</span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[12px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
                                Sistem Talimatları (System Instructions)
                            </label>
                            <span className="text-[11px] font-bold text-[var(--color-brand-dim)] bg-[var(--color-brand-light)] px-2.5 py-1 rounded-lg">
                                {promptText.length} Karakter
                            </span>
                        </div>
                        <textarea
                            value={promptText}
                            onChange={(e) => setPromptText(e.target.value)}
                            disabled={loading || saving}
                            className="w-full min-h-[400px] px-6 py-6 text-sm font-medium leading-relaxed bg-[var(--color-surface-base)] border border-black/[0.03] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-glow-strong)] focus:bg-white transition-all rounded-[24px] shadow-inner"
                            placeholder="Tüm sistem için varsayılan prompt'u buraya yazın..."
                        />
                    </div>
                )}

                {(error || success) && (
                    <div className={`p-4 rounded-2xl text-[13px] font-bold animate-fade-in text-center ${
                        error ? "bg-red-50 text-red-500 border border-red-100" : "bg-[var(--color-brand-light)] text-[var(--color-brand-dim)] border border-[var(--color-brand-glow-strong)]"
                    }`}>
                        {error || success}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-black/[0.03] flex items-center justify-end bg-gradient-to-br from-white to-[var(--color-surface-base)]">
                <button
                    onClick={handleSave}
                    disabled={saving || loading || !promptText}
                    className="flex items-center gap-2 px-8 py-3.5 bg-[var(--color-brand)] text-[#111111] text-[14px] font-black rounded-2xl shadow-xl shadow-[var(--color-brand-glow)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                >
                    <Save size={18} />
                    {saving ? "Güncelleniyor..." : "Sisteme Uygula"}
                </button>
            </div>
        </div>
    );
}
