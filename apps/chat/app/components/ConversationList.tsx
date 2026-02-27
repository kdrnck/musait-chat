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
        // Non-admin users filter by their tenant server-side
        !isRoutingMode && tenantId && !isAdmin ? { tenantId } : "skip"
    );
    const allConversations = useQuery(
        api.conversations.listAll,
        // Admins always load all conversations — tenant filtering is done client-side
        // so null-tenantId (routing/limbo) conversations are never hidden
        !isRoutingMode && isAdmin ? {} : "skip"
    );
    const unboundConversations = useQuery(
        api.conversations.listUnbound,
        isRoutingMode ? {} : "skip"
    );
    const conversations = isRoutingMode
        ? unboundConversations
        : (isAdmin ? allConversations : (tenantId ? tenantConversations : undefined));

    // Loading error detection: if admin query is pending for more than 10s, show error
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

    // Fetch customer names from Supabase
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
            .catch(() => { }); // Silently fail
    }, [conversations]);

    const filtered = useMemo(() => {
        if (!conversations) return [];

        let result = [...conversations];

        // Admin with specific tenant selected: show that tenant's conversations
        // but ALWAYS include null-tenantId (routing/limbo) conversations so they
        // are never hidden from the admin regardless of selected tenant.
        if (isAdmin && tenantId) {
            result = result.filter(c => c.tenantId === tenantId || c.tenantId === null);
        }

        // Deduplicate by customerPhone - keep most recent per phone number
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

        // Sort by lastMessageAt descending
        result.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));

        return result;
    }, [conversations, filter, search]);

    // Deduplicated base for counts
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
        { key: "all", label: "Tümü", icon: <MessageSquare size={14} />, count: counts.all },
        { key: "attention", label: "Dikkat", icon: <AlertTriangle size={14} />, count: counts.attention },
        { key: "handoff", label: "İnsan", icon: <UserCheck size={14} />, count: counts.handoff },
    ];

    return (
        <div className="flex flex-col h-full bg-[var(--color-sidebar-bg)] border-r border-[var(--color-border)]">
            {/* ── Header ── */}
            <div className="px-5 pt-6 pb-3 flex-shrink-0">
                {/* Logo & Brand */}
                <div className="flex items-center gap-3 mb-6 group cursor-pointer" onClick={() => router.push("/")}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-black relative overflow-hidden shadow-sm">
                        <img src="/musait-dark.png" alt="m" className="w-5 h-5 grayscale opacity-90" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-[18px] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                            müsait <span style={{ color: "var(--color-brand-dark)" }}>chat</span>
                        </h1>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="status-dot status-dot--ai !w-1.5 !h-1.5" />
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Canlı Panel</p>
                        </div>
                    </div>
                </div>

                {/* Admin tenant selector */}
                {isAdmin && allTenants && onTenantChange && !isRoutingMode && (
                    <div className="relative mb-5">
                        <LayoutGrid size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                        <select
                            value={tenantId ?? "all"}
                            onChange={(e) => onTenantChange(e.target.value === "all" ? null : e.target.value)}
                            className="w-full appearance-none bg-[var(--color-surface-pure)] border border-[var(--color-border)] transition-colors focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)] py-2.5 pl-10 pr-10 rounded-xl text-[13px] font-medium text-[var(--color-text-primary)] outline-none cursor-pointer"
                        >
                            <option value="all">Tüm İşletmeler</option>
                            {allTenants.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
                    </div>
                )}

                {/* Search */}
                <div className="relative group mb-5">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-brand-dark)] transition-colors" />
                    <input
                        type="text"
                        placeholder="Müşteri veya mesaj ara..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="native-input w-full py-2.5 pl-10 pr-4 text-[13px] font-medium text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
                    />
                </div>

                {/* Filter tabs */}
                <div className="flex bg-[var(--color-surface-hover)] p-0.5 rounded-xl border border-[var(--color-border)]">
                    {filterTabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-medium rounded-lg transition-all duration-200 ${filter === tab.key
                                ? "bg-[var(--color-surface-pure)] text-[var(--color-text-primary)] shadow-sm"
                                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-pure)]/50"
                                }`}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.count > 0 && (
                                <span className={`flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-md text-[9px] font-bold ${filter === tab.key ? "bg-[var(--color-brand-light)] text-[var(--color-brand-dark)]" : "bg-[var(--color-border)] text-[var(--color-text-secondary)]"
                                    }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Conversation List ── */}
            <div className="flex-1 overflow-y-auto px-2 py-1 sidebar-scroll">
                {!conversations ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-4">
                        {loadingError ? (
                            <>
                                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center border border-red-100">
                                    <RefreshCw size={18} className="text-red-500" />
                                </div>
                                <div className="text-center px-4">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-red-500">Bağlantı Hatası</p>
                                    <p className="text-[12px] font-medium text-red-400 mt-1">Lütfen sayfayı yenileyin</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-6 h-6 border-2 border-[var(--color-border)] rounded-full animate-spin"
                                    style={{ borderTopColor: "var(--color-brand-dark)" }} />
                                <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">Sohbetler yükleniyor...</span>
                            </>
                        )}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 animate-fade-in">
                        <div className="w-12 h-12 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center border border-[var(--color-border)]">
                            <MessageSquare size={18} className="text-[var(--color-text-muted)]" />
                        </div>
                        <span className="text-[13px] font-medium text-[var(--color-text-secondary)]">
                            {search ? "Sonuç bulunamadı" : "Henüz konuşma yok"}
                        </span>
                    </div>
                ) : (
                    <div className="space-y-[2px]">
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
            <div className="mt-auto flex-shrink-0 p-3 bg-[var(--color-surface-pure)] border-t border-[var(--color-border)]">
                <AiControlPanel tenantId={isRoutingMode ? null : tenantId} />

                <div className="flex items-center gap-3 p-2.5 mt-2 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-light)] text-[var(--color-brand-dark)] flex items-center justify-center font-bold text-xs ring-1 ring-[var(--color-brand)]/20">
                        {userEmail?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
                            {userEmail?.split('@')[0]}
                        </p>
                        <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                            {isAdmin ? 'Süper Yönetici' : 'İşletme Yetkilisi'}
                        </p>
                    </div>

                    <div className="flex gap-0.5">
                        <button
                            onClick={onToggleDebug}
                            className={`p-1.5 rounded-lg transition-colors ${debugMode ? "bg-[var(--color-brand-light)] text-[var(--color-brand-dark)]" : "text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]"
                                }`}
                            title="Geliştirici Modu"
                        >
                            <Bug size={14} />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Çıkış yap"
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
