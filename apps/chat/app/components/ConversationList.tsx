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
}: {
    tenantId: string | null;
    selectedId: Id<"conversations"> | null;
    onSelect: (id: Id<"conversations">) => void;
    tenantName: string | null;
    tenantLogo: string | null;
    userEmail: string | null;
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
            <div
                className="flex items-center justify-between px-5 py-4 border-b"
                style={{ borderColor: "var(--color-border)" }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-8 h-8 flex items-center justify-center"
                        style={{
                            background: "var(--color-brand)",
                            color: "var(--color-surface-base)",
                        }}
                    >
                        <MessageSquare size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1
                            className="text-sm font-bold tracking-wide"
                            style={{ color: "var(--color-text-primary)" }}
                        >
                            MÜSAIT CHAT
                        </h1>
                        <p
                            className="text-[10px] tracking-widest uppercase"
                            style={{ color: "var(--color-text-muted)" }}
                        >
                            Command Center
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Search ── */}
            <div className="px-3 py-3">
                <div
                    className="flex items-center gap-2 px-3 py-2"
                    style={{
                        background: "var(--color-surface-2)",
                        border: "1px solid var(--color-border)",
                    }}
                >
                    <Search size={14} style={{ color: "var(--color-text-muted)" }} />
                    <input
                        type="text"
                        placeholder="Telefon, özet ara..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-transparent outline-none flex-1 text-sm placeholder:text-[var(--color-text-muted)]"
                        style={{ color: "var(--color-text-primary)" }}
                    />
                </div>
            </div>

            {/* ── Filter Tabs ── */}
            <div
                className="flex gap-1 px-3 pb-2"
            >
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all"
                        style={{
                            background:
                                filter === tab.key
                                    ? "var(--color-brand-glow)"
                                    : "transparent",
                            color:
                                filter === tab.key
                                    ? "var(--color-brand)"
                                    : "var(--color-text-muted)",
                            border: `1px solid ${filter === tab.key ? "var(--color-border-brand)" : "transparent"}`,
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
