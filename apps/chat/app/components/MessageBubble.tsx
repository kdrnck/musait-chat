"use client";

import { Doc } from "../../../../convex/_generated/dataModel";
import { Bot, User, Headset, Code2, Wrench, CheckCircle2 } from "lucide-react";

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
        color: "var(--color-text-primary)",
        shadow: "0 4px 12px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)",
        icon: <User size={12} />,
        label: "Müşteri",
        labelColor: "var(--color-text-muted)",
        borderRadius: "4px 24px 24px 24px",
    },
    agent: {
        align: "right" as const,
        bg: "var(--color-bubble-agent)",
        color: "#FFFFFF",
        shadow: "0 10px 25px rgba(0,0,0,0.1)",
        icon: <Bot size={12} />,
        label: "Asistan",
        labelColor: "var(--color-brand)",
        borderRadius: "24px 24px 4px 24px",
    },
    human: {
        align: "right" as const,
        bg: "var(--color-bubble-human)",
        color: "#111111",
        shadow: "0 10px 25px var(--color-brand-glow)",
        icon: <Headset size={12} />,
        label: "Yönetici",
        labelColor: "#111111",
        borderRadius: "24px 24px 4px 24px",
    },
};

function parseToolCall(content: string) {
    try {
        const parsed = JSON.parse(content);
        if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch { /* not JSON */ }

    const match = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (match) {
        try {
            const parsed = JSON.parse(match[1]);
            if (typeof parsed === "object" && parsed !== null) return parsed;
        } catch { /* not JSON in markdown */ }
    }

    if (content.includes("tool_call") || (content.includes("{") && content.includes("}"))) {
        try {
            const start = content.indexOf("{");
            const end = content.lastIndexOf("}");
            if (start !== -1 && end !== -1 && end > start) {
                const parsed = JSON.parse(content.substring(start, end + 1));
                if (typeof parsed === "object" && parsed !== null) return parsed;
            }
        } catch { /* not extractable */ }
    }

    return null;
}

function getTurkishToolCallName(toolName: string) {
    if (!toolName) return "İşlem yapılıyor...";
    const lookup: Record<string, string> = {
        check_calendar: "Müsaitlik durumu kontrol edildi",
        create_appointment: "Randevu oluşturuldu",
        cancel_appointment: "Randevu iptal edildi",
        get_business_info: "İşletme bilgileri kontrol edildi",
        get_pricing: "Fiyatlar incelendi",
        human_handoff: "İnsan desteği talebi iletildi",
        ask_human: "Yöneticiye danışıldı",
        get_staff: "Personel müsaitliği sorgulandı",
        get_services: "Hizmet listesi güncellendi",
    };
    return lookup[toolName] || `${toolName} işlemi gerçekleştirildi`;
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

    let isToolCall = false;
    let parsedData = null;
    let displayText: React.ReactNode = message.content;

    if (message.role === "agent") {
        parsedData = parseToolCall(message.content);
        if (parsedData) {
            isToolCall = true;
            const toolName =
                parsedData.tool ||
                parsedData.name ||
                parsedData.action ||
                parsedData.tool_name ||
                Object.keys(parsedData)[0];

            if (debugMode) {
                displayText = (
                    <div className="font-mono text-[11px] p-4 rounded-2xl overflow-x-auto my-1 border border-white/5"
                        style={{ background: "rgba(0,0,0,0.2)" }}>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-3 pb-3 border-b border-white/5"
                            style={{ color: "var(--color-brand)" }}>
                            <Code2 size={12} />
                            <span>Teknik Detay (Debug)</span>
                        </div>
                        <pre className="whitespace-pre-wrap text-[11px] leading-relaxed"
                            style={{ color: "rgba(255,255,255,0.7)" }}>
                            {JSON.stringify(parsedData, null, 2)}
                        </pre>
                    </div>
                );
            } else {
                displayText = (
                    <div className="flex items-center gap-3 py-1">
                        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <Wrench size={14} className="text-[var(--color-brand)]" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[13px] font-bold text-white leading-none mb-1">AI İşlemi</span>
                            <span className="text-[11px] font-medium text-white/50">{getTurkishToolCallName(toolName)}</span>
                        </div>
                    </div>
                );
            }
        }
    }

    // Tool call (non-debug) — compact minimalist view
    if (isToolCall && !debugMode) {
        return (
            <div className={`flex flex-col ${isRight ? "items-end" : "items-start"} mb-6 animate-fade-in w-full`}>
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white border border-black/[0.03] shadow-sm">
                    <div className="w-6 h-6 rounded-lg bg-[var(--color-brand-light)] flex items-center justify-center">
                        <CheckCircle2 size={14} className="text-[var(--color-brand-dim)]" />
                    </div>
                    <span className="text-[12px] font-bold text-[var(--color-text-secondary)] tracking-tight">
                        {getTurkishToolCallName(parsedData?.name || parsedData?.tool || "işlem")}
                    </span>
                    <span className="text-[10px] font-medium text-[var(--color-text-muted)] ml-2">
                        {formatTime(message.createdAt)}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex flex-col ${isRight ? "items-end" : "items-start"} mb-6 animate-fade-in`}
            style={{ maxWidth: "85%", marginLeft: isRight ? "auto" : 0, marginRight: isRight ? 0 : "auto" }}
        >
            {/* Sender label */}
            <div className="flex items-center gap-2 mb-2 px-1" style={{ color: config.labelColor }}>
                <div className="w-5 h-5 rounded-lg flex items-center justify-center bg-current/5">
                    {config.icon}
                </div>
                <span className="text-[10px] font-black tracking-widest uppercase">
                    {config.label}
                </span>
            </div>

            {/* Bubble */}
            <div
                className="px-5 py-3.5 text-[15px] font-medium leading-[1.6] relative"
                style={{
                    background: config.bg,
                    color: config.color,
                    borderRadius: config.borderRadius,
                    boxShadow: config.shadow,
                    border: message.role === "customer" ? "1px solid rgba(0,0,0,0.03)" : "none",
                }}
            >
                {displayText}
                
                {/* Subtle glass effect for right-aligned bubbles */}
                {isRight && (
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 rounded-[inherit] pointer-events-none" />
                )}
            </div>

            {/* Timestamp & Status */}
            <div className={`flex items-center gap-2 mt-2 px-1 ${isRight ? "flex-row-reverse" : "flex-row"}`}>
                <span className="text-[10px] font-bold tracking-tight text-[var(--color-text-muted)] uppercase">
                    {formatTime(message.createdAt)}
                </span>
                {message.status === "failed" && (
                    <span className="px-2 py-0.5 rounded-md bg-red-50 text-[9px] font-black text-red-500 uppercase tracking-widest">
                        GÖNDERİLEMEDİ
                    </span>
                )}
                {message.status === "processing" && (
                    <div className="flex items-center gap-1.5 ml-1">
                        <div className="w-1 h-1 rounded-full bg-[var(--color-brand)] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1 h-1 rounded-full bg-[var(--color-brand)] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1 h-1 rounded-full bg-[var(--color-brand)] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                )}
            </div>
        </div>
    );
}
