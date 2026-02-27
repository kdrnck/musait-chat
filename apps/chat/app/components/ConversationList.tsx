"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ConversationCard from "./ConversationCard";
import AiControlPanel from "./AiControlPanel";
import { Search, MessageSquare, AlertTriangle, UserCheck, LogOut, Bug, LayoutGrid, ChevronDown } from "lucide-react";

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

    const tenantConversations = useQuery(
        api.conversations.listByTenant,
        tenantId ? { tenantId } : "skip"
    );
    const allConversations = useQuery(
        api.conversations.listAll,
        !tenantId && isAdmin ? {} : "skip"
    );
    const conversations = tenantId ? tenantConversations : (isAdmin ? allConversations : undefined);

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
            .catch(() => {}); // Silently fail
    }, [conversations]);

    const filtered = useMemo(() => {
        if (!conversations) return [];

        let result = [...conversations];

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
        <div className="flex flex-col h-full bg-[#111111]">
            {/* ── Header ── */}
            <div className="px-6 pt-8 pb-4 flex-shrink-0">
                {/* Logo & Brand */}
                <div className="flex items-center gap-3 mb-8 group cursor-pointer" onClick={() => router.push("/")}>
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center glass border-white/5 shadow-xl relative overflow-hidden">
                        <img src="/musait-dark.png" alt="m" className="w-6 h-6 relative z-10" />
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-[18px] font-bold tracking-tight text-white leading-tight">
                            müsait <span style={{ color: "var(--color-brand)" }}>chat</span>
                        </h1>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="status-dot status-dot--ai !w-1.5 !h-1.5" />
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#666666]">Canlı Panel</p>
                        </div>
                    </div>
                </div>

                {/* Admin tenant selector */}
                {isAdmin && allTenants && onTenantChange && (
                    <div className="relative mb-6">
                        <LayoutGrid size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666666]" />
                        <select
                            value={tenantId || "all"}
                            onChange={(e) => onTenantChange(e.target.value === "all" ? "" : e.target.value)}
                            className="w-full appearance-none bg-white/5 border border-white/10 hover:border-white/20 transition-colors py-3.5 pl-11 pr-10 rounded-2xl text-[13px] font-medium text-white outline-none cursor-pointer"
                        >
                            <option value="all" className="bg-[#1a1a1a]">Tüm İşletmeler</option>
                            {allTenants.map((t) => (
                                <option key={t.id} value={t.id} className="bg-[#1a1a1a]">{t.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#666666] pointer-events-none" />
                    </div>
                )}

                {/* Search */}
                <div className="relative group mb-6">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666666] group-focus-within:text-[var(--color-brand)] transition-colors" />
                    <input
                        type="text"
                        placeholder="Müşteri veya mesaj ara..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 group-focus-within:border-[var(--color-brand-glow-strong)] transition-all py-3.5 pl-11 pr-4 rounded-2xl text-[13px] font-medium text-white outline-none placeholder:text-[#444444]"
                    />
                </div>

                {/* Filter tabs */}
                <div className="flex p-1 bg-white/[0.03] border border-white/5 rounded-2xl">
                    {filterTabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[12px] font-bold rounded-xl transition-all duration-300 ${
                                filter === tab.key 
                                ? "bg-white/10 text-white shadow-lg" 
                                : "text-[#666666] hover:text-[#AAAAAA]"
                            }`}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.count > 0 && (
                                <span className={`flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md text-[9px] font-black ${
                                    filter === tab.key ? "bg-[var(--color-brand)] text-[#111]" : "bg-white/5 text-[#444]"
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Conversation List ── */}
            <div className="flex-1 overflow-y-auto px-3 py-2 sidebar-scroll">
                {!conversations ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-4">
                        <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: "var(--color-brand)", borderTopColor: "transparent" }} />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#444444]">Yükleniyor...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 animate-fade-in">
                        <div className="w-12 h-12 rounded-2xl bg-white/[0.02] flex items-center justify-center border border-white/5">
                            <MessageSquare size={20} className="text-[#333333]" />
                        </div>
                        <span className="text-[12px] font-medium text-[#444444]">
                            {search ? "Sonuç bulunamadı" : "Henüz konuşma yok"}
                        </span>
                    </div>
                ) : (
                    <div className="space-y-1">
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
            <div className="mt-auto flex-shrink-0 px-4 py-4 space-y-3">
                <AiControlPanel tenantId={tenantId} />

                <div className="flex items-center gap-3 p-3 rounded-[24px] bg-white/[0.02] border border-white/5">
                    <div className="w-9 h-9 rounded-xl bg-[var(--color-brand)] flex items-center justify-center text-[#111111] font-bold text-xs shadow-lg shadow-[var(--color-brand-glow)]">
                        {userEmail?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-white truncate">
                            {userEmail?.split('@')[0]}
                        </p>
                        <p className="text-[10px] font-medium text-[#666666] truncate uppercase tracking-tight">
                            {isAdmin ? 'Süper Yönetici' : 'İşletme Yetkilisi'}
                        </p>
                    </div>

                    <div className="flex gap-1">
                        <button
                            onClick={onToggleDebug}
                            className={`p-2 rounded-xl transition-all duration-300 hover:bg-white/5 ${
                                debugMode ? "text-[var(--color-brand)]" : "text-[#444444]"
                            }`}
                            title="Debug modu"
                        >
                            <Bug size={16} />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-xl text-[#444444] hover:text-[#FF5A5F] hover:bg-red-500/10 transition-all duration-300"
                            title="Çıkış yap"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
