"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ConversationCard from "./ConversationCard";
import AiControlPanel from "./AiControlPanel";
import { Search, MessageSquare, AlertTriangle, UserCheck, LogOut } from "lucide-react";

type FilterTab = "all" | "attention" | "handoff";

export default function ConversationList({
    tenantId,
    selectedId,
    onSelect,
    tenantName,
    tenantLogo,
    userEmail,
    debugMode,
    onToggleDebug,
    isAdmin,
    allTenants,
    onTenantChange,
}: {
    tenantId: string | null;
    selectedId: Id<"conversations"> | null;
    onSelect: (id: Id<"conversations">) => void;
    tenantName: string | null;
    tenantLogo: string | null;
    userEmail: string | null;
    debugMode: boolean;
    onToggleDebug: () => void;
    isAdmin?: boolean;
    allTenants?: { id: string; name: string; logo_url: string | null }[];
    onTenantChange?: (id: string) => void;
}) {
    const [filter, setFilter] = useState<FilterTab>("all");
    const [search, setSearch] = useState("");
    const router = useRouter();

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    };

    // Subscribe to conversations in real-time
    const conversations = useQuery(
        api.conversations.listByTenant,
        tenantId ? { tenantId } : "skip"
    );

    const filtered = useMemo(() => {
        if (!conversations) return [];

        let result = [...conversations];

        // Filter by status
        if (filter === "attention") {
            result = result.filter(
                (c) => c.status === "active" && c.retryState.count > 0
            );
        } else if (filter === "handoff") {
            result = result.filter((c) => c.status === "handoff");
        }

        // Search by phone or summary
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (c) =>
                    c.customerPhone.includes(q) ||
                    c.rollingSummary.toLowerCase().includes(q)
            );
        }

        // Sort by most recent
        result.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

        return result;
    }, [conversations, filter, search]);

    const tabs: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
        { key: "all", label: "Tümü", icon: <MessageSquare size={14} /> },
        {
            key: "attention",
            label: "Dikkat",
            icon: <AlertTriangle size={14} />,
        },
        { key: "handoff", label: "İnsan", icon: <UserCheck size={14} /> },
    ];

    return (
        <div className="flex flex-col h-full">
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-6 pb-4">
                <div className="flex items-center gap-3 font-bold text-lg tracking-tight" style={{ color: "var(--color-text-primary)" }}>
                    <div
                        className="w-8 h-8 flex items-center justify-center rounded-xl"
                        style={{
                            background: "var(--color-text-primary)",
                            color: "var(--color-surface-1)",
                        }}
                    >
                        <MessageSquare size={16} strokeWidth={2.5} />
                    </div>
                    Müsait
                </div>
            </div>

            {/* ── Admin Tenant Selector ── */}
            {isAdmin && allTenants && onTenantChange && (
                <div className="px-6 pb-4">
                    <select
                        value={tenantId || ""}
                        onChange={(e) => {
                            onSelect("" as Id<"conversations">); // clear selected convo
                            onTenantChange(e.target.value);
                        }}
                        className="w-full bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm font-semibold outline-none"
                    >
                        {allTenants.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* ── Search ── */}
            <div className="px-6 pb-4">
                <div
                    className="flex items-center gap-2 px-4 py-3 rounded-xl transition-all"
                    style={{
                        background: "var(--color-surface-2)",
                        border: "1px solid transparent",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "transparent")}
                >
                    <Search size={16} style={{ color: "var(--color-text-muted)" }} />
                    <input
                        type="text"
                        placeholder="Ara..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-transparent outline-none flex-1 text-sm font-medium placeholder:text-[var(--color-text-muted)]"
                        style={{ color: "var(--color-text-primary)" }}
                    />
                </div>
            </div>

            {/* ── Filter Tabs ── */}
            <div className="flex gap-2 px-6 pb-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-full transition-all"
                        style={{
                            background:
                                filter === tab.key
                                    ? "var(--color-surface-2)"
                                    : "transparent",
                            color:
                                filter === tab.key
                                    ? "var(--color-text-primary)"
                                    : "var(--color-text-secondary)",
                            border: `1px solid ${filter === tab.key ? "var(--color-border)" : "transparent"}`,
                        }}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Conversation List ── */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
                {!conversations ? (
                    // Loading state
                    <div className="flex flex-col gap-2 px-2 pt-2">
                        {[...Array(5)].map((_, i) => (
                            <div
                                key={i}
                                className="h-20 animate-pulse"
                                style={{
                                    background: "var(--color-surface-2)",
                                    animationDelay: `${i * 100}ms`,
                                }}
                            />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    // Empty state
                    <div
                        className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center"
                    >
                        <MessageSquare
                            size={32}
                            style={{ color: "var(--color-text-muted)" }}
                        />
                        <p
                            className="text-sm"
                            style={{ color: "var(--color-text-muted)" }}
                        >
                            {search
                                ? "Sonuç bulunamadı"
                                : "Henüz konuşma yok"}
                        </p>
                    </div>
                ) : (
                    // Conversation cards
                    <div className="flex flex-col gap-1 pt-1">
                        {filtered.map((conversation, i) => (
                            <div
                                key={conversation._id}
                                className="animate-fade-in"
                                style={{ animationDelay: `${i * 40}ms` }}
                            >
                                <ConversationCard
                                    conversation={conversation}
                                    isSelected={selectedId === conversation._id}
                                    onClick={() => onSelect(conversation._id)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Footer: Tenant Profile ── */}
            <div
                className="border-t"
                style={{ borderColor: "var(--color-border)" }}
            >
                {/* Business info */}
                <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={{
                        background: "var(--color-surface-2)",
                    }}
                >
                    {/* Logo or initials */}
                    <div
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center overflow-hidden"
                        style={{
                            background: tenantLogo ? "transparent" : "var(--color-brand-glow)",
                            border: "1px solid var(--color-border-brand)",
                            borderRadius: "10px",
                        }}
                    >
                        {tenantLogo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={tenantLogo}
                                alt={tenantName || "İşletme"}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span
                                className="text-sm font-bold"
                                style={{ color: "var(--color-brand)" }}
                            >
                                {(tenantName || "?")[0].toUpperCase()}
                            </span>
                        )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                        <p
                            className="text-sm font-semibold truncate"
                            style={{ color: "var(--color-text-primary)" }}
                        >
                            {tenantName || "İşletme Yükleniyor..."}
                        </p>
                        <p
                            className="text-[10px] truncate"
                            style={{
                                color: "var(--color-text-muted)",
                                fontFamily: "var(--font-mono)",
                            }}
                        >
                            {userEmail || ""}
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={onToggleDebug}
                            className={`p-1.5 flex-shrink-0 transition-colors rounded-md ${debugMode ? 'bg-[var(--color-brand-glow)] text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]'}`}
                            title={debugMode ? "Geliştirici ModuAçık" : "Geliştirici Modu Kapalı"}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 2 1.88 1.88" /><path d="M14.12 3.88 16 2" /><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" /><path d="M12 20v-9" /><path d="M6.53 9C4.6 8.8 3 7.1 3 5" /><path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" /><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" /><path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" /></svg>
                        </button>
                        <AiControlPanel tenantId={tenantId} />
                        <button
                            onClick={handleLogout}
                            className="p-1.5 flex-shrink-0 transition-colors"
                            style={{ color: "var(--color-text-muted)" }}
                            onMouseEnter={(e) =>
                                (e.currentTarget.style.color = "var(--color-status-attention)")
                            }
                            onMouseLeave={(e) =>
                                (e.currentTarget.style.color = "var(--color-text-muted)")
                            }
                            title="Çıkış Yap"
                        >
                            <LogOut size={15} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
