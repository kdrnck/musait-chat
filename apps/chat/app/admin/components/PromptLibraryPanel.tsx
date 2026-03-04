/* eslint-disable */
"use client";

import { useState, useEffect } from "react";
import { 
    FileText, 
    Plus, 
    Search, 
    Edit2, 
    Trash2, 
    ChevronDown, 
    ChevronUp,
    Save,
    X,
    Bot,
    Building2,
    Filter,
    Copy,
    Check,
    Shield,
    RefreshCw,
    Sparkles,
    ArrowRight,
} from "lucide-react";
import GlobalAiSettingsPanel from "./GlobalAiSettingsPanel";

type LibraryTab = "templates" | "global-prompt";

interface PromptTemplate {
    id: string;
    name: string;
    description?: string;
    category: string;
    prompt_text: string;
    model_id?: string;
    tenant_id?: string;
    parameters?: Record<string, any>;
    is_active?: boolean;
    is_default?: boolean;
    created_at?: string;
    updated_at?: string;
}

interface Tenant {
    id: string;
    name: string;
}

const CATEGORIES = [
    { value: "system", label: "Sistem Promptu", icon: Bot },
    { value: "routing", label: "Yönlendirme", icon: Building2 },
    { value: "greeting", label: "Karşılama", icon: FileText },
    { value: "general", label: "Genel", icon: FileText },
];

