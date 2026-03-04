"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Plus,
    Trash2,
    RefreshCw,
    Power,
    PowerOff,
    Pencil,
    X,
    ChevronDown,
    ChevronRight,
    Zap,
    DollarSign,
    Gauge,
    Settings2,
    Brain,
    Wrench,
} from "lucide-react";
import ModelTiersPanel from "./ModelTiersPanel";

type ModelTab = "registry" | "tiers";

/* ─────────────────────────── Types ─────────────────────────── */

interface ProviderConfig {
    sort?: string | { by: string; partition?: string };
    order?: string[];
    allow_fallbacks?: boolean;
    require_parameters?: boolean;
    data_collection?: "allow" | "deny";
    quantizations?: string[];
    ignore?: string[];
    only?: string[];
    preferred_min_throughput?: number | Record<string, number>;
    preferred_max_latency?: number | Record<string, number>;
    max_price?: { prompt?: number; completion?: number };
}

interface AiModel {
    id: string;
    openrouter_id: string;
    display_name: string;
    is_enabled: boolean;
    provider_hint: string[] | null;
    provider_config: ProviderConfig | null;
    pricing_input: number | null;
    pricing_output: number | null;
    tier: string;
    supports_tools: boolean;
    supports_reasoning: boolean;
    context_window: number | null;
    max_output_tokens: number | null;
    description: string | null;
    sort_order: number;
    created_at: string;
    max_iterations: number;
    llm_timeout_ms: number;
}

interface ModelTier {
    id: string;
    name: string;
    display_name: string;
}

type ProviderMode = "auto" | "throughput" | "price" | "latency" | "custom";

interface ModelFormState {
    openrouter_id: string;
    display_name: string;
    pricing_input: string;
    pricing_output: string;
    provider_hint: string;
    tier: string;
    supports_tools: boolean;
    supports_reasoning: boolean;
    context_window: string;
    max_output_tokens: string;
    description: string;
    sort_order: string;
    providerMode: ProviderMode;
    providerOrder: string;
    providerAllowFallbacks: boolean;
    providerIgnore: string;
    providerOnly: string;
    providerQuantizations: string[];
    providerRequireParameters: boolean;
    providerDataCollection: "allow" | "deny";
    providerMinThroughput: string;
    providerMaxLatency: string;
    providerMaxPricePrompt: string;
    providerMaxPriceCompletion: string;
    maxIterations: string;
    llmTimeoutMs: string;
}

const EMPTY_FORM: ModelFormState = {
    openrouter_id: "",
    display_name: "",
    pricing_input: "",
    pricing_output: "",
    provider_hint: "",
    tier: "default",
    supports_tools: true,
    supports_reasoning: false,
    context_window: "",
    max_output_tokens: "",
    description: "",
    sort_order: "0",
    providerMode: "auto",
    providerOrder: "",
    providerAllowFallbacks: true,
    providerIgnore: "",
    providerOnly: "",
    providerQuantizations: [],
    providerRequireParameters: false,
    providerDataCollection: "allow",
    providerMinThroughput: "",
    providerMaxLatency: "",
    providerMaxPricePrompt: "",
    providerMaxPriceCompletion: "",
    maxIterations: "5",
    llmTimeoutMs: "15000",
};

const QUANTIZATION_OPTIONS = ["int4", "int8", "fp4", "fp6", "fp8", "fp16", "bf16", "fp32"];

/* ─────────────────── Helpers ──────────────────────────────── */

function parseCSV(val: string): string[] {
    return val.split(",").map((s) => s.trim()).filter(Boolean);
}

