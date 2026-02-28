"use client";

import { useState } from "react";
import ChatLayout from "../components/ChatLayout";
import GlobalAiSettingsPanel from "./components/GlobalAiSettingsPanel";
import ModelTestPanel from "./components/ModelTestPanel";
import TenantSystemPromptPanel from "./components/TenantSystemPromptPanel";
import ModelRegistryPanel from "./components/ModelRegistryPanel";
import AdminTenantSettingsModal from "./components/AdminTenantSettingsModal";
import { Shield, Activity, Terminal, Network, Globe, LogOut, SlidersHorizontal, Cpu, MessageSquare, Boxes } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Tenant {
    id: string;
    name: string;
    logo_url: string | null;
}

type AdminSection = "chat" | "global" | "routing" | "global-prompt" | "tenant-prompt" | "models" | "test-lab";

export default function AdminDashboard({
    userEmail,
    tenants,
}: {
    userEmail: string;
    tenants: Tenant[];
}) {
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<AdminSection>("chat");
    const [showTenantSettings, setShowTenantSettings] = useState(false);
    const router = useRouter();

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    };

    const navItems: { key: AdminSection; label: string; icon: React.ReactNode; description: string; isGroup?: boolean }[] = [
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
            key: "global-prompt",
            label: "Global Prompt",
            icon: <Shield size={18} />,
            description: "Genel sistem AI yönergeleri",
            isGroup: true,
        },
        {
            key: "tenant-prompt",
            label: "Tenant Prompt",
            icon: <MessageSquare size={18} />,
            description: "İşletme bazlı AI ayarları",
            isGroup: true,
        },
        {
            key: "models",
            label: "Modeller",
            icon: <Cpu size={18} />,
            description: "AI model kayıt defteri",
            isGroup: true,
        },
        {
            key: "test-lab",
            label: "Test Lab",
            icon: <Terminal size={18} />,
            description: "Model test ve doğrulama",
            isGroup: true,
        },
    ];

    return (
        <div className="flex h-screen w-full bg-[var(--color-bg-base)] overflow-hidden">

            {/* ── Admin Navigation Sidebar ── */}
            <aside className="w-[240px] flex-shrink-0 flex flex-col bg-[var(--color-sidebar-bg)] border-r border-[var(--color-sidebar-border)] z-20">

                {/* Brand */}
                <div className="px-5 py-5 border-b border-[var(--color-sidebar-border)] flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--color-brand)] flex items-center justify-center flex-shrink-0">
                        <Shield size={18} className="text-black" />
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
                    {navItems.map((item, index) => (
                        <div key={item.key}>
                            {/* Divider before settings group */}
                            {item.isGroup && index === navItems.findIndex(i => i.isGroup) && (
                                <div className="px-3 py-2 mt-2">
                                    <div className="h-px bg-[var(--color-sidebar-border)]" />
                                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mt-3 mb-1">
                                        Sistem Ayarları
                                    </p>
                                </div>
                            )}
                            <button
                                onClick={() => setActiveSection(item.key)}
                                className={`nav-item text-left w-full ${activeSection === item.key ? "active" : ""}`}
                            >
                                <span className="flex-shrink-0">{item.icon}</span>
                                <span className="text-[13px] font-medium leading-tight">{item.label}</span>
                            </button>
                        </div>
                    ))}
                </nav>

                {/* User Info + Logout */}
                <div className="p-3 border-t border-[var(--color-sidebar-border)]">
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

                {(activeSection === "chat" || activeSection === "global" || activeSection === "routing") ? (
                    <div className="h-full flex flex-col">
                        {/* Slim tab header */}
                        <div className="h-[52px] flex-shrink-0 flex items-center px-5 bg-[var(--color-surface-elevated)] border-b border-[var(--color-border)] gap-4">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-none">
                                    {activeSection === "routing"
                                        ? "Yönlendirme Merkezi"
                                        : activeSection === "global"
                                        ? "Tüm Sohbetler"
                                        : "Komuta Merkezi"}
                                </h2>
                                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1.5">
                                    <span
                                        className={`inline-block w-1.5 h-1.5 rounded-full ${
                                            activeSection === "routing"
                                                ? "bg-[var(--color-status-attention)] animate-pulse"
                                                : "bg-[var(--color-brand)] animate-pulse"
                                        }`}
                                    />
                                    {activeSection === "routing"
                                        ? "İşletmeye atanmamış sohbetler"
                                        : activeSection === "global"
                                        ? "Tüm müşteriler — bağlı ve bağlısız"
                                        : "Tüm işletmelerden canlı akış"}
                                </p>
                            </div>

                            {/* Gear icon: visible when a specific tenant is selected */}
                            {activeSection === "chat" && selectedTenantId && (
                                <button
                                    onClick={() => setShowTenantSettings(true)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-active)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all text-[12px] font-semibold"
                                    title="İşletme AI Ayarları"
                                >
                                    <SlidersHorizontal size={15} />
                                    <span className="hidden sm:inline">AI Ayarları</span>
                                </button>
                            )}
                        </div>

                        <div className="flex-1 relative overflow-hidden">
                            <ChatLayout
                                tenantId={
                                    activeSection === "routing"
                                        ? "LIMBO"
                                        : activeSection === "global"
                                        ? null
                                        : selectedTenantId
                                }
                                tenantName={
                                    activeSection === "routing"
                                        ? "Yönlendirme Bekleyenler"
                                        : activeSection === "global"
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
                                isRoutingMode={activeSection === "routing"}
                                hideListHeader={true}
                            />
                        </div>
                    </div>

                ) : (
                    /* ── Settings Sections — direct content ── */
                    <div className="h-full flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto">
                            {activeSection === "global-prompt" && (
                                <div className="max-w-3xl mx-auto px-6 md:px-10 py-8">
                                    <GlobalAiSettingsPanel />
                                </div>
                            )}
                            {activeSection === "tenant-prompt" && (
                                <div className="max-w-3xl mx-auto px-6 md:px-10 py-8">
                                    <TenantSystemPromptPanel tenants={tenants} />
                                </div>
                            )}
                            {activeSection === "models" && (
                                <div className="max-w-4xl mx-auto px-6 md:px-10 py-8">
                                    <ModelRegistryPanel />
                                </div>
                            )}
                            {activeSection === "test-lab" && (
                                <div className="h-full p-4">
                                    <ModelTestPanel debugMode={false} />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* ── Admin Tenant Settings Modal ── */}
            {showTenantSettings && selectedTenantId && (
                <AdminTenantSettingsModal
                    tenantId={selectedTenantId}
                    tenantName={tenants.find((t) => t.id === selectedTenantId)?.name ?? selectedTenantId}
                    onClose={() => setShowTenantSettings(false)}
                />
            )}
        </div>
    );
}