export default function PromptLibraryPanel() {
    const [activeTab, setActiveTab] = useState<LibraryTab>("templates");
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterCategory, setFilterCategory] = useState<string>("");
    const [filterTenant, setFilterTenant] = useState<string>("");
    
    // Edit/Create state
    const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        category: "general",
        prompt_text: "",
        tenant_id: "",
        is_default: false,
    });

    // Load prompts and tenants
    useEffect(() => {
        const loadData = async () => {
            try {
                const [promptsRes, tenantsRes] = await Promise.all([
                    fetch("/api/admin/prompt-templates", { cache: "no-store" }),
                    fetch("/api/admin/tenants", { cache: "no-store" }),
                ]);
                
                if (promptsRes.ok) {
                    const data = await promptsRes.json();
                    setPrompts(data);
                }
                
                if (tenantsRes.ok) {
                    const data = await tenantsRes.json();
                    setTenants(data);
                }
            } catch (err) {
                console.error("Veri yükleme hatası:", err);
            } finally {
                setLoading(false);
            }
        };
        void loadData();
    }, []);

    // Filter prompts
    const filteredPrompts = prompts.filter((p) => {
        const matchesSearch = !searchQuery || 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.prompt_text.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = !filterCategory || p.category === filterCategory;
        const matchesTenant = !filterTenant || 
            (filterTenant === "global" ? !p.tenant_id : p.tenant_id === filterTenant);
        return matchesSearch && matchesCategory && matchesTenant;
    });

    const handleStartCreate = () => {
        setFormData({
            name: "",
            description: "",
            category: "general",
            prompt_text: "",
            tenant_id: "",
            is_default: false,
        });
        setEditingPrompt(null);
        setIsCreating(true);
    };

    const handleStartEdit = (prompt: PromptTemplate) => {
        setFormData({
            name: prompt.name,
            description: prompt.description || "",
            category: prompt.category,
            prompt_text: prompt.prompt_text,
            tenant_id: prompt.tenant_id || "",
            is_default: prompt.is_default || false,
        });
        setEditingPrompt(prompt);
        setIsCreating(false);
    };

    const handleCancel = () => {
        setEditingPrompt(null);
        setIsCreating(false);
        setFormData({
            name: "",
            description: "",
            category: "general",
            prompt_text: "",
            tenant_id: "",
            is_default: false,
        });
    };

    const handleSave = async () => {
        if (!formData.name.trim() || !formData.prompt_text.trim()) {
            alert("İsim ve prompt metni zorunludur");
            return;
        }

        setSaving(true);
        try {
            const body = {
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                category: formData.category,
                prompt_text: formData.prompt_text.trim(),
                tenant_id: formData.tenant_id || null,
                is_default: formData.is_default,
            };

            if (editingPrompt) {
                // Update
                const res = await fetch(`/api/admin/prompt-templates/${editingPrompt.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                
                if (!res.ok) throw new Error("Güncelleme başarısız");
                
                const updated = await res.json();
                setPrompts((prev) => prev.map((p) => p.id === editingPrompt.id ? updated : p));
            } else {
                // Create
                const res = await fetch("/api/admin/prompt-templates", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.details || errData.error || `HTTP ${res.status}`);
                }
                
                const created = await res.json();
                setPrompts((prev) => [created, ...prev]);
            }
            
            handleCancel();
        } catch (err) {
            console.error("Kaydetme hatası:", err);
            alert(`İşlem başarısız: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Bu promptu silmek istediğinize emin misiniz?")) return;
        
        try {
            const res = await fetch(`/api/admin/prompt-templates/${id}`, {
                method: "DELETE",
            });
            
            if (!res.ok) throw new Error("Silme başarısız");
            
            setPrompts((prev) => prev.filter((p) => p.id !== id));
            if (editingPrompt?.id === id) handleCancel();
        } catch (err) {
            console.error("Silme hatası:", err);
            alert("Silme işlemi başarısız oldu");
        }
    };

    const handleCopy = (prompt: PromptTemplate) => {
        navigator.clipboard.writeText(prompt.prompt_text);
        setCopiedId(prompt.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const getCategoryLabel = (category: string) => {
        return CATEGORIES.find((c) => c.value === category)?.label || category;
    };

    const getTenantName = (tenantId?: string) => {
        if (!tenantId) return "Global";
        return tenants.find((t) => t.id === tenantId)?.name || "Bilinmeyen";
    };

    if (loading) {
        return (
            <div className="panel-card flex items-center justify-center min-h-[400px]">
                <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Yükleniyor...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Tab Header */}
            <div className="flex items-center gap-1 border-b border-[var(--color-border)] pb-0">
                <button
                    onClick={() => setActiveTab("templates")}
                    className={`px-5 py-3 text-[14px] font-semibold border-b-2 transition-colors ${
                        activeTab === "templates"
                            ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                            : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    }`}
                >
                    Şablon Kütüphanesi
                </button>
                <button
                    onClick={() => setActiveTab("global-prompt")}
                    className={`px-5 py-3 text-[14px] font-semibold border-b-2 transition-colors ${
                        activeTab === "global-prompt"
                            ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                            : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    }`}
                >
                    Global Master Prompt
                </button>
            </div>

            {activeTab === "global-prompt" ? (
                <GlobalAiSettingsPanel />
            ) : (
            <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">
                    Prompt Kütüphanesi
                </h2>
                <button
                    onClick={handleStartCreate}
                    className="btn-primary gap-2"
                    disabled={isCreating || editingPrompt !== null}
                >
                    <Plus size={16} />
                    <span>Yeni Prompt</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px] relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input
                        type="text"
                        placeholder="Ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl text-[14px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] transition-colors"
                    />
                </div>
                
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl text-[14px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] appearance-none cursor-pointer min-w-[160px]"
                >
                    <option value="">Tüm Kategoriler</option>
                    {CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                </select>
                
                <select
                    value={filterTenant}
                    onChange={(e) => setFilterTenant(e.target.value)}
                    className="px-4 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl text-[14px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] appearance-none cursor-pointer min-w-[160px]"
                >
                    <option value="">Tüm Kapsamlar</option>
                    <option value="global">Global</option>
                    {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                    ))}
                </select>
            </div>

            {/* Edit/Create Form */}
            {(isCreating || editingPrompt) && (
                <div className="panel-card border-2 border-[var(--color-brand-dim)]">
                    <div className="panel-header flex items-center justify-between">
                        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                            {isCreating ? "Yeni Prompt Oluştur" : "Promptu Düzenle"}
                        </h3>
                        <button onClick={handleCancel} className="btn-ghost p-2">
                            <X size={16} />
                        </button>
                    </div>
                    
                    <div className="space-y-4 mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label className="form-label">İsim *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl text-[14px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)]"
                                    placeholder="Prompt adı"
                                />
                            </div>
                            
                            <div className="form-group">
                                <label className="form-label">Kategori</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl text-[14px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] appearance-none cursor-pointer"
                                >
                                    {CATEGORIES.map((cat) => (
                                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label className="form-label">Kapsam</label>
                                <select
                                    value={formData.tenant_id}
                                    onChange={(e) => setFormData((f) => ({ ...f, tenant_id: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl text-[14px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] appearance-none cursor-pointer"
                                >
                                    <option value="">Global (Tüm İşletmeler)</option>
                                    {tenants.map((tenant) => (
                                        <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="form-group flex items-center gap-3 pt-6">
                                <input
                                    type="checkbox"
                                    id="is_default"
                                    checked={formData.is_default}
                                    onChange={(e) => setFormData((f) => ({ ...f, is_default: e.target.checked }))}
                                    className="w-5 h-5 rounded border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                                />
                                <label htmlFor="is_default" className="text-[13px] text-[var(--color-text-secondary)] cursor-pointer">
                                    Varsayılan olarak ayarla
                                </label>
                            </div>
                        </div>
                        
                        <div className="form-group">
                            <label className="form-label">Açıklama</label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl text-[14px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)]"
                                placeholder="İsteğe bağlı açıklama"
                            />
                        </div>
                        
                        <div className="form-group">
                            <label className="form-label">Prompt Metni *</label>
                            <textarea
                                value={formData.prompt_text}
                                onChange={(e) => setFormData((f) => ({ ...f, prompt_text: e.target.value }))}
                                rows={10}
                                className="w-full px-4 py-3 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-xl text-[14px] text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-brand)] resize-y"
                                placeholder="Sistem promptunu buraya yazın..."
                            />
                        </div>
                        
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={handleCancel} className="btn-secondary">
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formData.name.trim() || !formData.prompt_text.trim()}
                                className="btn-primary gap-2"
                            >
                                {saving ? (
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Save size={16} />
                                )}
                                <span>{isCreating ? "Oluştur" : "Kaydet"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Prompts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredPrompts.length === 0 ? (
                    <div className="col-span-full panel-card text-center py-12">
                        <FileText size={40} className="mx-auto text-[var(--color-text-muted)] opacity-50 mb-3" />
                        <p className="text-[var(--color-text-muted)]">
                            {searchQuery || filterCategory || filterTenant
                                ? "Filtrelere uygun prompt bulunamadı"
                                : "Henüz prompt oluşturulmamış"}
                        </p>
                    </div>
                ) : (
                    filteredPrompts.map((prompt) => (
                        <PromptCard
                            key={prompt.id}
                            prompt={prompt}
                            isEditing={editingPrompt?.id === prompt.id}
                            isCopied={copiedId === prompt.id}
                            onEdit={() => handleStartEdit(prompt)}
                            onDelete={() => handleDelete(prompt.id)}
                            onCopy={() => handleCopy(prompt)}
                            getCategoryLabel={getCategoryLabel}
                            getTenantName={getTenantName}
                            tenants={tenants}
                        />
                    ))
                )}
            </div>
            </div>
            )}
        </div>
    );
}

function PromptCard({
    prompt,
    isEditing,
    isCopied,
    onEdit,
    onDelete,
    onCopy,
    getCategoryLabel,
    getTenantName,
    tenants,
}: {
    prompt: PromptTemplate;
    isEditing: boolean;
    isCopied: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onCopy: () => void;
    getCategoryLabel: (cat: string) => string;
    getTenantName: (tenantId?: string) => string;
    tenants: Tenant[];
}) {
    const [expanded, setExpanded] = useState(false);
    const [showTenantPicker, setShowTenantPicker] = useState(false);
    const [applyingToTenant, setApplyingToTenant] = useState(false);

    const handleApplyToTenant = async (tenantId: string) => {
        setApplyingToTenant(true);
        try {
            const res = await fetch("/api/admin/tenant-system-prompt", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tenantId, promptText: prompt.prompt_text }),
            });
            if (res.ok) {
                setShowTenantPicker(false);
                alert("Prompt işletmeye uygulandı!");
            }
        } catch {
            alert("Uygulama başarısız oldu");
        } finally {
            setApplyingToTenant(false);
        }
    };

    return (
        <div className={`panel-card transition-all ${isEditing ? "ring-2 ring-[var(--color-brand)]" : ""}`}>
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--color-surface-active)] flex items-center justify-center">
                    <FileText size={18} className="text-[var(--color-brand)]" />
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                            {prompt.name}
                        </h4>
                        {prompt.is_default && (
                            <span className="chip bg-[var(--color-brand-dim)] text-[var(--color-brand)]">
                                Varsayılan
                            </span>
                        )}
                    </div>
                    
                    {prompt.description && (
                        <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
                            {prompt.description}
                        </p>
                    )}
                    
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="chip">{getCategoryLabel(prompt.category)}</span>
                        <span className="chip">{getTenantName(prompt.tenant_id)}</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-1">
                    <button
                        onClick={onCopy}
                        className="btn-ghost p-2"
                        title="Kopyala"
                    >
                        {isCopied ? <Check size={16} className="text-[var(--color-brand)]" /> : <Copy size={16} />}
                    </button>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="btn-ghost p-2"
                        title={expanded ? "Daralt" : "Genişlet"}
                    >
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                        onClick={onEdit}
                        className="btn-ghost p-2"
                        title="Düzenle"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={onDelete}
                        className="btn-ghost p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        title="Sil"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
            
            {expanded && (
                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                    <pre className="text-[12px] font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap bg-[var(--color-surface-hover)] rounded-lg p-4 max-h-[300px] overflow-y-auto">
                        {prompt.prompt_text}
                    </pre>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-3">
                        <button
                            onClick={() => setShowTenantPicker(!showTenantPicker)}
                            className="text-[11px] font-semibold text-[var(--color-brand-dark)] hover:text-[var(--color-brand)] transition-colors flex items-center gap-1"
                        >
                            <Building2 size={12} />
                            İşletmeye Uygula
                        </button>
                    </div>

                    {/* Tenant Picker */}
                    {showTenantPicker && (
                        <div className="mt-2 p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-2">
                            <p className="text-[11px] font-semibold text-[var(--color-text-muted)]">İşletme seçin:</p>
                            <div className="max-h-[150px] overflow-y-auto space-y-1">
                                {tenants.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleApplyToTenant(t.id)}
                                        disabled={applyingToTenant}
                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-surface-active)] text-[12px] text-[var(--color-text-primary)] transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <Building2 size={12} className="text-[var(--color-text-muted)]" />
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
