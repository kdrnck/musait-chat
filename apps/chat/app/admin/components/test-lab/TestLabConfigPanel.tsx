"use client";

import { useState, useEffect } from "react";
import { Cpu, Bot, User, Code2, Save, Trash2, Pencil, History, RefreshCw } from "lucide-react";
import PromptPickerModal from "../PromptPickerModal";
import type { TestConfig } from "./useTestLabStream";

interface AiModel {
    id: string;
    openrouter_id: string;
    display_name: string;
    is_enabled: boolean;
}

interface Tenant {
    id: string;
    name: string;
}

interface TestLabConfigPanelProps {
    config: TestConfig;
    onConfigChange: (config: TestConfig) => void;
    onClearChat: () => void;
}

export default function TestLabConfigPanel({
    config,
    onConfigChange,
    onClearChat,
}: TestLabConfigPanelProps) {
    const [models, setModels] = useState<AiModel[]>([]);
    const [loadingModels, setLoadingModels] = useState(true);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loadingTenants, setLoadingTenants] = useState(true);
    const [showPromptPicker, setShowPromptPicker] = useState(false);

    // Load models
    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/admin/models", { cache: "no-store" });
                if (!res.ok) throw new Error();
                const data = await res.json();
                const enabled = data.filter((m: AiModel) => m.is_enabled);
                setModels(enabled);

                const saved = localStorage.getItem("modelTest_model");
                const exists = enabled.some((m: AiModel) => m.openrouter_id === saved);
                if (!saved || !exists) {
                    if (enabled.length > 0) {
                        onConfigChange({ ...config, model: enabled[0].openrouter_id });
                    }
                } else {
                    onConfigChange({ ...config, model: saved });
                }
            } catch {
                // ignore
            } finally {
                setLoadingModels(false);
            }
        };
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load tenants
    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/admin/tenants", { cache: "no-store" });
                if (!res.ok) throw new Error();
                const data = await res.json();
                setTenants(data);

                const saved = localStorage.getItem("modelTest_tenantId");
                const exists = data.some((t: Tenant) => t.id === saved);
                if (!saved || !exists) {
                    if (data.length > 0) {
                        onConfigChange({ ...config, tenantId: data[0].id });
                    }
                } else {
                    onConfigChange({ ...config, tenantId: saved });
                }
            } catch {
                // ignore
            } finally {
                setLoadingTenants(false);
            }
        };
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Persist to localStorage
    useEffect(() => {
        if (config.model) localStorage.setItem("modelTest_model", config.model);
    }, [config.model]);
    useEffect(() => {
        if (config.tenantId) localStorage.setItem("modelTest_tenantId", config.tenantId);
    }, [config.tenantId]);
    useEffect(() => {
        if (config.phone) localStorage.setItem("modelTest_phone", config.phone);
    }, [config.phone]);

    return (
        <div className="w-[300px] flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface-pure)] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
                <h2 className="text-[14px] font-bold text-[var(--color-text-primary)]">Test Lab Ayarları</h2>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Model, işletme ve kimlik</p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Model Selection */}
                <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                        <Cpu size={13} className="text-[var(--color-brand-dark)]" /> Model
                    </label>
                    <select
                        value={config.model}
                        onChange={(e) => onConfigChange({ ...config, model: e.target.value })}
                        disabled={loadingModels}
                        className="form-input text-[13px] w-full"
                    >
                        {loadingModels ? (
                            <option>Yükleniyor...</option>
                        ) : models.length === 0 ? (
                            <option>Model bulunamadı</option>
                        ) : (
                            models.map((m) => (
                                <option key={m.id} value={m.openrouter_id}>{m.display_name}</option>
                            ))
                        )}
                    </select>
                </div>

                {/* Tenant Selection */}
                <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                        <Bot size={13} className="text-[var(--color-brand-dark)]" /> Test İşletmesi
                    </label>
                    <select
                        value={config.tenantId}
                        onChange={(e) => onConfigChange({ ...config, tenantId: e.target.value })}
                        disabled={loadingTenants}
                        className="form-input text-[13px] w-full"
                    >
                        {loadingTenants ? (
                            <option>Yükleniyor...</option>
                        ) : tenants.length === 0 ? (
                            <option>İşletme bulunamadı</option>
                        ) : (
                            tenants.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))
                        )}
                    </select>
                </div>

                {/* Phone / Identity */}
                <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                        <User size={13} className="text-[var(--color-brand-dark)]" /> Kimlik Simülasyonu
                    </label>
                    <input
                        type="text"
                        value={config.phone}
                        onChange={(e) => onConfigChange({ ...config, phone: e.target.value })}
                        className="form-input text-[13px] w-full"
                        placeholder="+905..."
                    />
                </div>

                {/* System Prompt */}
                <div className="space-y-2 flex-1 flex flex-col">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                            <Code2 size={13} className="text-[var(--color-brand-dark)]" /> Sistem Promptu
                        </label>
                        <button
                            onClick={() => setShowPromptPicker(true)}
                            className="text-[10px] font-semibold text-[var(--color-brand-dark)] hover:text-[var(--color-brand)] transition-colors"
                        >
                            Kütüphaneden Seç
                        </button>
                    </div>
                    <textarea
                        value={config.system}
                        onChange={(e) => onConfigChange({ ...config, system: e.target.value })}
                        className="form-input text-[12px] font-mono w-full flex-1 min-h-[200px] resize-none"
                        placeholder="Sen profesyonel bir yapay zeka asistanısın..."
                    />
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                    <button
                        onClick={onClearChat}
                        className="w-full flex items-center justify-center gap-2 py-2 text-[12px] font-semibold text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                        <Trash2 size={13} />
                        Sohbeti Temizle
                    </button>
                </div>
            </div>

            {/* Prompt Picker Modal */}
            {showPromptPicker && (
                <PromptPickerModal
                    onSelect={(promptText) => {
                        onConfigChange({ ...config, system: promptText });
                    }}
                    onClose={() => setShowPromptPicker(false)}
                />
            )}
        </div>
    );
}
