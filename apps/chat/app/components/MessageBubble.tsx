"use client";

import { Doc } from "../../../../convex/_generated/dataModel";
import { Bot, User, Headset, Code2, Wrench } from "lucide-react";

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

const roleConfig = {
    customer: {
        align: "right" as const,
        bg: "var(--color-bubble-customer)",
        color: "var(--color-text-primary)",
        border: "var(--color-border)",
        icon: <User size={12} />,
        label: "Müşteri",
        labelColor: "var(--color-text-secondary)",
        borderRadius: "16px 16px 4px 16px",
    },
    agent: {
        align: "left" as const,
        bg: "var(--color-bubble-agent)",
        color: "#FFFFFF",
        border: "transparent",
        icon: <Bot size={12} />,
        label: "Yapay Zeka",
        labelColor: "var(--color-text-secondary)",
        borderRadius: "16px 16px 16px 4px",
    },
    human: {
        align: "right" as const,
        bg: "var(--color-status-handoff)",
        color: "#FFFFFF",
        border: "transparent",
        icon: <Headset size={12} />,
        label: "İnsan Yönetici",
        labelColor: "var(--color-text-secondary)",
        borderRadius: "16px 16px 4px 16px",
    },
};

// Helper to reliably detect and parse tool calls (JSON or markdown JSON)
function parseToolCall(content: string) {
    try {
        const parsed = JSON.parse(content);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
    } catch (e) {
        // Not direct JSON, check if it's markdown
    }

    // Check for markdown code blocks
    const match = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (match) {
        try {
            const parsed = JSON.parse(match[1]);
            if (typeof parsed === 'object' && parsed !== null) return parsed;
        } catch (e) { }
    }

    // Check if it looks vaguely like a tool call string e.g. "tool_call: get_times"
    if (content.includes("tool_call") || (content.includes("{") && content.includes("}"))) {
        try {
            // Find the first { and last }
            const start = content.indexOf("{");
            const end = content.lastIndexOf("}");
            if (start !== -1 && end !== -1 && end > start) {
                const parsed = JSON.parse(content.substring(start, end + 1));
                if (typeof parsed === 'object' && parsed !== null) return parsed;
            }
        } catch (e) { }
    }

    return null;
}

function getTurkishToolCallName(toolName: string) {
    if (!toolName) return "Yapay zeka sistem işlemi yapıyor";
    const lookup: Record<string, string> = {
        "check_calendar": "Müsaitlik durumu kontrol edildi",
        "create_appointment": "Yeni bir randevu oluşturuldu",
        "cancel_appointment": "Randevu iptal edildi",
        "get_business_info": "İşletme bilgileri sorgulandı",
        "get_pricing": "Fiyat bilgisi sorgulandı",
        "human_handoff": "İnsan desteğine aktarıldı",
        "ask_human": "İnsan desteğine aktarıldı",
        "get_staff": "Personel bilgileri sorgulandı",
        "get_services": "Hizmetler listelendi"
    };

    return lookup[toolName] || `Sistem işlemi: ${toolName}`;
}

export default function MessageBubble({
    message,
    debugMode = false,
}: {
    message: Doc<"messages">;
    debugMode?: boolean;
}) {
    const config = roleConfig[message.role];
    const isRight = config.align === "right";

    // Attempt to parse content as a tool call if it's from the agent
    let isToolCall = false;
    let parsedData = null;
    let displayText: React.ReactNode = message.content;

    if (message.role === "agent") {
        parsedData = parseToolCall(message.content);
        if (parsedData) {
            isToolCall = true;
            const toolName = parsedData.tool || parsedData.name || parsedData.action || parsedData.tool_name || Object.keys(parsedData)[0];

            if (debugMode) {
                // Raw / Debug view
                displayText = (
                    <div className="font-mono text-[11px] bg-black/20 p-2 rounded-md overflow-x-auto my-1">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase text-white/70 mb-1 border-b border-white/10 pb-1">
                            <Code2 size={12} />
                            <span>Tool Call Details</span>
                        </div>
                        <pre className="whitespace-pre-wrap">{JSON.stringify(parsedData, null, 2)}</pre>
                    </div>
                );
            } else {
                // Human readable view
                displayText = (
                    <div className="flex items-center gap-2 italic text-[14px] text-white/90">
                        <Wrench size={14} className="opacity-70" />
                        <span>{getTurkishToolCallName(toolName)}</span>
                    </div>
                );
            }
        }
    }

    return (
        <div
            className={`flex flex-col ${isRight ? "items-end" : "items-start"} mb-4`}
            style={{ maxWidth: "75%", marginLeft: isRight ? "auto" : 0 }}
        >
            {/* Sender label */}
            <div
                className="flex items-center gap-1.5 mb-1.5 px-1"
                style={{ color: config.labelColor }}
            >
                {config.icon}
                <span className="text-[11px] font-semibold tracking-wide">
                    {config.label}
                </span>
            </div>

            {/* Bubble */}
            <div
                className={`px-5 py-3.5 text-[15px] leading-relaxed relative group ${isToolCall && !debugMode ? 'bg-[var(--color-surface-3)] !text-[var(--color-text-secondary)] !border-dashed' : ''}`}
                style={{
                    background: isToolCall && !debugMode ? "transparent" : config.bg,
                    border: isToolCall && !debugMode ? "1px dashed var(--color-border)" : `1px solid ${config.border}`,
                    color: isToolCall && !debugMode ? "var(--color-text-muted)" : config.color,
                    borderRadius: config.borderRadius,
                    boxShadow: isToolCall && !debugMode ? "none" : (isRight ? "0 2px 8px rgba(0,0,0,0.02)" : "0 4px 12px rgba(0,0,0,0.05)")
                }}
            >
                {displayText}
            </div>

            {/* Timestamp + status */}
            <div className="flex items-center gap-2 mt-1.5 px-1">
                <span
                    className="text-[11px] font-medium"
                    style={{
                        color: "var(--color-text-muted)",
                    }}
                >
                    {formatTime(message.createdAt)}
                </span>
                {message.status === "failed" && (
                    <span
                        className="text-[10px] font-bold"
                        style={{ color: "var(--color-status-attention)" }}
                    >
                        HATA
                    </span>
                )}
                {message.status === "processing" && (
                    <span
                        className="text-[11px] font-medium"
                        style={{ color: "var(--color-text-muted)" }}
                    >
                        işleniyor...
                    </span>
                )}
            </div>
        </div>
    );
}
