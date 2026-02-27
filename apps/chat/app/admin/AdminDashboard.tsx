"use client";

import { useState } from "react";
import ChatLayout from "../components/ChatLayout";
import GlobalAiSettingsPanel from "./components/GlobalAiSettingsPanel";
import ModelTestPanel from "./components/ModelTestPanel";
import TenantSystemPromptPanel from "./components/TenantSystemPromptPanel";
import { Settings, Shield, Activity, Terminal, ExternalLink, Network } from "lucide-react";

interface Tenant {
    id: string;
    name: string;
    logo_url: string | null;
}

export default function AdminDashboard({
    userEmail,
    tenants,
}: {
    userEmail: string;
    tenants: Tenant[];
}) {
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null); // null means "All"
    const [debugMode, setDebugMode] = useState(false);
    const [activeTab, setActiveTab] = useState<"chat" | "routing" | "settings">("chat");

    const selectedTenant = tenants.find((t) => t.id === selectedTenantId);

    return (
        <div className="flex h-screen w-full bg-[var(--color-bg-base)] overflow-hidden">
            {/* ── Admin Navigation Sidebar ── */}
            <aside className="w-20 md:w-[280px] flex flex-col items-center md:items-stretch py-6 border-r border-[var(--color-border)] bg-[var(--color-surface-pure)] z-20 flex-shrink-0 transition-all duration-300">
                <div className="px-4 md:px-6 mb-10 flex items-center justify-center md:justify-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-light)] border border-[var(--color-brand-glow)] flex items-center justify-center flex-shrink-0">
                        <Shield size={20} className="text-[var(--color-brand-dark)]" />
                    </div>
                    <div className="hidden md:block">
                        <h1 className="text-[16px] font-bold text-[var(--color-text-primary)] tracking-tight leading-none">Admin <span className="text-[var(--color-brand-dark)]">Hub</span></h1>
                        <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest mt-1">Müsait Core v2.4</p>
                    </div>
                </div>

                <nav className="flex-1 px-3 space-y-1.5">
                    <button
                        onClick={() => setActiveTab("chat")}
                        className={`w-full flex items-center justify-center md:justify-start gap-3.5 px-3 py-3 rounded-xl transition-all ${activeTab === "chat"
                            ? "bg-[var(--color-surface-hover)] text-[var(--color-brand-dark)] font-semibold shadow-sm border border-[var(--color-border)]"
                            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] font-medium"
                            }`}
                        title="Canlı Takip"
                    >
                        <Activity size={20} />
                        <span className="hidden md:block text-[14px] tracking-tight">Canlı Takip</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("routing")}
                        className={`w-full flex items-center justify-center md:justify-start gap-3.5 px-3 py-3 rounded-xl transition-all ${activeTab === "routing"
                            ? "bg-[var(--color-surface-hover)] text-[var(--color-brand-dark)] font-semibold shadow-sm border border-[var(--color-border)]"
                            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] font-medium"
                            }`}
                        title="Yönlendirme (Limbo)"
                    >
                        <Network size={20} />
                        <span className="hidden md:block text-[14px] tracking-tight">Yönlendirme</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("settings")}
                        className={`w-full flex items-center justify-center md:justify-start gap-3.5 px-3 py-3 rounded-xl transition-all ${activeTab === "settings"
                            ? "bg-[var(--color-surface-hover)] text-[var(--color-brand-dark)] font-semibold shadow-sm border border-[var(--color-border)]"
                            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] font-medium"
                            }`}
                        title="Sistem Ayarları"
                    >
                        <Settings size={20} />
                        <span className="hidden md:block text-[14px] tracking-tight">Sistem Ayarları</span>
                    </button>
                </nav>

                <div className="px-3 md:px-5 mt-auto">
                    <div className="p-3 md:p-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-3">
                        <div className="hidden md:flex flex-col gap-0.5 mb-2">
                            <div className="flex items-center gap-2">
                                <Terminal size={14} className="text-[var(--color-text-secondary)]" />
                                <span className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)] tracking-widest">Geliştirici</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setDebugMode(!debugMode)}
                            className={`w-full py-2.5 rounded-xl text-[11px] font-bold tracking-wide transition-all border ${debugMode
                                ? 'bg-[var(--color-brand-light)] border-[var(--color-brand-glow)] text-[var(--color-brand-dark)] shadow-sm'
                                : 'bg-[var(--color-surface-pure)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)]'
                                }`}
                            title="Debug Modunu Değiştir"
                        >
                            <span className="hidden md:inline">Debug Set: </span>{debugMode ? 'Açık' : 'Kapalı'}
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Main Content Area ── */}
            <main className="flex-1 flex flex-col min-w-0 bg-[var(--color-bg-base)] z-10 overflow-hidden relative">

                {activeTab === "chat" || activeTab === "routing" ? (
                    <div className="h-full flex flex-col relative w-full">
                        {/* We use the ChatLayout directly which manages its own header.
                            We optionally can keep a top-level admin banner or remove it. 
                            Removing the extra header to keep the interface native and clean.
                            The user profile can be moved into the ChatLayout or kept above it.
                            Here we keep a very slim admin top bar. */}
                        <header className="h-[60px] flex-shrink-0 flex items-center justify-between px-6 bg-[var(--color-surface-pure)] border-b border-[var(--color-border)] z-20">
                            <div>
                                <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)] tracking-tight">
                                    {activeTab === "routing" ? "Yönlendirme Merkezi" : "Komuta Merkezi"}
                                </h2>
                                <p className="text-[11px] font-medium text-[var(--color-text-secondary)] flex items-center gap-1.5 mt-0.5">
                                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${activeTab === "routing" ? "bg-[var(--color-status-attention)]" : "bg-[var(--color-brand-dark)]"}`} />
                                    {activeTab === "routing" ? "Atanmayan (Limbo) Sohbetler" : "Tüm işletmelerden gelen canlı akış"}
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-end">
                                    <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{userEmail}</span>
                                    <span className="text-[10px] font-semibold text-[var(--color-brand-dark)] uppercase tracking-wider">Master Admin</span>
                                </div>
                                <div className="w-9 h-9 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors">
                                    <ExternalLink size={16} className="text-[var(--color-text-secondary)]" />
                                </div>
                            </div>
                        </header>

                        <div className="flex-1 relative overflow-hidden">
                            <ChatLayout
                                tenantId={activeTab === "routing" ? "LIMBO" : selectedTenantId}
                                tenantName={activeTab === "routing" ? "Yönlendirme Bekleyenler" : (selectedTenant?.name ?? "Tüm İşletmeler")}
                                tenantLogo={selectedTenant?.logo_url ?? null}
                                userEmail={userEmail}
                                isAdmin={true}
                                allTenants={tenants}
                                onTenantChange={setSelectedTenantId}
                                isRoutingMode={activeTab === "routing"}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto content-scroll px-6 md:px-12 py-10">
                        <div className="max-w-5xl mx-auto space-y-10">
                            <section>
                                <div className="flex items-center gap-3.5 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-brand-dark)] shadow-sm">
                                        <Settings size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-[20px] font-semibold text-[var(--color-text-primary)] tracking-tight">Sistem Ayarları</h2>
                                        <p className="text-[13px] text-[var(--color-text-secondary)] mt-0.5">Global AI ve altyapı konfigürasyonu</p>
                                    </div>
                                </div>
                                <div className="bg-[var(--color-bg-base)] rounded-2xl">
                                    <GlobalAiSettingsPanel />
                                </div>
                            </section>

                            <hr className="border-[var(--color-border)]" />

                            <section>
                                <div className="flex items-center gap-3.5 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-brand-dark)] shadow-sm">
                                        <Shield size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-[20px] font-semibold text-[var(--color-text-primary)] tracking-tight">Tenant Prompt</h2>
                                        <p className="text-[13px] text-[var(--color-text-secondary)] mt-0.5">İşletme bazlı sistem prompt override</p>
                                    </div>
                                </div>
                                <div className="bg-[var(--color-bg-base)] rounded-2xl">
                                    <TenantSystemPromptPanel tenants={tenants} />
                                </div>
                            </section>

                            <hr className="border-[var(--color-border)]" />

                            <section className="pb-20">
                                <div className="flex items-center gap-3.5 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-brand-dark)] shadow-sm">
                                        <Terminal size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-[20px] font-semibold text-[var(--color-text-primary)] tracking-tight">Model Test Laboratuvarı</h2>
                                        <p className="text-[13px] text-[var(--color-text-secondary)] mt-0.5">Yeni prompt ve model versiyonlarını simüle edin</p>
                                    </div>
                                </div>
                                <div className="bg-[var(--color-bg-base)] rounded-2xl">
                                    <ModelTestPanel debugMode={debugMode} />
                                </div>
                            </section>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
