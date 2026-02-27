"use client";

import { useState } from "react";
import ChatLayout from "../components/ChatLayout";
import GlobalAiSettingsPanel from "./components/GlobalAiSettingsPanel";
import ModelTestPanel from "./components/ModelTestPanel";
import TenantSystemPromptPanel from "./components/TenantSystemPromptPanel";
import { Settings, Shield, Activity, Terminal, ExternalLink } from "lucide-react";

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
    const [activeTab, setActiveTab] = useState<"chat" | "settings">("chat");

    const selectedTenant = tenants.find((t) => t.id === selectedTenantId);

    return (
        <div className="flex h-screen w-full bg-[#111111] overflow-hidden">
            {/* ── Admin Navigation Sidebar ── */}
            <aside className="w-20 md:w-64 flex flex-col items-center md:items-stretch py-8 border-r border-white/5 bg-[#0A0A0A]">
                <div className="px-6 mb-12 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[var(--color-brand)] flex items-center justify-center shadow-lg shadow-[var(--color-brand-glow)] flex-shrink-0">
                        <Shield size={20} className="text-[#111111]" />
                    </div>
                    <div className="hidden md:block">
                        <h1 className="text-lg font-bold text-white tracking-tight">Admin <span className="text-[var(--color-brand)]">Hub</span></h1>
                        <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest mt-0.5">Müsait Core v2.4</p>
                    </div>
                </div>

                <nav className="flex-1 px-3 space-y-2">
                    <button
                        onClick={() => setActiveTab("chat")}
                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${
                            activeTab === "chat" 
                            ? "bg-white/10 text-white shadow-xl" 
                            : "text-[#555] hover:text-[#888] hover:bg-white/[0.03]"
                        }`}
                    >
                        <Activity size={20} />
                        <span className="hidden md:block font-bold text-sm tracking-tight">Canlı Takip</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("settings")}
                        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all ${
                            activeTab === "settings" 
                            ? "bg-white/10 text-white shadow-xl" 
                            : "text-[#555] hover:text-[#888] hover:bg-white/[0.03]"
                        }`}
                    >
                        <Settings size={20} />
                        <span className="hidden md:block font-bold text-sm tracking-tight">Sistem Ayarları</span>
                    </button>
                </nav>

                <div className="px-6 mt-auto">
                    <div className="p-4 rounded-[24px] bg-white/[0.02] border border-white/5 space-y-3">
                        <div className="flex items-center gap-2">
                            <Terminal size={14} className="text-[var(--color-brand)]" />
                            <span className="text-[10px] font-black uppercase text-[#444] tracking-widest">Geliştirici</span>
                        </div>
                        <button
                            onClick={() => setDebugMode(!debugMode)}
                            className={`w-full py-2 rounded-xl text-[10px] font-bold uppercase tracking-tight border transition-all ${
                                debugMode 
                                ? 'bg-[var(--color-brand-light)] border-[var(--color-brand-glow-strong)] text-[var(--color-brand-dim)]' 
                                : 'bg-transparent border-white/5 text-[#444] hover:border-white/10'
                            }`}
                        >
                            Debug {debugMode ? 'Açık' : 'Kapalı'}
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Main Content Area ── */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#F5F5F5] rounded-l-[40px] shadow-[-20px_0_60px_rgba(0,0,0,0.5)] z-10 overflow-hidden relative border-l border-white/5">
                
                {activeTab === "chat" ? (
                    <div className="h-full flex flex-col">
                        <header className="h-20 flex-shrink-0 flex items-center justify-between px-10 border-b border-black/[0.03] bg-white">
                            <div>
                                <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">Komuta Merkezi</h2>
                                <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-1 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-ai)] animate-pulse" />
                                    Tüm işletmelerden gelen canlı akış
                                </p>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-end">
                                    <span className="text-[12px] font-bold text-[var(--color-text-primary)]">{userEmail}</span>
                                    <span className="text-[10px] font-bold text-[var(--color-brand-dim)] uppercase tracking-tight">Master Admin</span>
                                </div>
                                <div className="w-10 h-10 rounded-2xl bg-black/[0.02] border border-black/[0.05] flex items-center justify-center">
                                    <ExternalLink size={18} className="text-[var(--color-text-muted)]" />
                                </div>
                            </div>
                        </header>

                        <div className="flex-1 relative">
                            <ChatLayout
                                tenantId={selectedTenantId}
                                tenantName={selectedTenant?.name ?? "Tüm İşletmeler"}
                                tenantLogo={selectedTenant?.logo_url ?? null}
                                userEmail={userEmail}
                                isAdmin={true}
                                allTenants={tenants}
                                onTenantChange={setSelectedTenantId}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto px-10 py-10 space-y-12">
                        <div className="max-w-5xl mx-auto space-y-12">
                            <section>
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 rounded-2xl bg-white shadow-xl flex items-center justify-center text-[var(--color-text-primary)] border border-black/[0.03]">
                                        <Settings size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Sistem Ayarları</h2>
                                        <p className="text-sm font-medium text-[var(--color-text-muted)] mt-1">Global AI ve altyapı konfigürasyonu</p>
                                    </div>
                                </div>
                                <GlobalAiSettingsPanel />
                            </section>

                            <section>
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 rounded-2xl bg-white shadow-xl flex items-center justify-center text-[var(--color-text-primary)] border border-black/[0.03]">
                                        <Shield size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Tenant Prompt</h2>
                                        <p className="text-sm font-medium text-[var(--color-text-muted)] mt-1">İşletme bazlı sistem prompt override</p>
                                    </div>
                                </div>
                                <TenantSystemPromptPanel tenants={tenants} />
                            </section>

                            <section className="pb-24">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 rounded-2xl bg-white shadow-xl flex items-center justify-center text-[var(--color-text-primary)] border border-black/[0.03]">
                                        <Terminal size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Model Test Laboratuvarı</h2>
                                        <p className="text-sm font-medium text-[var(--color-text-muted)] mt-1">Yeni prompt ve model versiyonlarını simüle edin</p>
                                    </div>
                                </div>
                                <ModelTestPanel debugMode={debugMode} />
                            </section>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
