"use client";

import { useState, useEffect, useCallback } from "react";
import { Building2, Search, Settings, MessageSquare, Bot, Save, Loader2, Check, AlertCircle, FileText, Layers } from "lucide-react";
import PromptPickerModal from "./PromptPickerModal";

interface Tenant {
    id: string;
    name: string;
    logo_url: string | null;
}

interface TenantSettings {
    model: string;
    promptText: string;
    [key: string]: unknown;
}

interface PromptTemplate {
    id: string;
    name: string;
    description?: string;
    category: string;
    prompt_text: string;
}

interface ModelTier {
    id: string;
    name: string;
    display_name: string;
    description?: string;
    is_default: boolean;
}

export default function BusinessManagementPanel({ tenants }: { tenants: Tenant[] }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
    const [settings, setSettings] = useState<TenantSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const [registryModels, setRegistryModels] = useState<Array<{ id: string; openrouter_id: string; display_name: string }>>([]);
    const [showPromptPicker, setShowPromptPicker] = useState(false);
    const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
    const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
    // Tier state
    const [tiers, setTiers] = useState<ModelTier[]>([]);
    const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
    const [tierSaving, setTierSaving] = useState(false);

    const filteredTenants = tenants.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const loadRegistryModels = useCallback(async (tenantId: string) => {
        try {
            const res = await fetch(`/api/models?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
            if (res.ok) setRegistryModels(await res.json());
        } catch { /* ignore */ }
    }, []);

    // Load all tiers once
    useEffect(() => {
        const loadTiers = async () => {
            try {
                const res = await fetch("/api/admin/model-tiers", { cache: "no-store" });
                if (res.ok) setTiers(await res.json());
            } catch { /* ignore */ }
        };
        void loadTiers();
    }, []);

    // Load prompt templates once
    useEffect(() => {
        const loadTemplates = async () => {
            try {
                const res = await fetch("/api/admin/prompt-templates?category=system", { cache: "no-store" });
                if (res.ok) setPromptTemplates(await res.json());
            } catch { /* ignore */ }
        };
        void loadTemplates();
    }, []);

    // Match prompt text to a library template
    useEffect(() => {
        if (!settings || promptTemplates.length === 0) return;
        const matched = promptTemplates.find(t => t.prompt_text.trim() === (settings.promptText as string)?.trim());
        setSelectedPromptId(matched?.id ?? null);
    }, [settings, promptTemplates]);

    useEffect(() => {
        if (!selectedTenant) {
            setSettings(null);
            return;
        }

        const loadSettings = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/tenant-ai-settings?tenantId=${selectedTenant}`);
                if (res.ok) {
                    const data = await res.json();
                    setSettings({
                        ...data,
                        model: data.model || "",
                        promptText: data.promptText || "",
                    });
                }
            } catch (err) {
                console.error("Failed to load tenant settings:", err);
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
        loadRegistryModels(selectedTenant);

        // Load tenant's current tier
        const loadTenantTier = async () => {
            try {
                const res = await fetch(`/api/admin/tenant-tier?tenantId=${encodeURIComponent(selectedTenant)}`, { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    setSelectedTierId(data.tier?.id ?? null);
                }
            } catch { /* ignore */ }
        };
        void loadTenantTier();
    }, [selectedTenant, loadRegistryModels]);

    const handleSave = async () => {
        if (!selectedTenant || !settings) return;
        
        setSaving(true);
        setSaveStatus("idle");
        
        try {
            const res = await fetch("/api/tenant-ai-settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tenantId: selectedTenant,
                    ...settings,
                }),
            });
            
            if (res.ok) {
                setSaveStatus("success");
                setTimeout(() => setSaveStatus("idle"), 2000);
            } else {
                setSaveStatus("error");
            }
        } catch (err) {
            console.error("Failed to save settings:", err);
            setSaveStatus("error");
        } finally {
            setSaving(false);
        }
    };

    const handleTierChange = async (tierId: string) => {
        if (!selectedTenant || tierSaving) return;
        setSelectedTierId(tierId);
        setTierSaving(true);
        try {
            await fetch("/api/admin/tenant-tier", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tenant_id: selectedTenant, tier_id: tierId }),
            });
            // Reload models for new tier
            await loadRegistryModels(selectedTenant);
            // Clear selected model so user picks a valid one for the new tier
            setSettings((prev) => prev ? { ...prev, model: "" } : prev);
        } catch { /* ignore */ } finally {
            setTierSaving(false);
        }
    };

    const selectedPromptName = promptTemplates.find(p => p.id === selectedPromptId)?.name;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="panel-card">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[var(--color-brand)] flex items-center justify-center">
                        <Building2 size={24} className="text-black" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">İşletme Yönetimi</h1>
                        <p className="text-sm text-[var(--color-text-muted)]">Tüm işletmelerin AI ve sistem ayarlarını yönetin</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tenant List */}
                <div className="lg:col-span-1">
                    <div className="panel-card !p-0">
                        <div className="p-4 border-b border-[var(--color-border)]">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                                <input
                                    type="text"
                                    placeholder="İşletme ara..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="form-input pl-10"
                                />
                            </div>
                        </div>
                        
                        <div className="max-h-[600px] overflow-y-auto">
                            {filteredTenants.length === 0 ? (
                                <div className="p-6 text-center text-[var(--color-text-muted)]">
                                    İşletme bulunamadı
                                </div>
                            ) : (
                                <div className="p-2 space-y-1">
                                    {filteredTenants.map((tenant) => (
                                        <button
                                            key={tenant.id}
                                            onClick={() => setSelectedTenant(tenant.id)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                                                selectedTenant === tenant.id
                                                    ? "bg-[var(--color-brand-light)] border-[var(--color-brand-dim)] border"
                                                    : "hover:bg-[var(--color-surface-hover)] border border-transparent"
                                            }`}
                                        >
                                            {tenant.logo_url ? (
                                                <img 
                                                    src={tenant.logo_url} 
                                                    alt={tenant.name}
                                                    className="w-10 h-10 rounded-lg object-cover"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-hover)] flex items-center justify-center">
                                                    <Building2 size={18} className="text-[var(--color-text-muted)]" />
                                                </div>
                                            )}
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="font-semibold text-[var(--color-text-primary)] truncate">
                                                    {tenant.name}
                                                </p>
                                                <p className="text-xs text-[var(--color-text-muted)] truncate">
                                                    {tenant.id.slice(0, 8)}...
                                                </p>
                                            </div>
                                            {selectedTenant === tenant.id && (
                                                <Check size={16} className="text-[var(--color-brand)]" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Settings Panel */}
                <div className="lg:col-span-2">
                    {!selectedTenant ? (
                        <div className="panel-card flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-hover)] flex items-center justify-center mb-4">
                                <Settings size={28} className="text-[var(--color-text-muted)]" />
                            </div>
                            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">İşletme Seçin</h3>
                            <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-xs">
                                Ayarlarını düzenlemek için soldaki listeden bir işletme seçin
                            </p>
                        </div>
                    ) : loading ? (
                        <div className="panel-card flex items-center justify-center py-20">
                            <Loader2 className="animate-spin text-[var(--color-brand)]" size={32} />
                        </div>
                    ) : settings ? (
                        <div className="space-y-4">
                            {/* Tenant Header */}
                            <div className="panel-card">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-hover)] flex items-center justify-center">
                                            <Building2 size={20} className="text-[var(--color-text-muted)]" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                                                {tenants.find(t => t.id === selectedTenant)?.name}
                                            </h2>
                                            <p className="text-xs text-[var(--color-text-muted)]">ID: {selectedTenant}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className={`btn-chunky ${saving ? "opacity-70" : ""}`}
                                    >
                                        {saving ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : saveStatus === "success" ? (
                                            <Check size={18} />
                                        ) : saveStatus === "error" ? (
                                            <AlertCircle size={18} />
                                        ) : (
                                            <Save size={18} />
                                        )}
                                        <span>{saving ? "Kaydediliyor..." : saveStatus === "success" ? "Kaydedildi!" : "Kaydet"}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Tier Seçimi */}
                            {tiers.length > 0 && (
                                <div className="panel-card space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Layers size={18} className="text-purple-400" />
                                            <h3 className="font-semibold text-[var(--color-text-primary)]">Model Erişim Seviyesi</h3>
                                        </div>
                                        {tierSaving && <Loader2 size={14} className="animate-spin text-[var(--color-text-muted)]" />}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {tiers.map((tier) => (
                                            <button
                                                key={tier.id}
                                                onClick={() => handleTierChange(tier.id)}
                                                disabled={tierSaving}
                                                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                                                    selectedTierId === tier.id
                                                        ? "border-[var(--color-brand)] bg-[var(--color-brand-light)]"
                                                        : "border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                                                } disabled:opacity-60`}
                                            >
                                                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                                                    selectedTierId === tier.id
                                                        ? "border-[var(--color-brand)] bg-[var(--color-brand)]"
                                                        : "border-[var(--color-border)]"
                                                }`}>
                                                    {selectedTierId === tier.id && <Check size={9} className="text-black" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`text-[13px] font-semibold truncate ${
                                                        selectedTierId === tier.id ? "text-[var(--color-brand-dark)]" : "text-[var(--color-text-primary)]"
                                                    }`}>{tier.display_name}</p>
                                                    {tier.description && (
                                                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 line-clamp-2">{tier.description}</p>
                                                    )}
                                                    {tier.is_default && (
                                                        <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">varsayılan</span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-[var(--color-text-muted)]">Tier değişince işletme için görünür modeller güncellenir.</p>
                                </div>
                            )}

                            {/* Model Selection */}
                            <div className="panel-card space-y-4">
                                <div className="flex items-center gap-3 mb-1">
                                    <Bot size={18} className="text-[var(--color-brand)]" />
                                    <h3 className="font-semibold text-[var(--color-text-primary)]">Model Seçimi</h3>
                                </div>
                                <div className="form-group !mb-0">
                                    <label className="form-label">AI Model</label>
                                    <select
                                        value={settings.model as string}
                                        onChange={(e) => setSettings({...settings, model: e.target.value})}
                                        className="form-select"
                                    >
                                        <option value="">— Model seçin —</option>
                                        {registryModels.map((m) => (
                                            <option key={m.id} value={m.openrouter_id}>{m.display_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Prompt Library Selection */}
                            <div className="panel-card space-y-4">
                                <div className="flex items-center gap-3 mb-1">
                                    <MessageSquare size={18} className="text-purple-400" />
                                    <h3 className="font-semibold text-[var(--color-text-primary)]">Sistem Promptu</h3>
                                </div>
                                {selectedPromptId && selectedPromptName ? (
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <FileText size={16} className="text-purple-400 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="font-semibold text-[var(--color-text-primary)] truncate">{selectedPromptName}</p>
                                                <p className="text-xs text-[var(--color-text-muted)]">Prompt kütüphanesinden seçildi</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowPromptPicker(true)}
                                            className="shrink-0 ml-3 text-sm font-semibold text-[var(--color-brand-dark)] hover:text-[var(--color-brand)] transition-colors"
                                        >
                                            Değiştir
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 py-6 rounded-xl border-2 border-dashed border-[var(--color-border)]">
                                        <FileText size={24} className="text-[var(--color-text-muted)]" />
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-[var(--color-text-primary)]">Prompt seçilmedi</p>
                                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Kütüphaneden bir prompt seçin</p>
                                        </div>
                                        <button
                                            onClick={() => setShowPromptPicker(true)}
                                            className="btn-chunky !py-2 !px-4 text-sm"
                                        >
                                            <FileText size={14} />
                                            Kütüphaneden Seç
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Prompt Picker Modal */}
            {showPromptPicker && (
                <PromptPickerModal
                    category="system"
                    onSelect={(promptText) => {
                        if (settings) {
                            setSettings({ ...settings, promptText });
                        }
                    }}
                    onClose={() => setShowPromptPicker(false)}
                />
            )}
        </div>
    );
}
