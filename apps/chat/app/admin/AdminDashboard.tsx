"use client";

import { useState } from "react";
import ChatLayout from "../components/ChatLayout";
import GlobalAiSettingsPanel from "./components/GlobalAiSettingsPanel";
import ModelTestPanel from "./components/ModelTestPanel";
import TenantSystemPromptPanel from "./components/TenantSystemPromptPanel";
import { Settings, Shield, Activity, Terminal, Network, Globe, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Tenant {
    id: string;
    name: string;
    logo_url: string | null;
}

type AdminTab = "chat" | "global" | "routing" | "settings";

export default function AdminDashboard({
    userEmail,
    tenants,
}: {
    userEmail: string;
    tenants: Tenant[];
}) {
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<AdminTab>("chat");
    const router = useRouter();

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    };

    const navItems: { key: AdminTab; label: string; icon: React.ReactNode; description: string }[] = [
        {
            key: "chat",
            label: "Canlı Takip",
            icon: <Activity size={18} />,
            description: "İşletme bazlı canlı sohbet izleme",
        },
        {
            key: "global",
            label: "Tüm Sohbetler",
            icon: <Globe size={18} />,
            description: "Tüm müşteriler (bağlı + bağlısız)",
        },
        {
            key: "routing",
            label: "Yönlendirme",
            icon: <Network size={18} />,
            description: "İşletmeye atanmayan sohbetler",
        },
        {
            key: "settings",
            label: "Sistem Ayarları",
            icon: <Settings size={18} />,
            description: "AI ve altyapı konfigürasyonu",
        },
    ];

    return (
        <div className="flex h-screen w-full bg-[var(--color-bg-base)] overflow-hidden">

            {/* ── Admin Navigation Sidebar ── */}
            <aside className="w-[240px] flex-shrink-0 flex flex-col bg-[var(--color-surface-pure)] border-r border-[var(--color-border)] z-20">

                {/* Brand */}
                <div className="px-5 py-5 border-b border-[var(--color-border)] flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--color-text-primary)] flex items-center justify-center flex-shrink-0">
                        <Shield size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-[15px] font-bold text-[var(--color-text-primary)] leading-none tracking-tight">
                            Admin <span className="text-[var(--color-brand-dim)]">Hub</span>
                        </h1>
                        <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
                            Müsait Core v2.4
                        </p>
                    </div>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <button
                            key={item.key}
                            onClick={() => setActiveTab(item.key)}
                            className={`nav-item text-left w-full ${activeTab === item.key ? "active" : ""}`}
                        >
                            <span className="flex-shrink-0">{item.icon}</span>
                            <span className="text-[13px] font-medium leading-tight">{item.label}</span>
                        </button>
                    ))}
                </nav>

                {/* User Info + Logout */}
                <div className="p-3 border-t border-[var(--color-border)]">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-text-primary)] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {userEmail?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-[var(--color-text-primary)] truncate">
                                {userEmail?.split("@")[0]}
                            </p>
                            <p className="text-[10px] font-semibold text-[var(--color-brand-dim)] uppercase tracking-wider">
                                Master Admin
                            </p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="btn-ghost p-1.5"
                            title="Çıkış yap"
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Main Content Area ── */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

                {/* ── Chat/Global/Routing Tabs ── */}
                {(activeTab === "chat" || activeTab === "global" || activeTab === "routing") ? (
                    <div className="h-full flex flex-col">
                        {/* Slim tab header */}
                        <div className="h-[52px] flex-shrink-0 flex items-center px-5 bg-[var(--color-surface-pure)] border-b border-[var(--color-border)] gap-4">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-none">
                                    {activeTab === "routing"
                                        ? "Yönlendirme Merkezi"
                                        : activeTab === "global"
                                        ? "Tüm Sohbetler"
                                        : "Komuta Merkezi"}
                                </h2>
                                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1.5">
                                    <span
                                        className={`inline-block w-1.5 h-1.5 rounded-full ${
                                            activeTab === "routing"
                                                ? "bg-[var(--color-status-attention)] animate-pulse"
                                                : "bg-[var(--color-brand)] animate-pulse"
                                        }`}
                                    />
                                    {activeTab === "routing"
                                        ? "İşletmeye atanmamış sohbetler"
                                        : activeTab === "global"
                                        ? "Tüm müşteriler — bağlı ve bağlısız"
                                        : "Tüm işletmelerden canlı akış"}
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 relative overflow-hidden">
                            <ChatLayout
                                tenantId={
                                    activeTab === "routing"
                                        ? "LIMBO"
                                        : activeTab === "global"
                                        ? null
                                        : selectedTenantId
                                }
                                tenantName={
                                    activeTab === "routing"
                                        ? "Yönlendirme Bekleyenler"
                                        : activeTab === "global"
                                        ? "Tüm Müşteriler"
                                        : (tenants.find((t) => t.id === selectedTenantId)?.name ?? "Tüm İşletmeler")
                                }
                                tenantLogo={
                                    tenants.find((t) => t.id === selectedTenantId)?.logo_url ?? null
                                }
                                userEmail={userEmail}
                                isAdmin={true}
                                allTenants={tenants}
                                onTenantChange={setSelectedTenantId}
                                isRoutingMode={activeTab === "routing"}
                                hideListHeader={true}
                            />
                        </div>
                    </div>

                ) : (
                    /* ── Settings Tab ── */
                    <div className="h-full overflow-y-auto px-6 md:px-10 py-8">
                        <div className="max-w-4xl mx-auto space-y-10">

                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-[var(--color-text-primary)] flex items-center justify-center">
                                    <Settings size={18} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-[20px] font-bold text-[var(--color-text-primary)] tracking-tight">
                                        Sistem Ayarları
                                    </h2>
                                    <p className="text-[13px] text-[var(--color-text-muted)]">
                                        Global AI ve altyapı konfigürasyonu
                                    </p>
                                </div>
                            </div>

                            <section className="panel-card p-6">
                                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[var(--color-border)]">
                                    <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center">
                                        <Activity size={16} className="text-[var(--color-brand-dim)]" />
                                    </div>
                                    <div>
                                        <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                                            Global AI Ayarları
                                        </h3>
                                        <p className="text-[12px] text-[var(--color-text-muted)]">
                                            Tüm tenant'lar için varsayılan AI yapılandırması
                                        </p>
                                    </div>
                                </div>
                                <GlobalAiSettingsPanel />
                            </section>

                            <section className="panel-card p-6">
                                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[var(--color-border)]">
                                    <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center">
                                        <Shield size={16} className="text-[var(--color-brand-dim)]" />
                                    </div>
                                    <div>
                                        <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                                            Tenant Sistem Prompt
                                        </h3>
                                        <p className="text-[12px] text-[var(--color-text-muted)]">
                                            İşletme bazlı sistem prompt override
                                        </p>
                                    </div>
                                </div>
                                <TenantSystemPromptPanel tenants={tenants} />
                            </section>

                            <section className="panel-card p-6 mb-10">
                                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[var(--color-border)]">
                                    <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center">
                                        <Terminal size={16} className="text-[var(--color-brand-dim)]" />
                                    </div>
                                    <div>
                                        <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
                                            Model Test Laboratuvarı
                                        </h3>
                                        <p className="text-[12px] text-[var(--color-text-muted)]">
                                            Yeni prompt ve model versiyonlarını simüle edin
                                        </p>
                                    </div>
                                </div>
                                <ModelTestPanel debugMode={false} />
                            </section>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
