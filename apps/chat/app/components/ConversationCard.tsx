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
            conversation.lastMessageRole === "agent" ? "🤖 " : "👤 ";
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
    // Display name: prefer customer name, fall back to phone
    const displayName = customerName || conversation.customerPhone;
    const hasAttention = (conversation.retryState?.count ?? 0) > 0;
    const isHandoff = conversation.status === "handoff";

    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 group relative
                ${isSelected
                    ? "bg-[var(--color-surface-pure)] border border-[var(--color-border)] shadow-sm"
                    : "hover:bg-[var(--color-surface-hover)] border border-transparent"
                }
            `}
        >
            {/* Active Indicator Bar */}
            {isSelected && (
                <div
                    className="absolute left-0 inset-y-2 w-1 rounded-r-full"
                    style={{ background: "var(--color-brand-dark)" }}
                />
            )}

            {/* Avatar */}
            <div className="relative flex-shrink-0 ml-1">
                <div className={`
                    w-11 h-11 rounded-full flex items-center justify-center transition-colors
                    ${isSelected ? "bg-[var(--color-brand-light)]" : "bg-[var(--color-surface-pure)] border border-[var(--color-border)]"}
                `}>
                    <User size={18} className={isSelected ? "text-[var(--color-brand-dark)]" : "text-[var(--color-text-muted)]"} />
                </div>

                {/* Status Indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-[var(--color-sidebar-bg)] group-hover:bg-[var(--color-surface-hover)] transition-colors">
                    {hasAttention ? (
                        <div className="status-dot status-dot--attention" />
                    ) : isHandoff ? (
                        <div className="status-dot status-dot--handoff bg-[var(--color-status-handoff)]" />
                    ) : (
                        <div className="status-dot status-dot--ai" />
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h3 className={`text-[14px] font-semibold truncate ${isSelected ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)]"}`}>
                        {displayName}
                    </h3>
                    <span className={`text-[11px] font-medium flex-shrink-0 ${isSelected ? "text-[var(--color-brand-dark)]" : "text-[var(--color-text-muted)]"}`}>
                        {formatTime(conversation.lastMessageAt ?? conversation.createdAt)}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <p className={`text-[13px] truncate ${isSelected ? "text-[var(--color-text-secondary)] font-medium" : "text-[var(--color-text-muted)]"}`}>
                        {getPreviewText(conversation)}
                    </p>

                    {(hasAttention || isHandoff) && (
                        <div className="flex-shrink-0 text-white rounded-full w-4 h-4 flex items-center justify-center shadow-sm" style={{ background: hasAttention ? 'var(--color-status-attention)' : 'var(--color-status-handoff)' }}>
                            {hasAttention ? <AlertCircle size={10} strokeWidth={3} /> : <ShieldCheck size={10} strokeWidth={3} />}
                        </div>
                    )}
                </div>
                {/* Tenant Badge (Admin Only View) */}
                {conversation.tenantName && (
                    <div className="mt-1">
                        <span className="inline-block px-1.5 py-[2px] rounded border border-[var(--color-border)] bg-[var(--color-surface-pure)] text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                            {conversation.tenantName}
                        </span>
                    </div>
                )}
            </div>
        </button>
    );
}