function providerConfigToForm(pc: ProviderConfig | null): Partial<ModelFormState> {
    if (!pc) return { providerMode: "auto" };
    const sort = pc.sort;
    let mode: ProviderMode = "custom";
    if (!sort && !pc.order?.length && !pc.only?.length && !pc.ignore?.length) mode = "auto";
    else if (typeof sort === "string") {
        if (sort === "throughput") mode = "throughput";
        else if (sort === "price") mode = "price";
        else if (sort === "latency") mode = "latency";
    } else if (typeof sort === "object" && sort.by) {
        if (sort.by === "throughput") mode = "throughput";
        else if (sort.by === "price") mode = "price";
        else if (sort.by === "latency") mode = "latency";
    }
    if (mode !== "auto" && (pc.order?.length || pc.only?.length || pc.ignore?.length || pc.quantizations?.length || pc.max_price)) mode = "custom";

    return {
        providerMode: mode,
        providerOrder: pc.order?.join(", ") || "",
        providerAllowFallbacks: pc.allow_fallbacks ?? true,
        providerIgnore: pc.ignore?.join(", ") || "",
        providerOnly: pc.only?.join(", ") || "",
        providerQuantizations: pc.quantizations || [],
        providerRequireParameters: pc.require_parameters ?? false,
        providerDataCollection: pc.data_collection || "allow",
        providerMinThroughput: typeof pc.preferred_min_throughput === "number" ? String(pc.preferred_min_throughput) : "",
        providerMaxLatency: typeof pc.preferred_max_latency === "number" ? String(pc.preferred_max_latency) : "",
        providerMaxPricePrompt: pc.max_price?.prompt != null ? String(pc.max_price.prompt) : "",
        providerMaxPriceCompletion: pc.max_price?.completion != null ? String(pc.max_price.completion) : "",
    };
}

function formToProviderConfig(form: ModelFormState): ProviderConfig | null {
    if (form.providerMode === "auto") return null;
    const config: ProviderConfig = {};
    if (form.providerMode === "throughput") config.sort = "throughput";
    else if (form.providerMode === "price") config.sort = "price";
    else if (form.providerMode === "latency") config.sort = "latency";

    const orderArr = parseCSV(form.providerOrder);
    if (orderArr.length > 0) config.order = orderArr;
    if (!form.providerAllowFallbacks) config.allow_fallbacks = false;
    const ignoreArr = parseCSV(form.providerIgnore);
    if (ignoreArr.length > 0) config.ignore = ignoreArr;
    const onlyArr = parseCSV(form.providerOnly);
    if (onlyArr.length > 0) config.only = onlyArr;
    if (form.providerQuantizations.length > 0) config.quantizations = form.providerQuantizations;
    if (form.providerRequireParameters) config.require_parameters = true;
    if (form.providerDataCollection === "deny") config.data_collection = "deny";
    if (form.providerMinThroughput) config.preferred_min_throughput = parseFloat(form.providerMinThroughput);
    if (form.providerMaxLatency) config.preferred_max_latency = parseFloat(form.providerMaxLatency);
    const pp = form.providerMaxPricePrompt ? parseFloat(form.providerMaxPricePrompt) : null;
    const cp = form.providerMaxPriceCompletion ? parseFloat(form.providerMaxPriceCompletion) : null;
    if (pp != null || cp != null) {
        config.max_price = {};
        if (pp != null) config.max_price.prompt = pp;
        if (cp != null) config.max_price.completion = cp;
    }
    if (Object.keys(config).length === 0) return null;
    return config;
}

function modelToForm(model: AiModel): ModelFormState {
    const providerParts = providerConfigToForm(model.provider_config);
    return {
        ...EMPTY_FORM,
        openrouter_id: model.openrouter_id,
        display_name: model.display_name,
        pricing_input: model.pricing_input != null ? String(model.pricing_input) : "",
        pricing_output: model.pricing_output != null ? String(model.pricing_output) : "",
        provider_hint: model.provider_hint?.join(", ") || "",
        tier: model.tier || "default",
        supports_tools: model.supports_tools,
        supports_reasoning: model.supports_reasoning,
        context_window: model.context_window != null ? String(model.context_window) : "",
        max_output_tokens: model.max_output_tokens != null ? String(model.max_output_tokens) : "",
        description: model.description || "",
        sort_order: String(model.sort_order || 0),
        maxIterations: String(model.max_iterations ?? 5),
        llmTimeoutMs: String(model.llm_timeout_ms ?? 15000),
        ...providerParts,
    };
}

