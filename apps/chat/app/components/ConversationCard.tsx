"use client";

import { Doc } from "../../../../convex/_generated/dataModel";
import { User, ShieldCheck, AlertCircle } from "lucide-react";

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

function getPreviewText(conversation: ConversationWithExtras): string {
    if (conversation.lastMessage) {
        const prefix = conversation.lastMessageRole === "customer" ? "" :
            conversation.lastMessageRole === "agent" ? "AI: " : "Yön: ";
        return prefix + conversation.lastMessage;
    }
    if (conversation.rollingSummary) return conversation.rollingSummary;
    return "Sohbet başlıyor...";
}

export default function ConversationCard({
    conversation,
    isSelected,
    onClick,
    customerName,
}: {
    conversation: ConversationWithExtras;
    isSelected: boolean;
    onClick: () => void;
    customerName?: string | null;
}) {
    const displayName = customerName || conversation.customerPhone;
    const hasAttention = (conversation.retryState?.count ?? 0) > 0;
    const isHandoff = conversation.status === "handoff";

    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 relative
                ${isSelected
                    ? "bg-[var(--color-text-primary)] shadow-sm"
                    : "hover:bg-[var(--color-surface-hover)] border border-transparent hover:border-[var(--color-border)]"
                }
            `}
        >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-colors
                    ${isSelected
                        ? "bg-white/15"
                        : "bg-[var(--color-surface-hover)] border border-[var(--color-border)]"
                    }
                `}>
                    <User size={16} className={isSelected ? "text-white" : "text-[var(--color-text-muted)]"} />
                </div>

                {/* Status Dot */}
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${
                    isSelected ? "border-[var(--color-text-primary)]" : "border-[var(--color-sidebar-bg)]"
                } ${
                    hasAttention
                        ? "bg-[var(--color-status-attention)]"
                        : isHandoff
                        ? "bg-[var(--color-status-handoff)]"
                        : "bg-[var(--color-status-ai)]"
                }`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center justify-between gap-1.5 mb-0.5">
                    <h3 className={`text-[13px] font-semibold truncate ${isSelected ? "text-white" : "text-[var(--color-text-primary)]"}`}>
                        {displayName}
                    </h3>
                    <span className={`text-[10px] font-medium flex-shrink-0 ${isSelected ? "text-white/70" : "text-[var(--color-text-muted)]"}`}>
                        {formatTime(conversation.lastMessageAt ?? conversation.createdAt)}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-1.5">
                    <p className={`text-[12px] truncate ${isSelected ? "text-white/75" : "text-[var(--color-text-muted)]"}`}>
                        {getPreviewText(conversation)}
                    </p>

                    {(hasAttention || isHandoff) && (
                        <div
                            className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white ${
                                hasAttention ? "bg-[var(--color-status-attention)]" : "bg-[var(--color-status-handoff)]"
                            }`}
                        >
                            {hasAttention
                                ? <AlertCircle size={9} strokeWidth={3} />
                                : <ShieldCheck size={9} strokeWidth={3} />
                            }
                        </div>
                    )}
                </div>

                {/* Tenant badge (admin only) */}
                {conversation.tenantName && (
                    <div className="mt-1">
                        <span className={`inline-block px-1.5 py-[1px] rounded text-[9px] font-bold uppercase tracking-wider ${
                            isSelected
                                ? "bg-white/15 text-white/80"
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
