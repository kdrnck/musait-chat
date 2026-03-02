"use client";

import { useState } from "react";
import ChatLayout from "../components/ChatLayout";
import GlobalAiSettingsPanel from "./components/GlobalAiSettingsPanel";
import ModelTestPanel from "./components/ModelTestPanel";
import TenantSystemPromptPanel from "./components/TenantSystemPromptPanel";
import ModelRegistryPanel from "./components/ModelRegistryPanel";
import AdminTenantSettingsModal from "./components/AdminTenantSettingsModal";
import BusinessManagementPanel from "./components/BusinessManagementPanel";
import PromptLibraryPanel from "./components/PromptLibraryPanel";
import { Shield, Activity, Terminal, Network, Globe, LogOut, SlidersHorizontal, Cpu, MessageSquare, Building2, ChevronDown, ChevronRight, FileText, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Tenant {
    id: string;
    name: string;
    logo_url: string | null;
}

type AdminSection = "chat" | "global" | "routing" | "businesses" | "prompt-library" | "global-prompt" | "tenant-prompt" | "models" | "test-lab";

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
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        monitoring: true,
        system: true,
    });
    const router = useRouter();

    const handleLogout = async () => {
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        try {
            const supabase = createClient();
            await supabase.auth.signOut();
            if (typeof window !== 'undefined') {
                sessionStorage.clear();
            }
            router.push("/login");
            router.refresh();
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/login';
        }
    };

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    const navGroups = [
        {
            key: "monitoring",
            label: "Canlı İzleme",
            items: [
                {
                    key: "chat" as AdminSection,
                    label: "Canlı Takip",
                    icon: <Activity size={18} />,
                    description: "İşletme bazlı canlı sohbet izleme",
                    isLive: true,
                },
                {
                    key: "global" as AdminSection,
                    label: "Tüm Sohbetler",
                    icon: <Globe size={18} />,
                    description: "Tüm müşteriler (bağlı + bağlısız)",
                },
                {
                    key: "routing" as AdminSection,
                    label: "Yönlendirme",
                    icon: <Network size={18} />,
                    description: "İşletmeye atanmayan sohbetler",
                    isRouting: true,
                },
            ]
        },
        {
            key: "system",
            label: "Sistem Yönetimi",
            items: [
                {
                    key: "businesses" as AdminSection,
                    label: "İşletmeler",
                    icon: <Building2 size={18} />,
                    description: "İşletme yönetimi ve ayarları",
                },
                {
                    key: "prompt-library" as AdminSection,
                    label: "Prompt Kütüphanesi",
                    icon: <FileText size={18} />,
                    description: "Prompt şablonları yönetimi",
                },
                {
                    key: "global-prompt" as AdminSection,
                    label: "Global Prompt",
                    icon: <Shield size={18} />,
                    description: "Genel sistem AI yönergeleri",
                },
                {
                    key: "tenant-prompt" as AdminSection,
                    label: "Tenant Prompt",
                    icon: <MessageSquare size={18} />,
                    description: "İşletme bazlı AI ayarları",
                },
                {
                    key: "models" as AdminSection,
                    label: "Modeller",
                    icon: <Cpu size={18} />,
                    description: "AI model kayıt defteri",
                },
                {
                    key: "test-lab" as AdminSection,
                    label: "Test Lab",
                    icon: <Terminal size={18} />,
                    description: "Model test ve doğrulama",
                },
            ]
        }
    ];

    return (
        <div className="flex h-screen w-full bg-[var(--color-bg-base)] overflow-hidden">

            {/* ── Admin Navigation Sidebar ── */}
            <aside className="w-[260px] flex-shrink-0 flex flex-col bg-[var(--color-sidebar-bg)] border-r border-[var(--color-sidebar-border)] z-20">

                {/* Brand */}
                <div className="px-5 py-5 border-b border-[var(--color-sidebar-border)] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)] flex items-center justify-center flex-shrink-0">
                        <Shield size={20} className="text-black" />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-[var(--color-text-primary)] leading-none tracking-tight">
                            Admin <span className="text-[var(--color-brand-dim)]">Hub</span>
                        </h1>
                        <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest mt-1">
                            Müsait Core v2.4
                        </p>
                    </div>
                </div>

                {/* Nav Groups */}
                <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {navGroups.map((group) => (
                        <div key={group.key} className="space-y-2">
                            <button
                                onClick={() => toggleGroup(group.key)}
                                className="flex items-center justify-between w-full px-3 py-2 text-left"
                            >
                                <span className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                                    {group.label}
                                </span>
                                {expandedGroups[group.key] 
                                    ? <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
                                    : <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
                                }
                            </button>
                            
                            {expandedGroups[group.key] && (
                                <div className="space-y-1">
                                    {group.items.map((item) => (
                                        <button
                                            key={item.key}
                                            onClick={() => setActiveSection(item.key)}
                                            className={`nav-item text-left w-full ${activeSection === item.key ? "active" : ""} ${
                                                'isLive' in item && item.isLive ? "relative" : ""
                                            }`}
                                        >
                                            <span className="flex-shrink-0 relative">
                                                {item.icon}
                                                {'isLive' in item && item.isLive && activeSection === item.key && (
                                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--color-brand)] animate-pulse" />
                                                )}
                                            </span>
                                            <span className="text-[14px] font-medium leading-tight flex items-center gap-2">
                                                {item.label}
                                                {'isRouting' in item && item.isRouting && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                                )}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>

                {/* User Info + Logout */}
                <div className="p-4 border-t border-[var(--color-sidebar-border)]">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                        <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)] text-black flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {userEmail?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
                                {userEmail?.split("@")[0]}
                            </p>
                            <p className="text-[11px] font-semibold text-[var(--color-brand-dim)] uppercase tracking-wider">
                                Master Admin
                            </p>
                        </div>
                        <button
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className={`btn-icon !w-10 !h-10 ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Çıkış yap"
                        >
                            {isLoggingOut ? (
                                <RefreshCw size={16} className="animate-spin" />
                            ) : (
                                <LogOut size={16} />
                            )}
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Main Content Area ── */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

                {(activeSection === "chat" || activeSection === "global" || activeSection === "routing") ? (
                    <div className="h-full flex flex-col">
                        {/* Slim tab header */}
                        <div className="h-[56px] flex-shrink-0 flex items-center px-6 bg-[var(--color-surface-elevated)] border-b border-[var(--color-border)] gap-4">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)] leading-none">
                                    {activeSection === "routing"
                                        ? "Yönlendirme Merkezi"
                                        : activeSection === "global"
                                        ? "Tüm Sohbetler"
                                        : "Komuta Merkezi"}
                                </h2>
                                <p className="text-[12px] text-[var(--color-text-muted)] mt-1 flex items-center gap-2">
                                    <span
                                        className={`inline-block w-2 h-2 rounded-full ${
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
                                    className="btn-secondary gap-2"
                                    title="İşletme AI Ayarları"
                                >
                                    <SlidersHorizontal size={16} />
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
                            {activeSection === "businesses" && (
                                <div className="max-w-5xl mx-auto px-6 md:px-10 py-8">
                                    <BusinessManagementPanel tenants={tenants} />
                                </div>
                            )}
                            {activeSection === "prompt-library" && (
                                <div className="max-w-5xl mx-auto px-6 md:px-10 py-8">
                                    <PromptLibraryPanel />
                                </div>
                            )}
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
                                <div className="h-full p-6">
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
