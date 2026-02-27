"use client";

import { useState, useEffect } from "react";
import { Save, RefreshCw, Settings } from "lucide-react";

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
                throw new Error(data.error || "Settings could not be saved.");
            }

            setPromptText(data.promptText);
            setSuccess("Global Master Prompt kaydedildi.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden mb-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-base)]">
                <div className="flex items-center gap-2">
                    <Settings size={18} className="text-[var(--color-brand)]" />
                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--color-text-primary)]">
                            Global Master Prompt
                        </h2>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                            Tüm işletmeler için varsayılan sistem promptu
                        </p>
                    </div>
                </div>
                <button
                    onClick={loadSettings}
                    disabled={loading || saving}
                    className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
                    title="Yenile"
                >
                    <RefreshCw size={14} className={loading && !saving ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="p-4 space-y-4">
                {loading && !promptText ? (
                    <div className="text-sm text-[var(--color-text-muted)]">Yükleniyor...</div>
                ) : (
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                                Master Prompt
                            </label>
                            <span className="text-[10px] text-[var(--color-text-muted)]">
                                {promptText.length} / 8000 karakter
                            </span>
                        </div>
                        <textarea
                            value={promptText}
                            onChange={(e) => setPromptText(e.target.value)}
                            disabled={loading || saving}
                            className="w-full min-h-[300px] px-3 py-2 text-xs resize-y bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] rounded-xl"
                            placeholder="Tüm sistem için varsayılan prompt'u buraya yazın..."
                        />
                    </div>
                )}

                {error && (
                    <div className="text-xs px-3 py-2 border border-orange-500/50 bg-orange-500/10 text-orange-400 rounded-lg">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="text-xs px-3 py-2 border border-green-500/50 bg-green-500/10 text-green-400 rounded-lg">
                        {success}
                    </div>
                )}
            </div>

            <div className="px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-end bg-[var(--color-surface-base)]">
                <button
                    onClick={handleSave}
                    disabled={saving || loading || !promptText}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-[var(--color-brand)] text-[var(--color-surface-base)] rounded-xl hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                    <Save size={14} />
                    {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
            </div>
        </div>
    );
}
