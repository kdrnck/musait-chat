"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, RefreshCw, Power, PowerOff } from "lucide-react";

interface AiModel {
    id: string;
    openrouter_id: string;
    display_name: string;
    is_enabled: boolean;
    provider_hint: string[] | null;
    pricing_input: number | null;
    pricing_output: number | null;
    created_at: string;
}

export default function ModelRegistryPanel() {
    const [models, setModels] = useState<AiModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [saving, setSaving] = useState(false);

    // Add form state
    const [newModel, setNewModel] = useState({
        openrouter_id: "",
        display_name: "",
        pricing_input: "",
        pricing_output: "",
        provider_hint: "",
    });

    const loadModels = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/models", { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Modeller yüklenemedi");
            setModels(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadModels();
    }, []);

    const handleAdd = async () => {
        if (!newModel.openrouter_id.trim() || !newModel.display_name.trim()) return;
        setSaving(true);
        setError(null);
        try {
            const providerHintArray = newModel.provider_hint
                .split(",")
                .map((p) => p.trim())
                .filter((p) => p.length > 0);

            const res = await fetch("/api/admin/models", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    openrouter_id: newModel.openrouter_id.trim(),
                    display_name: newModel.display_name.trim(),
                    pricing_input: newModel.pricing_input ? parseFloat(newModel.pricing_input) : null,
                    pricing_output: newModel.pricing_output ? parseFloat(newModel.pricing_output) : null,
                    provider_hint: providerHintArray.length > 0 ? providerHintArray : null,
                }),
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || "Model eklenemedi");
            }
            setNewModel({ openrouter_id: "", display_name: "", pricing_input: "", pricing_output: "", provider_hint: "" });
            setShowAddForm(false);
            await loadModels();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata");
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (model: AiModel) => {
        try {
            const res = await fetch("/api/admin/models", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: model.id, is_enabled: !model.is_enabled }),
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || "Durum güncellenemedi");
            }
            setModels((prev) =>
                prev.map((m) => (m.id === model.id ? { ...m, is_enabled: !m.is_enabled } : m))
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata");
        }
    };

    const handleDelete = async (model: AiModel) => {
        if (!confirm(`"${model.display_name}" modelini silmek istediğinize emin misiniz?`)) return;
        try {
            const res = await fetch(`/api/admin/models?id=${model.id}`, { method: "DELETE" });
            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload.error || "Model silinemedi");
            }
            setModels((prev) => prev.filter((m) => m.id !== model.id));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-6 h-6 border-2 border-t-transparent border-[var(--color-brand)] rounded-full animate-spin" />
                <span className="text-[12px] text-[var(--color-text-muted)]">Modeller yükleniyor...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-800 text-[12px] text-red-400">
                    {error}
                </div>
            )}

            {/* Header row */}
            <div className="flex items-center justify-between">
                <p className="text-[12px] text-[var(--color-text-muted)]">
                    {models.length} model kayıtlı — {models.filter((m) => m.is_enabled).length} aktif
                </p>
                <div className="flex items-center gap-2">
                    <button onClick={loadModels} className="btn-ghost p-1.5" title="Yenile">
                        <RefreshCw size={14} />
                    </button>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="btn-secondary px-3 py-1.5 text-[11px]"
                    >
                        <Plus size={13} />
                        Yeni Model
                    </button>
                </div>
            </div>

            {/* Add form */}
            {showAddForm && (
                <div className="p-4 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-3">
                    <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">Yeni Model Ekle</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                            type="text"
                            placeholder="OpenRouter ID (ör: google/gemini-2.5-pro)"
                            value={newModel.openrouter_id}
                            onChange={(e) => setNewModel({ ...newModel, openrouter_id: e.target.value })}
                            className="form-input text-[13px] font-mono"
                        />
                        <input
                            type="text"
                            placeholder="Görünen Ad"
                            value={newModel.display_name}
                            onChange={(e) => setNewModel({ ...newModel, display_name: e.target.value })}
                            className="form-input text-[13px]"
                        />
                        <input
                            type="text"
                            placeholder="Provider Hint (ör: deepinfra,groq,together)"
                            value={newModel.provider_hint}
                            onChange={(e) => setNewModel({ ...newModel, provider_hint: e.target.value })}
                            className="form-input text-[13px] font-mono"
                        />
                        <div className="sm:col-span-1" />
                        <input
                            type="number"
                            step="0.01"
                            placeholder="Fiyat Input ($/1M token)"
                            value={newModel.pricing_input}
                            onChange={(e) => setNewModel({ ...newModel, pricing_input: e.target.value })}
                            className="form-input text-[13px] font-mono"
                        />
                        <input
                            type="number"
                            step="0.01"
                            placeholder="Fiyat Output ($/1M token)"
                            value={newModel.pricing_output}
                            onChange={(e) => setNewModel({ ...newModel, pricing_output: e.target.value })}
                            className="form-input text-[13px] font-mono"
                        />
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="btn-ghost px-3 py-1.5 text-[11px]"
                        >
                            İptal
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={saving || !newModel.openrouter_id.trim() || !newModel.display_name.trim()}
                            className="btn-primary px-4 py-1.5 text-[11px] disabled:opacity-50"
                        >
                            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                            {saving ? "Ekleniyor..." : "Ekle"}
                        </button>
                    </div>
                </div>
            )}

            {/* Models table */}
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                <table className="w-full text-[13px]">
                    <thead>
                        <tr className="bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                            <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider">OpenRouter ID</th>
                            <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider">Görünen Ad</th>
                            <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider">Provider</th>
                            <th className="text-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider">Fiyat ($/1M)</th>
                            <th className="text-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider">Durum</th>
                            <th className="text-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider w-[60px]">Sil</th>
                        </tr>
                    </thead>
                    <tbody>
                        {models.map((model) => (
                            <tr
                                key={model.id}
                                className={`border-t border-[var(--color-border)] transition-colors ${
                                    model.is_enabled
                                        ? "hover:bg-[var(--color-surface-hover)]"
                                        : "opacity-50 bg-[var(--color-surface-elevated)]"
                                }`}
                            >
                                <td className="px-4 py-3 font-mono text-[12px] text-[var(--color-text-secondary)]">
                                    {model.openrouter_id}
                                </td>
                                <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                                    {model.display_name}
                                </td>
                                <td className="px-4 py-3 font-mono text-[11px] text-[var(--color-text-muted)]">
                                    {model.provider_hint && model.provider_hint.length > 0
                                        ? model.provider_hint.join(", ")
                                        : "—"}
                                </td>
                                <td className="px-4 py-3 text-center font-mono text-[11px] text-[var(--color-text-muted)]">
                                    {model.pricing_input != null && model.pricing_output != null
                                        ? `${model.pricing_input}↑ ${model.pricing_output}↓`
                                        : "—"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <button
                                        onClick={() => handleToggle(model)}
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                                            model.is_enabled
                                                ? "bg-emerald-900/30 text-emerald-400 border border-emerald-800 hover:bg-emerald-900/50"
                                                : "bg-[var(--color-surface-active)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                                        }`}
                                        title={model.is_enabled ? "Devre dışı bırak" : "Etkinleştir"}
                                    >
                                        {model.is_enabled ? <Power size={11} /> : <PowerOff size={11} />}
                                        {model.is_enabled ? "Aktif" : "Pasif"}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <button
                                        onClick={() => handleDelete(model)}
                                        className="btn-ghost p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                        title="Modeli sil"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {models.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-muted)] text-[13px]">
                                    Henüz model eklenmemiş.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
