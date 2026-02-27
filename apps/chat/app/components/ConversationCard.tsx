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
            className="w-full text-left px-6 py-3 transition-colors duration-200 group relative flex items-center gap-3.5"
            style={{
                background: isSelected
                    ? "var(--color-surface-2)"
                    : "transparent",
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
            {isSelected && (
                <div
                    className="absolute left-0 top-3 bottom-3 w-1 rounded-r-md"
                    style={{ background: "var(--color-brand)" }}
                />
            )}

            {/* Avatar / Phone icon */}
            <div
                className="w-12 h-12 flex items-center justify-center flex-shrink-0 rounded-full"
                style={{
                    background: "var(--color-surface-2)",
                }}
            >
                <Phone size={20} style={{ color: "var(--color-text-secondary)" }} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                        <span
                            className="text-[15px] font-bold truncate"
                            style={{
                                color: "var(--color-text-primary)",
                            }}
                        >
                            {formatPhoneDisplay(conversation.customerPhone)}
                        </span>
                        <div className={getStatusDotClass(conversation)} />
                    </div>
                    <span
                        className="text-xs font-medium flex-shrink-0"
                        style={{
                            color: "var(--color-text-secondary)",
                        }}
                    >
                        {formatRelativeTime(conversation.lastMessageAt)}
                    </span>
                </div>

                {/* Summary preview */}
                <p
                    className="text-[14px] truncate"
                    style={{ color: "var(--color-text-secondary)" }}
                >
                    {conversation.rollingSummary || "Yeni konuşma başladı..."}
                </p>

                {/* Status badge */}
                <div className="mt-1.5 hidden group-hover:flex">
                    <span
                        className={`badge badge--${conversation.status === "handoff" ? "handoff" : conversation.retryState.count > 0 ? "attention" : "ai"} rounded-full`}
                        style={{ fontSize: 10, padding: "2px 8px" }}
                    >
                        {getStatusLabel(conversation)}
                    </span>
                </div>
            </div>
        </button>
    );
}
