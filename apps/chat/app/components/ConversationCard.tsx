"use client";

import { Doc } from "../../../../convex/_generated/dataModel";
import { Phone } from "lucide-react";

function getStatusDotClass(conversation: Doc<"conversations">): string {
    if (conversation.status === "handoff") return "status-dot status-dot--handoff";
    if (conversation.retryState.count > 0) return "status-dot status-dot--attention";
    return "status-dot status-dot--ai";
}

function getStatusLabel(conversation: Doc<"conversations">): string {
    if (conversation.status === "handoff") return "İnsan";
    if (conversation.retryState.count > 0) return "Dikkat";
    return "AI Aktif";
}

function formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "şimdi";
    if (minutes < 60) return `${minutes}dk`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}sa`;
    const days = Math.floor(hours / 24);
    return `${days}g`;
}

function formatPhoneDisplay(phone: string): string {
    // Show last 4 digits for privacy, with masked prefix
    if (phone.length > 4) {
        return `•••${phone.slice(-4)}`;
    }
    return phone;
}

export default function ConversationCard({
    conversation,
    isSelected,
    onClick,
}: {
    conversation: Doc<"conversations">;
    isSelected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="w-full text-left px-3 py-3 transition-all duration-150 group"
            style={{
                background: isSelected
                    ? "var(--color-surface-active)"
                    : "transparent",
                borderLeft: isSelected
                    ? "2px solid var(--color-brand)"
                    : "2px solid transparent",
                ...(isSelected ? { boxShadow: "inset 0 0 20px rgba(124, 248, 85, 0.04)" } : {}),
            }}
            onMouseEnter={(e) => {
                if (!isSelected) {
                    e.currentTarget.style.background = "var(--color-surface-hover)";
                }
            }}
            onMouseLeave={(e) => {
                if (!isSelected) {
                    e.currentTarget.style.background = "transparent";
                }
            }}
        >
            <div className="flex items-start gap-3">
                {/* Avatar / Phone icon */}
                <div
                    className="w-9 h-9 flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                        background: "var(--color-surface-3)",
                        border: "1px solid var(--color-border)",
                    }}
                >
                    <Phone size={14} style={{ color: "var(--color-text-secondary)" }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <span
                                className="text-sm font-semibold truncate"
                                style={{
                                    color: isSelected
                                        ? "var(--color-brand)"
                                        : "var(--color-text-primary)",
                                    fontFamily: "var(--font-mono)",
                                    fontSize: 13,
                                }}
                            >
                                {formatPhoneDisplay(conversation.customerPhone)}
                            </span>
                            <div className={getStatusDotClass(conversation)} />
                        </div>
                        <span
                            className="text-[10px] flex-shrink-0"
                            style={{
                                color: "var(--color-text-muted)",
                                fontFamily: "var(--font-mono)",
                            }}
                        >
                            {formatRelativeTime(conversation.lastMessageAt)}
                        </span>
                    </div>

                    {/* Summary preview */}
                    <p
                        className="text-xs mt-1 line-clamp-2 leading-relaxed"
                        style={{ color: "var(--color-text-secondary)" }}
                    >
                        {conversation.rollingSummary || "Yeni konuşma başladı..."}
                    </p>

                    {/* Status badge */}
                    <div className="mt-1.5">
                        <span
                            className={`badge badge--${conversation.status === "handoff" ? "handoff" : conversation.retryState.count > 0 ? "attention" : "ai"}`}
                            style={{ fontSize: 9, padding: "1px 6px" }}
                        >
                            {getStatusLabel(conversation)}
                        </span>
                    </div>
                </div>
            </div>
        </button>
    );
}
