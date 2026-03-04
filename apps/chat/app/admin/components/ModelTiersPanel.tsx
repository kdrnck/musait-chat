"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Plus,
    Trash2,
    RefreshCw,
    Pencil,
    X,
    Star,
    Layers,
    Users,
    Cpu,
} from "lucide-react";

/* ─────────────────────────── Types ─────────────────────────── */

interface ModelTier {
    id: string;
    name: string;
    display_name: string;
    is_default: boolean;
    created_at: string;
    model_count?: number;
    enabled_model_count?: number;
    tenant_count?: number;
}

interface TierFormState {
    name: string;
    display_name: string;
    is_default: boolean;
}

const EMPTY_FORM: TierFormState = {
    name: "",
    display_name: "",
    is_default: false,
};

/* ─────────────────── Component ────────────────────────────── */

export default function ModelTiersPanel() {
    const [tiers, setTiers] = useState<ModelTier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingTier, setEditingTier] = useState<ModelTier | null>(null);
    const [form, setForm] = useState<TierFormState>(EMPTY_FORM);

    const loadTiers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/model-tiers", { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Tier'lar yüklenemedi");
            setTiers(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadTiers();
    }, [loadTiers]);

    const openNewModal = () => {
        setEditingTier(null);
        setForm(EMPTY_FORM);
        setShowModal(true);
    };

    const openEditModal = (tier: ModelTier) => {
        setEditingTier(tier);
        setForm({
            name: tier.name,
            display_name: tier.display_name,
            is_default: tier.is_default,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.display_name.trim()) return;
        setSaving(true);
        setError(null);
        try {
            const isEdit = !!editingTier;
            const payload: Record<string, unknown> = {
                name: form.name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
                display_name: form.display_name.trim(),
                is_default: form.is_default,
            };
            if (isEdit) payload.id = editingTier!.id;

            const res = await fetch("/api/admin/model-tiers", {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || (isEdit ? "Tier güncellenemedi" : "Tier eklenemedi"));
            }
            setShowModal(false);
            setEditingTier(null);
            await loadTiers();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (tier: ModelTier) => {
        if (tier.is_default) {
            setError("Varsayılan tier silinemez.");
            return;
        }
        if ((tier.tenant_count ?? 0) > 0) {
            if (!confirm(`Bu tier'a ${tier.tenant_count} işletme atanmış. Silmek istiyor musunuz? Atanmış işletmeler varsayılan tier'a düşecektir.`)) return;
        } else {
            if (!confirm(`"${tier.display_name}" tier'ını silmek istediğinize emin misiniz?`)) return;
        }
        try {
            const res = await fetch(`/api/admin/model-tiers?id=${tier.id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Tier silinemedi");
            }
            await loadTiers();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata");
        }
    };

    const updateForm = (patch: Partial<TierFormState>) => setForm((prev) => ({ ...prev, ...patch }));

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-6 h-6 border-2 border-t-transparent border-[var(--color-brand)] rounded-full animate-spin" />
                <span className="text-[12px] text-[var(--color-text-muted)]">Tier&apos;lar yükleniyor...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-800 text-[12px] text-red-400">{error}</div>
            )}

            {/* Info */}
            <div className="p-4 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                    Model Tier&apos;ları, işletmelere sunulan modelleri belirler. Her işletme bir tier&apos;a atanır. 
                    Varsayılan tier, atanmamış işletmelere uygulanır. Premium/Enterprise tier&apos;lar, 
                    daha düşük tier&apos;ların modellerine de erişim sağlar.
                </p>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-[12px] text-[var(--color-text-muted)]">{tiers.length} tier tanımlı</p>
                <div className="flex items-center gap-2">
                    <button onClick={loadTiers} className="btn-ghost p-1.5" title="Yenile">
                        <RefreshCw size={14} />
                    </button>
                    <button onClick={openNewModal} className="btn-secondary px-3 py-1.5 text-[11px]">
                        <Plus size={13} /> Yeni Tier
                    </button>
                </div>
            </div>

            {/* Tier cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tiers.map((tier) => (
                    <div
                        key={tier.id}
                        className={`p-5 rounded-xl border transition-colors cursor-pointer hover:border-[var(--color-brand)]/50 ${
                            tier.is_default
                                ? "bg-[var(--color-brand)]/5 border-[var(--color-brand)]/30"
                                : "bg-[var(--color-surface-elevated)] border-[var(--color-border)]"
                        }`}
                        onClick={() => openEditModal(tier)}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                    tier.name === "enterprise"
                                        ? "bg-purple-900/30 text-purple-400"
                                        : tier.name === "premium"
                                        ? "bg-amber-900/30 text-amber-400"
                                        : "bg-[var(--color-surface-active)] text-[var(--color-text-muted)]"
                                }`}>
                                    <Layers size={18} />
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                                        {tier.display_name}
                                        {tier.is_default && <Star size={12} className="text-[var(--color-brand)]" fill="currentColor" />}
                                    </h3>
                                    <p className="font-mono text-[11px] text-[var(--color-text-muted)]">{tier.name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={() => openEditModal(tier)}
                                    className="btn-ghost p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-brand)]"
                                    title="Düzenle"
                                >
                                    <Pencil size={13} />
                                </button>
                                {!tier.is_default && (
                                    <button
                                        onClick={() => handleDelete(tier)}
                                        className="btn-ghost p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                        title="Sil"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-[12px] text-[var(--color-text-muted)]">
                            <span className="flex items-center gap-1.5">
                                <Cpu size={13} className="text-[var(--color-brand-dim)]" />
                                <span className="font-semibold text-[var(--color-text-secondary)]">
                                    {tier.enabled_model_count ?? 0}
                                </span>
                                / {tier.model_count ?? 0} model
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Users size={13} className="text-[var(--color-brand-dim)]" />
                                <span className="font-semibold text-[var(--color-text-secondary)]">
                                    {tier.tenant_count ?? 0}
                                </span>
                                işletme
                            </span>
                        </div>
                    </div>
                ))}

                {tiers.length === 0 && (
                    <div className="col-span-full text-center py-10 text-[var(--color-text-muted)] text-[13px]">
                        Henüz tier tanımlanmamış.
                    </div>
                )}
            </div>

            {/* ───── Add / Edit Modal ───── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-md m-4">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                            <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                                {editingTier ? "Tier Düzenle" : "Yeni Tier Oluştur"}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                                    Tier Adı (slug) *
                                </label>
                                <input
                                    type="text"
                                    placeholder="premium, enterprise, vip"
                                    value={form.name}
                                    onChange={(e) =>
                                        updateForm({
                                            name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
                                        })
                                    }
                                    className="form-input text-[13px] font-mono w-full"
                                    disabled={!!editingTier} // name is immutable after creation
                                />
                                {editingTier && (
                                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                                        Tier adı oluşturulduktan sonra değiştirilemez.
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                                    Görünen Ad *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Premium Plan"
                                    value={form.display_name}
                                    onChange={(e) => updateForm({ display_name: e.target.value })}
                                    className="form-input text-[13px] w-full"
                                />
                            </div>
                            <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                                <input
                                    type="checkbox"
                                    checked={form.is_default}
                                    onChange={(e) => updateForm({ is_default: e.target.checked })}
                                    className="rounded border-[var(--color-border)]"
                                />
                                <div>
                                    <span className="flex items-center gap-1 text-[13px] font-semibold text-[var(--color-text-primary)]">
                                        <Star size={13} className="text-[var(--color-brand)]" />
                                        Varsayılan Tier
                                    </span>
                                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                                        Tier atanmamış işletmeler bu tier&apos;ın modellerini kullanır.
                                    </p>
                                </div>
                            </label>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)]">
                            <button onClick={() => setShowModal(false)} className="btn-ghost px-4 py-2 text-[12px]">
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !form.name.trim() || !form.display_name.trim()}
                                className="btn-primary px-5 py-2 text-[12px] disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <RefreshCw size={12} className="animate-spin" />{" "}
                                        {editingTier ? "Güncelleniyor..." : "Oluşturuluyor..."}
                                    </>
                                ) : (
                                    <>
                                        {editingTier ? <Pencil size={12} /> : <Plus size={12} />}{" "}
                                        {editingTier ? "Güncelle" : "Oluştur"}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
