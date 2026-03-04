"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, X, FileText, Check, Bot, Building2 } from "lucide-react";

interface PromptTemplate {
    id: string;
    name: string;
    description?: string;
    category: string;
    prompt_text: string;
    tenant_id?: string;
    is_default?: boolean;
}

const CATEGORIES = [
    { value: "system", label: "Sistem Promptu", icon: Bot },
    { value: "routing", label: "Yönlendirme", icon: Building2 },
    { value: "greeting", label: "Karşılama", icon: FileText },
    { value: "general", label: "Genel", icon: FileText },
];

interface PromptPickerModalProps {
    onSelect: (promptText: string) => void;
    onClose: () => void;
    category?: string;
}

export default function PromptPickerModal({ onSelect, onClose, category }: PromptPickerModalProps) {
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterCategory, setFilterCategory] = useState(category || "");
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const url = category
                    ? `/api/admin/prompt-templates?category=${category}`
                    : "/api/admin/prompt-templates";
                const res = await fetch(url, { cache: "no-store" });
                if (res.ok) {
                    setPrompts(await res.json());
                }
            } catch (err) {
                console.error("Prompt yükleme hatası:", err);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [category]);

    const filtered = useMemo(() => {
        return prompts.filter((p) => {
            const matchesSearch = !searchQuery ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.prompt_text.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = !filterCategory || p.category === filterCategory;
            return matchesSearch && matchesCategory;
        });
    }, [prompts, searchQuery, filterCategory]);

    const selectedPrompt = prompts.find(p => p.id === selectedId);

    const handleConfirm = () => {
        if (selectedPrompt) {
            onSelect(selectedPrompt.prompt_text);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[var(--color-brand-light)] flex items-center justify-center">
                            <FileText size={16} className="text-[var(--color-brand-dark)]" />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-bold text-[var(--color-text-primary)]">Kütüphaneden Prompt Seç</h3>
                            <p className="text-[11px] text-[var(--color-text-muted)]">Kayıtlı promptlardan birini seçin</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-ghost p-1.5">
                        <X size={16} />
                    </button>
                </div>

                {/* Filters */}
                <div className="px-6 py-3 border-b border-[var(--color-border)] flex gap-3">
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                        <input
                            type="text"
                            placeholder="Prompt ara..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="form-input pl-9 py-2 text-[13px] w-full"
                        />
                    </div>
                    {!category && (
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="form-input py-2 text-[13px] w-[160px]"
                        >
                            <option value="">Tüm Kategoriler</option>
                            {CATEGORIES.map((cat) => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex">
                    {/* List */}
                    <div className="w-1/2 border-r border-[var(--color-border)] overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="w-5 h-5 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-12 text-[var(--color-text-muted)] text-[13px]">
                                Prompt bulunamadı
                            </div>
                        ) : (
                            <div className="p-2 space-y-1">
                                {filtered.map((prompt) => (
                                    <button
                                        key={prompt.id}
                                        onClick={() => setSelectedId(prompt.id)}
                                        className={`w-full text-left p-3 rounded-xl transition-all ${
                                            selectedId === prompt.id
                                                ? "bg-[var(--color-brand-light)] border border-[var(--color-brand-dim)]"
                                                : "hover:bg-[var(--color-surface-hover)] border border-transparent"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <p className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
                                                {prompt.name}
                                            </p>
                                            {selectedId === prompt.id && (
                                                <Check size={14} className="text-[var(--color-brand)] flex-shrink-0" />
                                            )}
                                        </div>
                                        {prompt.description && (
                                            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">
                                                {prompt.description}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-active)] text-[var(--color-text-muted)]">
                                                {CATEGORIES.find(c => c.value === prompt.category)?.label || prompt.category}
                                            </span>
                                            <span className="text-[10px] text-[var(--color-text-muted)]">
                                                {prompt.prompt_text.length} karakter
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Preview */}
                    <div className="w-1/2 overflow-y-auto p-4">
                        {selectedPrompt ? (
                            <div className="space-y-3">
                                <h4 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                                    {selectedPrompt.name}
                                </h4>
                                {selectedPrompt.description && (
                                    <p className="text-[12px] text-[var(--color-text-secondary)]">
                                        {selectedPrompt.description}
                                    </p>
                                )}
                                <pre className="text-[12px] font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap bg-[var(--color-surface-hover)] rounded-lg p-3 max-h-[400px] overflow-y-auto">
                                    {selectedPrompt.prompt_text}
                                </pre>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <FileText size={32} className="text-[var(--color-text-muted)] opacity-40 mb-2" />
                                <p className="text-[13px] text-[var(--color-text-muted)]">
                                    Önizleme için bir prompt seçin
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)]">
                    <button onClick={onClose} className="btn-ghost px-4 py-2 text-[13px]">
                        İptal
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedPrompt}
                        className="btn-primary px-5 py-2 text-[13px] disabled:opacity-50"
                    >
                        <Check size={14} />
                        Seç ve Uygula
                    </button>
                </div>
            </div>
        </div>
    );
}
