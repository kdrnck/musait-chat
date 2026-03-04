"use client";

import { useState, useEffect, useCallback } from "react";
import { Building2, Search, Settings, MessageSquare, Bot, ChevronDown, ChevronUp, Save, Loader2, Check, AlertCircle, Globe } from "lucide-react";

interface Tenant {
    id: string;
    name: string;
    logo_url: string | null;
}

interface TenantSettings {
    model: string;
    promptText: string;
    businessContext: string;
    outboundNumberMode: string;
    bookingFlowEnabled: boolean;
}

export default function BusinessManagementPanel({ tenants }: { tenants: Tenant[] }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
    const [expandedSection, setExpandedSection] = useState<string | null>("ai");
    const [settings, setSettings] = useState<TenantSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const [registryModels, setRegistryModels] = useState<Array<{ id: string; openrouter_id: string; display_name: string }>>([])

    const filteredTenants = tenants.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const loadRegistryModels = useCallback(async (tenantId: string) => {
        try {
            const res = await fetch(`/api/models?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
            if (res.ok) setRegistryModels(await res.json());
        } catch { /* ignore */ }
    }, []);

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
                        model: data.model || "",
                        promptText: data.promptText || "",
                        businessContext: data.businessContext || "",
                        outboundNumberMode: data.outboundNumberMode || "inbound",
                        bookingFlowEnabled: data.bookingFlowEnabled ?? true,
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

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

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

                            {/* AI Settings Section */}
                            <div className="panel-card !p-0">
                                <button
                                    onClick={() => toggleSection("ai")}
                                    className="w-full flex items-center justify-between p-5 hover:bg-[var(--color-surface-hover)] transition-colors rounded-t-2xl"
                                >
                                    <div className="flex items-center gap-3">
                                        <Bot size={20} className="text-[var(--color-brand)]" />
                                        <div className="text-left">
                                            <h3 className="font-semibold text-[var(--color-text-primary)]">AI Ayarları</h3>
                                            <p className="text-xs text-[var(--color-text-muted)]">Model, prompt ve davranış ayarları</p>
                                        </div>
                                    </div>
                                    {expandedSection === "ai" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                                
                                {expandedSection === "ai" && (
                                    <div className="p-5 pt-0 space-y-5 border-t border-[var(--color-border)]">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="form-group !mb-0">
                                                <label className="form-label">Model</label>
                                                <select
                                                    value={settings.model}
                                                    onChange={(e) => setSettings({...settings, model: e.target.value})}
                                                    className="form-select"
                                                >
                                                    <option value="">— Model seçin —</option>
                                                    {registryModels.map((m) => (
                                                        <option key={m.id} value={m.openrouter_id}>{m.display_name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            
                                            <div className="form-group !mb-0">
                                                <label className="form-label">Giden Numara Modu</label>
                                                <select
                                                    value={settings.outboundNumberMode}
                                                    onChange={(e) => setSettings({...settings, outboundNumberMode: e.target.value})}
                                                    className="form-select"
                                                >
                                                    <option value="inbound">Gelen Numara</option>
                                                    <option value="musait">Musait Numarası</option>
                                                    <option value="tenant">İşletme Numarası</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                                            <div>
                                                <p className="font-medium text-[var(--color-text-primary)]">Randevu Akışı</p>
                                                <p className="text-xs text-[var(--color-text-muted)]">AI randevu oluşturabilsin mi?</p>
                                            </div>
                                            <button
                                                onClick={() => setSettings({...settings, bookingFlowEnabled: !settings.bookingFlowEnabled})}
                                                className={`toggle-track ${settings.bookingFlowEnabled ? "on" : ""}`}
                                            >
                                                <div className="toggle-thumb" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Prompt Section */}
                            <div className="panel-card !p-0">
                                <button
                                    onClick={() => toggleSection("prompt")}
                                    className="w-full flex items-center justify-between p-5 hover:bg-[var(--color-surface-hover)] transition-colors rounded-t-2xl"
                                >
                                    <div className="flex items-center gap-3">
                                        <MessageSquare size={20} className="text-purple-400" />
                                        <div className="text-left">
                                            <h3 className="font-semibold text-[var(--color-text-primary)]">Prompt Ayarları</h3>
                                            <p className="text-xs text-[var(--color-text-muted)]">Özel sistem promptu ve işletme bilgileri</p>
                                        </div>
                                    </div>
                                    {expandedSection === "prompt" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                                
                                {expandedSection === "prompt" && (
                                    <div className="p-5 pt-0 space-y-5 border-t border-[var(--color-border)]">
                                        <div className="form-group !mb-0">
                                            <label className="form-label">Özel Sistem Promptu (Opsiyonel)</label>
                                            <p className="text-xs text-[var(--color-text-muted)] mb-2">
                                                Boş bırakılırsa global prompt kullanılır
                                            </p>
                                            <textarea
                                                value={settings.promptText}
                                                onChange={(e) => setSettings({...settings, promptText: e.target.value})}
                                                className="form-textarea min-h-[200px] font-mono text-sm"
                                                placeholder="Özel prompt yazın veya boş bırakın..."
                                            />
                                        </div>

                                        <div className="form-group !mb-0">
                                            <label className="form-label flex items-center gap-2">
                                                <Globe size={14} className="text-[var(--color-brand)]" />
                                                İşletme Hakkında Bilgiler
                                            </label>
                                            <p className="text-xs text-[var(--color-text-muted)] mb-2">
                                                Adres, çalışma saatleri, özel notlar gibi bilgiler. AI bu bilgileri müşteri sorularını yanıtlarken kullanacak.
                                            </p>
                                            <textarea
                                                value={settings.businessContext}
                                                onChange={(e) => setSettings({...settings, businessContext: e.target.value})}
                                                className="form-textarea min-h-[150px]"
                                                placeholder="Örnek:&#10;Adres: Bağdat Caddesi No:123, Kadıköy&#10;Çalışma Saatleri: Hafta içi 09:00-18:00&#10;Telefon: 0216 123 45 67&#10;Özel notlar: Pazar günleri kapalıyız..."
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