/* ─────────────────── Component ────────────────────────────── */

export default function ModelRegistryPanel() {
    const [activeTab, setActiveTab] = useState<ModelTab>("registry");
    const [models, setModels] = useState<AiModel[]>([]);
    const [tiers, setTiers] = useState<ModelTier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingModel, setEditingModel] = useState<AiModel | null>(null);
    const [form, setForm] = useState<ModelFormState>(EMPTY_FORM);
    const [showProviderConfig, setShowProviderConfig] = useState(false);
    const [showMetadata, setShowMetadata] = useState(false);
    const [filterTier, setFilterTier] = useState<string>("all");

    const loadModels = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [modelsRes, tiersRes] = await Promise.all([
                fetch("/api/admin/models", { cache: "no-store" }),
                fetch("/api/admin/model-tiers", { cache: "no-store" }),
            ]);
            const modelsData = await modelsRes.json();
            const tiersData = await tiersRes.json();
            if (!modelsRes.ok) throw new Error(modelsData?.error || "Modeller yüklenemedi");
            setModels(modelsData);
            if (tiersRes.ok && Array.isArray(tiersData)) setTiers(tiersData);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadModels(); }, [loadModels]);

    const openNewModal = () => {
        setEditingModel(null);
        setForm(EMPTY_FORM);
        setShowProviderConfig(false);
        setShowMetadata(false);
        setShowModal(true);
    };

    const openEditModal = (model: AiModel) => {
        setEditingModel(model);
        setForm(modelToForm(model));
        setShowProviderConfig(!!model.provider_config);
        setShowMetadata(!!(model.context_window || model.max_output_tokens || model.description));
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.openrouter_id.trim() || !form.display_name.trim()) return;
        setSaving(true);
        setError(null);
        try {
            const providerHintArray = parseCSV(form.provider_hint);
            const providerConfig = formToProviderConfig(form);
            const payload: Record<string, unknown> = {
                openrouter_id: form.openrouter_id.trim(),
                display_name: form.display_name.trim(),
                pricing_input: form.pricing_input ? parseFloat(form.pricing_input) : null,
                pricing_output: form.pricing_output ? parseFloat(form.pricing_output) : null,
                provider_hint: providerHintArray.length > 0 ? providerHintArray : null,
                provider_config: providerConfig,
                tier: form.tier || "default",
                supports_tools: form.supports_tools,
                supports_reasoning: form.supports_reasoning,
                context_window: form.context_window ? parseInt(form.context_window) : null,
                max_output_tokens: form.max_output_tokens ? parseInt(form.max_output_tokens) : null,
                description: form.description.trim() || null,
                sort_order: parseInt(form.sort_order) || 0,
                max_iterations: Math.min(10, Math.max(1, parseInt(form.maxIterations) || 5)),
                llm_timeout_ms: Math.min(30000, Math.max(3000, parseInt(form.llmTimeoutMs) || 15000)),
            };
            const isEdit = !!editingModel;
            if (isEdit) payload.id = editingModel!.id;

            const res = await fetch("/api/admin/models", {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || (isEdit ? "Model güncellenemedi" : "Model eklenemedi"));
            }
            setShowModal(false);
            setEditingModel(null);
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
                const p = await res.json().catch(() => ({}));
                throw new Error(p.error || "Durum güncellenemedi");
            }
            setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, is_enabled: !m.is_enabled } : m)));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata");
        }
    };

    const handleDelete = async (model: AiModel) => {
        if (!confirm(`"${model.display_name}" modelini silmek istediğinize emin misiniz?`)) return;
        try {
            const res = await fetch(`/api/admin/models?id=${model.id}`, { method: "DELETE" });
            if (!res.ok) {
                const p = await res.json().catch(() => ({}));
                throw new Error(p.error || "Model silinemedi");
            }
            setModels((prev) => prev.filter((m) => m.id !== model.id));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Beklenmeyen hata");
        }
    };

    const updateForm = (patch: Partial<ModelFormState>) => setForm((prev) => ({ ...prev, ...patch }));

    const filteredModels = filterTier === "all" ? models : models.filter((m) => m.tier === filterTier);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-6 h-6 border-2 border-t-transparent border-[var(--color-brand)] rounded-full animate-spin" />
                <span className="text-[12px] text-[var(--color-text-muted)]">Modeller yükleniyor...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Tab Header */}
            <div className="flex items-center gap-1 border-b border-[var(--color-border)] pb-0">
                <button
                    onClick={() => setActiveTab("registry")}
                    className={`px-5 py-3 text-[14px] font-semibold border-b-2 transition-colors ${
                        activeTab === "registry"
                            ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                            : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    }`}
                >
                    Model Registry
                </button>
                <button
                    onClick={() => setActiveTab("tiers")}
                    className={`px-5 py-3 text-[14px] font-semibold border-b-2 transition-colors ${
                        activeTab === "tiers"
                            ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                            : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    }`}
                >
                    Tier Yönetimi
                </button>
            </div>

            {activeTab === "tiers" ? (
                <ModelTiersPanel />
            ) : (
            <div className="space-y-4">
            {error && (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-800 text-[12px] text-red-400">{error}</div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <p className="text-[12px] text-[var(--color-text-muted)]">
                        {filteredModels.length} model — {filteredModels.filter((m) => m.is_enabled).length} aktif
                    </p>
                    {tiers.length > 0 && (
                        <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className="form-input text-[11px] py-1 px-2 w-auto">
                            <option value="all">Tüm Tier&apos;lar</option>
                            {tiers.map((t) => <option key={t.name} value={t.name}>{t.display_name}</option>)}
                        </select>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadModels} className="btn-ghost p-1.5" title="Yenile"><RefreshCw size={14} /></button>
                    <button onClick={openNewModal} className="btn-secondary px-3 py-1.5 text-[11px]"><Plus size={13} /> Yeni Model</button>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                <table className="w-full text-[13px]">
                    <thead>
                        <tr className="bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                            <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider">Model</th>
                            <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider">Tier</th>
                            <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider">Provider</th>
                            <th className="text-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider">Fiyat</th>
                            <th className="text-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider">Özellikler</th>
                            <th className="text-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider">Durum</th>
                            <th className="text-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider w-[80px]">İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredModels.map((model) => (
                            <tr key={model.id} className={`border-t border-[var(--color-border)] transition-colors cursor-pointer ${model.is_enabled ? "hover:bg-[var(--color-surface-hover)]" : "opacity-50 bg-[var(--color-surface-elevated)]"}`} onClick={() => openEditModal(model)}>
                                <td className="px-4 py-3">
                                    <div className="font-medium text-[var(--color-text-primary)] text-[13px]">{model.display_name}</div>
                                    <div className="font-mono text-[11px] text-[var(--color-text-muted)] mt-0.5">{model.openrouter_id}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${model.tier === "premium" ? "bg-amber-900/30 text-amber-400 border border-amber-800" : model.tier === "enterprise" ? "bg-purple-900/30 text-purple-400 border border-purple-800" : "bg-[var(--color-surface-active)] text-[var(--color-text-muted)] border border-[var(--color-border)]"}`}>
                                        {model.tier}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    {model.provider_config ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-brand-dim)]">
                                            <Settings2 size={10} />
                                            {typeof model.provider_config.sort === "string" ? model.provider_config.sort : model.provider_config.order?.join(", ") || "özel"}
                                        </span>
                                    ) : model.provider_hint?.length ? (
                                        <span className="font-mono text-[11px] text-[var(--color-text-muted)]">{model.provider_hint.join(", ")}</span>
                                    ) : (
                                        <span className="text-[11px] text-[var(--color-text-muted)]">otomatik</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-center font-mono text-[11px] text-[var(--color-text-muted)]">
                                    {model.pricing_input != null && model.pricing_output != null ? `${model.pricing_input}↑ ${model.pricing_output}↓` : "—"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        {model.supports_tools && <span title="Tool desteği" className="text-blue-400"><Wrench size={12} /></span>}
                                        {model.supports_reasoning && <span title="Düşünme modu" className="text-purple-400"><Brain size={12} /></span>}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => handleToggle(model)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${model.is_enabled ? "bg-emerald-900/30 text-emerald-400 border border-emerald-800 hover:bg-emerald-900/50" : "bg-[var(--color-surface-active)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"}`}>
                                        {model.is_enabled ? <Power size={11} /> : <PowerOff size={11} />}
                                        {model.is_enabled ? "Aktif" : "Pasif"}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-1">
                                        <button onClick={() => openEditModal(model)} className="btn-ghost p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-brand)]" title="Düzenle"><Pencil size={13} /></button>
                                        <button onClick={() => handleDelete(model)} className="btn-ghost p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20" title="Sil"><Trash2 size={13} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredModels.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-muted)] text-[13px]">{filterTier !== "all" ? `"${filterTier}" tier'ında model yok.` : "Henüz model eklenmemiş."}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ───── Add / Edit Modal ───── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                            <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{editingModel ? "Model Düzenle" : "Yeni Model Ekle"}</h3>
                            <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5"><X size={16} /></button>
                        </div>

                        <div className="px-6 py-5 space-y-5">
                            {/* Basic */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">OpenRouter ID *</label>
                                    <input type="text" placeholder="google/gemini-2.5-pro" value={form.openrouter_id} onChange={(e) => updateForm({ openrouter_id: e.target.value })} className="form-input text-[13px] font-mono w-full" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Görünen Ad *</label>
                                    <input type="text" placeholder="Gemini 2.5 Pro" value={form.display_name} onChange={(e) => updateForm({ display_name: e.target.value })} className="form-input text-[13px] w-full" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Tier</label>
                                    <select value={form.tier} onChange={(e) => updateForm({ tier: e.target.value })} className="form-input text-[13px] w-full">
                                        {tiers.length > 0 ? tiers.map((t) => <option key={t.name} value={t.name}>{t.display_name}</option>) : (
                                            <><option value="default">Standart</option><option value="premium">Premium</option><option value="enterprise">Enterprise</option></>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Sıralama</label>
                                    <input type="number" value={form.sort_order} onChange={(e) => updateForm({ sort_order: e.target.value })} className="form-input text-[13px] font-mono w-full" />
                                </div>
                            </div>

                            {/* Pricing */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Fiyat Input ($/1M token)</label>
                                    <input type="number" step="0.01" value={form.pricing_input} onChange={(e) => updateForm({ pricing_input: e.target.value })} className="form-input text-[13px] font-mono w-full" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Fiyat Output ($/1M token)</label>
                                    <input type="number" step="0.01" value={form.pricing_output} onChange={(e) => updateForm({ pricing_output: e.target.value })} className="form-input text-[13px] font-mono w-full" />
                                </div>
                            </div>

                            {/* Feature toggles */}
                            <div className="flex items-center gap-5">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={form.supports_tools} onChange={(e) => updateForm({ supports_tools: e.target.checked })} className="rounded border-[var(--color-border)]" />
                                    <Wrench size={13} className="text-blue-400" />
                                    <span className="text-[12px] text-[var(--color-text-secondary)]">Tool desteği</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={form.supports_reasoning} onChange={(e) => updateForm({ supports_reasoning: e.target.checked })} className="rounded border-[var(--color-border)]" />
                                    <Brain size={13} className="text-purple-400" />
                                    <span className="text-[12px] text-[var(--color-text-secondary)]">Düşünme modu</span>
                                </label>
                            </div>

                            {/* ── Runtime Settings ── */}
                            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Max Tool İterasyon <span className="normal-case font-normal">(1–10)</span></label>
                                    <input type="number" min={1} max={10} value={form.maxIterations} onChange={(e) => updateForm({ maxIterations: e.target.value })} className="form-input text-[13px] font-mono w-full" />
                                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Tek yanıtta kaç tool çağrısı yapılabilir</p>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">LLM Zaman Aşımı <span className="normal-case font-normal">(ms)</span></label>
                                    <input type="number" min={3000} max={30000} step={1000} value={form.llmTimeoutMs} onChange={(e) => updateForm({ llmTimeoutMs: e.target.value })} className="form-input text-[13px] font-mono w-full" />
                                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Bu modeli kullanan tüm işletmeler için geçerlidir</p>
                                </div>
                            </div>

                            {/* ── Provider Config ── */}
                            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
                                <button onClick={() => setShowProviderConfig(!showProviderConfig)} className="w-full flex items-center justify-between px-4 py-3 bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-active)] transition-colors">
                                    <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-primary)]">
                                        <Settings2 size={14} className="text-[var(--color-brand-dim)]" /> Provider Yönlendirme
                                    </span>
                                    {showProviderConfig ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                {showProviderConfig && (
                                    <div className="px-4 py-4 space-y-4 bg-[var(--color-bg-base)]">
                                        {/* Mode selection */}
                                        <div>
                                            <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Yönlendirme Modu</label>
                                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                                {([
                                                    { key: "auto" as ProviderMode, label: "Otomatik", icon: <Zap size={13} /> },
                                                    { key: "throughput" as ProviderMode, label: "Hız", icon: <Gauge size={13} /> },
                                                    { key: "price" as ProviderMode, label: "Ucuz", icon: <DollarSign size={13} /> },
                                                    { key: "latency" as ProviderMode, label: "Gecikme", icon: <Zap size={13} /> },
                                                    { key: "custom" as ProviderMode, label: "Özel", icon: <Settings2 size={13} /> },
                                                ] as const).map((opt) => (
                                                    <button key={opt.key} onClick={() => updateForm({ providerMode: opt.key })} className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-center transition-colors ${form.providerMode === opt.key ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]" : "border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]"}`}>
                                                        {opt.icon}
                                                        <span className="text-[11px] font-semibold">{opt.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Provider order + fallback */}
                                        <div>
                                            <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Provider Sıralaması (order)</label>
                                            <input type="text" placeholder="deepinfra, groq, together, fireworks" value={form.providerOrder || form.provider_hint} onChange={(e) => updateForm({ providerOrder: e.target.value, provider_hint: e.target.value })} className="form-input text-[12px] font-mono w-full" />
                                            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Virgülle ayrılmış provider slug&apos;ları.</p>
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={form.providerAllowFallbacks} onChange={(e) => updateForm({ providerAllowFallbacks: e.target.checked })} className="rounded border-[var(--color-border)]" />
                                            <span className="text-[12px] text-[var(--color-text-secondary)]">Fallback izin ver</span>
                                        </label>

                                        {/* Custom mode advanced fields */}
                                        {form.providerMode === "custom" && (
                                            <div className="space-y-3 pt-2 border-t border-[var(--color-border)]">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Sadece bunlar (only)</label>
                                                        <input type="text" placeholder="azure, anthropic" value={form.providerOnly} onChange={(e) => updateForm({ providerOnly: e.target.value })} className="form-input text-[12px] font-mono w-full" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Bunları atla (ignore)</label>
                                                        <input type="text" placeholder="deepinfra" value={form.providerIgnore} onChange={(e) => updateForm({ providerIgnore: e.target.value })} className="form-input text-[12px] font-mono w-full" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Kuantizasyon Filtresi</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {QUANTIZATION_OPTIONS.map((q) => (
                                                            <button key={q} onClick={() => { const next = form.providerQuantizations.includes(q) ? form.providerQuantizations.filter((x) => x !== q) : [...form.providerQuantizations, q]; updateForm({ providerQuantizations: next }); }} className={`px-2 py-1 rounded-md text-[11px] font-mono border transition-colors ${form.providerQuantizations.includes(q) ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"}`}>
                                                                {q}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Min Throughput (token/s)</label>
                                                        <input type="number" placeholder="50" value={form.providerMinThroughput} onChange={(e) => updateForm({ providerMinThroughput: e.target.value })} className="form-input text-[12px] font-mono w-full" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Max Latency (saniye)</label>
                                                        <input type="number" step="0.1" placeholder="3" value={form.providerMaxLatency} onChange={(e) => updateForm({ providerMaxLatency: e.target.value })} className="form-input text-[12px] font-mono w-full" />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Max Fiyat Prompt ($/1M)</label>
                                                        <input type="number" step="0.1" value={form.providerMaxPricePrompt} onChange={(e) => updateForm({ providerMaxPricePrompt: e.target.value })} className="form-input text-[12px] font-mono w-full" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Max Fiyat Completion ($/1M)</label>
                                                        <input type="number" step="0.1" value={form.providerMaxPriceCompletion} onChange={(e) => updateForm({ providerMaxPriceCompletion: e.target.value })} className="form-input text-[12px] font-mono w-full" />
                                                    </div>
                                                </div>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={form.providerRequireParameters} onChange={(e) => updateForm({ providerRequireParameters: e.target.checked })} className="rounded border-[var(--color-border)]" />
                                                    <span className="text-[12px] text-[var(--color-text-secondary)]">Tüm parametreleri destekleyen provider şart</span>
                                                </label>
                                                <div>
                                                    <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Veri Toplama Politikası</label>
                                                    <div className="flex items-center gap-4">
                                                        <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="dataCollection" checked={form.providerDataCollection === "allow"} onChange={() => updateForm({ providerDataCollection: "allow" })} /><span className="text-[12px] text-[var(--color-text-secondary)]">İzin ver</span></label>
                                                        <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="dataCollection" checked={form.providerDataCollection === "deny"} onChange={() => updateForm({ providerDataCollection: "deny" })} /><span className="text-[12px] text-[var(--color-text-secondary)]">Reddet</span></label>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── Metadata ── */}
                            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
                                <button onClick={() => setShowMetadata(!showMetadata)} className="w-full flex items-center justify-between px-4 py-3 bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-active)] transition-colors">
                                    <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">Model Detayları</span>
                                    {showMetadata ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                {showMetadata && (
                                    <div className="px-4 py-4 space-y-3 bg-[var(--color-bg-base)]">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Context Window</label>
                                                <input type="number" placeholder="128000" value={form.context_window} onChange={(e) => updateForm({ context_window: e.target.value })} className="form-input text-[12px] font-mono w-full" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Max Output Token</label>
                                                <input type="number" placeholder="8192" value={form.max_output_tokens} onChange={(e) => updateForm({ max_output_tokens: e.target.value })} className="form-input text-[12px] font-mono w-full" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Açıklama / Admin Notları</label>
                                            <textarea rows={3} placeholder="Bu model hakkında notlar..." value={form.description} onChange={(e) => updateForm({ description: e.target.value })} className="form-input text-[12px] w-full resize-y" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)]">
                            <button onClick={() => setShowModal(false)} className="btn-ghost px-4 py-2 text-[12px]">İptal</button>
                            <button onClick={handleSave} disabled={saving || !form.openrouter_id.trim() || !form.display_name.trim()} className="btn-primary px-5 py-2 text-[12px] disabled:opacity-50">
                                {saving ? <><RefreshCw size={12} className="animate-spin" /> {editingModel ? "Güncelleniyor..." : "Ekleniyor..."}</> : <>{editingModel ? <Pencil size={12} /> : <Plus size={12} />} {editingModel ? "Güncelle" : "Ekle"}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
            )}
        </div>
    );
}
