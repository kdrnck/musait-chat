"use client";

import { Doc } from "../../../../convex/_generated/dataModel";
import { Bot, User, Headset } from "lucide-react";

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

const roleConfig = {
    customer: {
        align: "left" as const,
        bg: "var(--color-bubble-customer)",
        border: "var(--color-border)",
        icon: <User size={12} />,
        label: "Müşteri",
        labelColor: "var(--color-text-secondary)",
    },
    agent: {
        align: "right" as const,
        bg: "var(--color-bubble-agent)",
        border: "rgba(124, 248, 85, 0.15)",
        icon: <Bot size={12} />,
        label: "AI Agent",
        labelColor: "var(--color-brand-dim)",
    },
    human: {
        align: "right" as const,
        bg: "var(--color-bubble-human)",
        border: "rgba(77, 166, 255, 0.15)",
        icon: <Headset size={12} />,
        label: "İnsan",
        labelColor: "var(--color-status-handoff)",
    },
};

export default function MessageBubble({
    message,
}: {
    message: Doc<"messages">;
}) {
    const config = roleConfig[message.role];
    const isRight = config.align === "right";

    return (
        <div
            className={`flex flex-col ${isRight ? "items-end" : "items-start"}`}
            style={{ maxWidth: "75%", marginLeft: isRight ? "auto" : 0 }}
        >
            {/* Sender label */}
            <div
                className="flex items-center gap-1.5 mb-1 px-1"
                style={{ color: config.labelColor }}
            >
                {config.icon}
                <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                >
                    {config.label}
                </span>
            </div>

            {/* Bubble */}
            <div
                className="px-4 py-2.5 text-sm leading-relaxed"
                style={{
                    background: config.bg,
                    border: `1px solid ${config.border}`,
                    color: "var(--color-text-primary)",
                }}
            >
                {message.content}
            </div>

            {/* Timestamp + status */}
            <div
                className="flex items-center gap-2 mt-1 px-1"
            >
                <span
                    className="text-[10px]"
                    style={{
                        color: "var(--color-text-muted)",
                        fontFamily: "var(--font-mono)",
                    }}
                >
                    {formatTime(message.createdAt)}
                </span>
                {message.status === "failed" && (
                    <span
                        className="text-[10px] font-semibold"
                        style={{ color: "var(--color-status-attention)" }}
                    >
                        HATA
                    </span>
                )}
                {message.status === "processing" && (
                    <span
                        className="text-[10px]"
                        style={{ color: "var(--color-text-muted)" }}
                    >
                        işleniyor...
                    </span>
                )}
            </div>
        </div>
    );
}
