"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, useMemo, useEffect, useRef, startTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ConversationCard from "./ConversationCard";
import AiControlPanel from "./AiControlPanel";
import { Search, MessageSquare, AlertTriangle, UserCheck, LogOut, Bug, LayoutGrid, ChevronDown, RefreshCw } from "lucide-react";

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
    isRoutingMode,
    hideHeader,
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
    onTenantChange?: (id: string | null) => void;
    isRoutingMode?: boolean;
    hideHeader?: boolean;
}) {
    const [filter, setFilter] = useState<FilterTab>("all");
    const [search, setSearch] = useState("");
    const [loadingError, setLoadingError] = useState(false);
    const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const router = useRouter();

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    };

    const tenantConversations = useQuery(
        api.conversations.listByTenant,
        !isRoutingMode && tenantId && !isAdmin ? { tenantId } : "skip"
    );
    const allConversations = useQuery(
        api.conversations.listAll,
        !isRoutingMode && isAdmin ? {} : "skip"
    );
    const unboundConversations = useQuery(
        api.conversations.listUnbound,
        isRoutingMode ? {} : "skip"
    );
    const conversations = isRoutingMode
        ? unboundConversations
        : (isAdmin ? allConversations : (tenantId ? tenantConversations : undefined));

    useEffect(() => {
        if (conversations === undefined && (isAdmin || tenantId)) {
            loadingTimerRef.current = setTimeout(() => setLoadingError(true), 10000);
        } else {
            startTransition(() => setLoadingError(false));
            if (loadingTimerRef.current) {
                clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
            }
        }
        return () => {
            if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
        };
    }, [conversations, isAdmin, tenantId]);

    const [customerNames, setCustomerNames] = useState<Record<string, string | null>>({});

    useEffect(() => {
        if (!conversations || conversations.length === 0) return;
        const phones = [...new Set(conversations.map(c => c.customerPhone))];
        fetch("/api/customer-names", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phones }),
        })
            .then(res => res.json())
            .then(data => setCustomerNames(data.names || {}))
            .catch(() => { });
    }, [conversations]);

    const filtered = useMemo(() => {
        if (!conversations) return [];
        let result = [...conversations];

        if (isAdmin && tenantId) {
            result = result.filter(c => c.tenantId === tenantId || c.tenantId === null);
        }

        const phoneMap = new Map<string, typeof result[0]>();
        for (const conv of result) {
            const existing = phoneMap.get(conv.customerPhone);
            if (!existing || (conv.lastMessageAt ?? 0) > (existing.lastMessageAt ?? 0)) {
                phoneMap.set(conv.customerPhone, conv);
            }
        }
        result = Array.from(phoneMap.values());

        if (filter === "attention") {
            result = result.filter((c) => (c.retryState?.count ?? 0) > 0);
        } else if (filter === "handoff") {
            result = result.filter((c) => c.status === "handoff");
        }

        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (c) =>
                    c.customerPhone.toLowerCase().includes(q) ||
                    (c.rollingSummary || "").toLowerCase().includes(q)
            );
        }

        result.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
        return result;
    }, [conversations, filter, search, isAdmin, tenantId]);

    const deduplicatedConversations = useMemo(() => {
        if (!conversations) return [];
        const phoneMap = new Map<string, typeof conversations[0]>();
        for (const conv of conversations) {
            const existing = phoneMap.get(conv.customerPhone);
            if (!existing || (conv.lastMessageAt ?? 0) > (existing.lastMessageAt ?? 0)) {
                phoneMap.set(conv.customerPhone, conv);
            }
        }
        return Array.from(phoneMap.values());
    }, [conversations]);

    const counts = useMemo(() => {
        if (!deduplicatedConversations.length) return { all: 0, attention: 0, handoff: 0 };
        return {
            all: deduplicatedConversations.length,
            attention: deduplicatedConversations.filter((c) => (c.retryState?.count ?? 0) > 0).length,
            handoff: deduplicatedConversations.filter((c) => c.status === "handoff").length,
        };
    }, [deduplicatedConversations]);

    const filterTabs: { key: FilterTab; label: string; icon: React.ReactNode; count: number }[] = [
        { key: "all", label: "Tümü", icon: <MessageSquare size={13} />, count: counts.all },
        { key: "attention", label: "Dikkat", icon: <AlertTriangle size={13} />, count: counts.attention },
        { key: "handoff", label: "Devir", icon: <UserCheck size={13} />, count: counts.handoff },
    ];

    return (
        <div className="flex flex-col h-full bg-[var(--color-sidebar-bg)] border-r border-[var(--color-border)]">

            {/* ── Header (non-admin only) ── */}
            {!hideHeader && (
                <div className="px-4 pt-5 pb-3 flex-shrink-0 border-b border-[var(--color-border)]">
                    <div
                        className="flex items-center gap-2.5 mb-4 cursor-pointer group"
                        onClick={() => router.push("/")}
                    >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--color-text-primary)] shadow-sm flex-shrink-0">
                            <img src="/musait-dark.png" alt="m" className="w-4.5 h-4.5 brightness-0 invert opacity-90" />
                        </div>
                        <div>
                            <h1 className="text-[16px] font-bold tracking-tight text-[var(--color-text-primary)] leading-none" style={{ fontFamily: "var(--font-display)" }}>
                                müsait <span className="text-[var(--color-brand-dim)]">chat</span>
                            </h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="status-dot status-dot--ai !w-1.5 !h-1.5" />
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">Canlı Panel</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Search & Filters ── */}
            <div className="px-3 pt-3 pb-2 flex-shrink-0 space-y-2">
                {/* Admin tenant selector */}
                {isAdmin && allTenants && onTenantChange && !isRoutingMode && (
                    <div className="relative">
                        <LayoutGrid size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
                        <select
                            value={tenantId ?? "all"}
                            onChange={(e) => onTenantChange(e.target.value === "all" ? null : e.target.value)}
                            className="form-select pl-9 pr-8 py-2.5 text-[13px] appearance-none cursor-pointer"
                        >
                            <option value="all">Tüm İşletmeler</option>
                            {allTenants.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
                    </div>
                )}

                {/* Search */}
                <div className="relative group">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-brand-dim)] transition-colors pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Ara..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="native-input w-full py-2.5 pl-9 pr-4 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none"
                    />
                </div>

                {/* Filter tabs */}
                <div className="flex gap-1 p-1 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-border)]">
                    {filterTabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[12px] font-semibold rounded-lg transition-all duration-150 ${
                                filter === tab.key
                                    ? "bg-[var(--color-text-primary)] text-white shadow-sm"
                                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-active)]"
                            }`}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.count > 0 && (
                                <span className={`min-w-[16px] h-[16px] px-1 rounded text-[9px] font-bold flex items-center justify-center ${
                                    filter === tab.key
                                        ? "bg-white/20 text-white"
                                        : "bg-[var(--color-border)] text-[var(--color-text-secondary)]"
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Conversation List ── */}
            <div className="flex-1 overflow-y-auto px-2 py-1">
                {!conversations ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-4">
                        {loadingError ? (
                            <>
                                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center border border-red-100">
                                    <RefreshCw size={18} className="text-red-500" />
                                </div>
                                <div className="text-center px-4">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-red-500">Bağlantı Hatası</p>
                                    <p className="text-[12px] text-red-400 mt-1">Sayfayı yenileyin</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-5 h-5 border-2 border-[var(--color-border)] rounded-full animate-spin"
                                    style={{ borderTopColor: "var(--color-brand-dim)" }} />
                                <span className="text-[11px] font-medium text-[var(--color-text-muted)]">Yükleniyor...</span>
                            </>
                        )}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 animate-fade-in">
                        <div className="w-10 h-10 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center border border-[var(--color-border)]">
                            <MessageSquare size={16} className="text-[var(--color-text-muted)]" />
                        </div>
                        <span className="text-[12px] text-[var(--color-text-muted)]">
                            {search ? "Sonuç bulunamadı" : "Henüz konuşma yok"}
                        </span>
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {filtered.map((c) => (
                            <ConversationCard
                                key={c._id}
                                conversation={c}
                                isSelected={selectedId === c._id}
                                onClick={() => onSelect(c._id)}
                                customerName={customerNames[c.customerPhone]}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Footer ── */}
            <div className="flex-shrink-0 p-3 bg-[var(--color-surface-pure)] border-t border-[var(--color-border)] space-y-2">
                <AiControlPanel tenantId={isRoutingMode ? null : tenantId} />

                {/* User row */}
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-text-primary)] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {userEmail?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[var(--color-text-primary)] truncate">
                            {userEmail?.split("@")[0]}
                        </p>
                        <p className="text-[10px] font-medium text-[var(--color-text-muted)] truncate">
                            {isAdmin ? "Süper Yönetici" : "İşletme Yetkilisi"}
                        </p>
                    </div>

                    <div className="flex gap-1">
                        {/* Debug toggle */}
                        <button
                            onClick={onToggleDebug}
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                debugMode
                                    ? "bg-amber-50 border-amber-200 text-amber-700"
                                    : "bg-[var(--color-surface-pure)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]"
                            }`}
                            title="Debug Modu"
                        >
                            <Bug size={12} />
                            <span className="hidden sm:inline">{debugMode ? "ON" : "DBG"}</span>
                        </button>

                        {!isAdmin && (
                            <button
                                onClick={handleLogout}
                                className="btn-ghost p-1.5"
                                title="Çıkış yap"
                            >
                                <LogOut size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
