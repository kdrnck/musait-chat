"use client";

import { Doc } from "../../../../convex/_generated/dataModel";
import { User, ShieldCheck, AlertCircle, Archive } from "lucide-react";

function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

type ConversationWithExtras = Doc<"conversations"> & {
    tenantName?: string;
    lastMessage?: string | null;
    lastMessageRole?: "customer" | "agent" | "human" | null;
};

function getStatusChip(conversation: ConversationWithExtras): { text: string; chipClass: string } {
    if (conversation.status === "archived") return { text: "Arşivlendi", chipClass: "chip chip--muted" };
    if (conversation.status === "handoff") return { text: "İnsan devrede", chipClass: "chip chip--info" };
    return { text: "AI devrede", chipClass: "chip chip--brand" };
}

export default function ConversationCard({
    conversation,
    isSelected,
    onClick,
    customerName,
    isAdmin,
}: {
    conversation: ConversationWithExtras;
    isSelected: boolean;
    onClick: () => void;
    customerName?: string | null;
    isAdmin?: boolean;
}) {
    const displayName = customerName || conversation.customerPhone;
    const hasAttention = (conversation.retryState?.count ?? 0) > 0;
    const isHandoff = conversation.status === "handoff";
    const isArchived = conversation.status === "archived";

    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-colors duration-100 relative
                border-[1.5px] select-none touch-manipulation
                ${isSelected
                    ? "bg-[var(--color-brand-light)] border-[var(--color-brand-dim)] shadow-sm"
                    : "bg-[var(--color-surface-pure)] hover:bg-[var(--color-surface-hover)] border-[var(--color-border)] hover:border-[var(--color-border-hover)]"
                }
            `}
        >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <div className={`
                    w-11 h-11 rounded-xl flex items-center justify-center transition-colors
                    ${isSelected
                        ? "bg-[var(--color-brand)] text-black"
                        : "bg-[var(--color-surface-hover)] border border-[var(--color-border)]"
                    }
                `}>
                    <User size={18} className={isSelected ? "" : "text-[var(--color-text-muted)]"} />
                </div>

                {/* Status Dot */}
                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${
                    isSelected ? "border-[var(--color-brand-light)]" : "border-[var(--color-surface-pure)]"
                } ${
                    isArchived
                        ? "bg-[var(--color-border)]"
                        : hasAttention
                        ? "bg-[var(--color-status-attention)]"
                        : isHandoff
                        ? "bg-[var(--color-status-handoff)]"
                        : "bg-[var(--color-status-ai)]"
                }`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-[14px] font-semibold truncate text-[var(--color-text-primary)]">
                        {displayName}
                    </h3>
                    <span className={`text-[11px] font-medium flex-shrink-0 ${isSelected ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"}`}>
                        {formatTime(conversation.lastMessageAt ?? conversation.createdAt)}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <span className={getStatusChip(conversation).chipClass}>
                        {getStatusChip(conversation).text}
                    </span>

                    {isArchived && (
                        <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                            <Archive size={10} className="text-[var(--color-text-muted)]" />
                        </div>
                    )}
                    {!isArchived && (hasAttention || isHandoff) && (
                        <div
                            className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white ${
                                hasAttention ? "bg-[var(--color-status-attention)]" : "bg-[var(--color-status-handoff)]"
                            }`}
                        >
                            {hasAttention
                                ? <AlertCircle size={10} strokeWidth={3} />
                                : <ShieldCheck size={10} strokeWidth={3} />
                            }
                        </div>
                    )}
                </div>

                {/* Tenant badge (admin only) */}
                {conversation.tenantName && (
                    <div className="mt-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            isSelected
                                ? "bg-[var(--color-brand)] text-black"
                                : "bg-[var(--color-surface-active)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
                        }`}>
                            {conversation.tenantName}
                        </span>
                    </div>
                )}
            </div>
        </button>
    );
}
