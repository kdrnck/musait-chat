/* eslint-disable */
"use client";

import { Doc } from "../../../../convex/_generated/dataModel";
import { Bot, User, Headset, Code2, Wrench, CheckCircle2, AlertTriangle } from "lucide-react";

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

const roleConfig = {
    customer: {
        align: "left" as const,
        styleClass: "bg-[var(--color-surface-pure)] border border-[var(--color-border)]",
        color: "var(--color-text-primary)",
        icon: <User size={12} />,
        label: "Müşteri",
        labelColor: "var(--color-text-secondary)",
        borderRadius: "16px 20px 20px 4px",
    },
    agent: {
        align: "right" as const,
        styleClass: "bg-[var(--color-surface-hover)] border border-[var(--color-border)]",
        color: "var(--color-text-primary)",
        icon: <Bot size={12} />,
        label: "Asistan",
        labelColor: "var(--color-brand-dim)",
        borderRadius: "20px 16px 4px 20px",
    },
    human: {
        align: "right" as const,
        styleClass: "bg-[var(--color-brand-dark)] text-white shadow-sm",
        color: "#ffffff",
        icon: <Headset size={12} />,
        label: "Yönetici",
        labelColor: "var(--color-brand-dim)",
        borderRadius: "20px 16px 4px 20px",
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
                    <div className="font-mono text-[11px] p-4 rounded-xl overflow-x-auto my-2 border border-[var(--color-border)] bg-[var(--color-surface-pure)]">
                        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider mb-2 pb-2 border-b border-[var(--color-border)]"
                            style={{ color: "var(--color-brand-dark)" }}>
                            <Code2 size={12} />
                            <span>Teknik Detay (Debug)</span>
                        </div>
                        <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                            {JSON.stringify(parsedData, null, 2)}
                        </pre>
                    </div>
                );
            } else {
                displayText = (
                    <div className="flex items-center gap-3 py-1">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-surface-pure)] border border-[var(--color-border)] flex items-center justify-center">
                            <Wrench size={14} className="text-[var(--color-brand-dark)]" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[13px] font-semibold text-[var(--color-text-primary)] leading-none mb-1">AI İşlemi</span>
                            <span className="text-[12px] text-[var(--color-text-secondary)]">{getTurkishToolCallName(toolName)}</span>
                        </div>
                    </div>
                );
            }
        }
    }

    // Tool call (non-debug) — compact minimalist view
    if (isToolCall && !debugMode) {
        return (
            <div className={`flex flex-col ${isRight ? "items-end" : "items-start"} mb-4 w-full`}>
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)]">
                    <div className="w-5 h-5 rounded-md bg-[var(--color-brand-light)] flex items-center justify-center">
                        <CheckCircle2 size={12} className="text-[var(--color-brand-dark)]" />
                    </div>
                    <span className="text-[12px] font-medium text-[var(--color-text-primary)]">
                        {getTurkishToolCallName(parsedData?.name || parsedData?.tool || "işlem")}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)] ml-1">
                        {formatTime(message.createdAt)}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex flex-col ${isRight ? "items-end" : "items-start"} mb-5 w-full`}
        >
            <div className={`flex flex-col ${isRight ? "items-end" : "items-start"} max-w-[85%] md:max-w-[75%]`}>
                {/* Sender label */}
                <div className="flex items-center gap-1.5 mb-1.5 px-1 opacity-80" style={{ color: config.labelColor }}>
                    <div className="w-4 h-4 rounded-md flex items-center justify-center bg-current/10">
                        {config.icon}
                    </div>
                    <span className="text-[10px] font-semibold tracking-wide uppercase">
                        {config.label}
                    </span>
                </div>

                {/* Bubble */}
                <div
                    className={`px-4 py-3 text-[14px] leading-relaxed break-words whitespace-pre-wrap shadow-sm ${config.styleClass}`}
                    style={{
                        color: config.color,
                        borderRadius: config.borderRadius,
                    }}
                >
                    {displayText}
                </div>

                {/* Timestamp & Status */}
                <div className={`flex items-center gap-2 mt-1 px-1 ${isRight ? "flex-row-reverse" : "flex-row"}`}>
                    <span className="text-[10px] font-medium text-[var(--color-text-muted)]">
                        {formatTime(message.createdAt)}
                    </span>
                    {message.status === "failed" && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-red-600 bg-red-50 uppercase tracking-wider">
                            GÖNDERİLEMEDİ
                        </span>
                    )}
                    {message.status === "processing" && (
                        <div className="flex items-center gap-1 ml-1 bg-[var(--color-surface-hover)] px-2 py-1 rounded-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    )}
                </div>

                {/* Debug Metrics (admin-only) */}
                {debugMode && message.role === "agent" && (message as any).debugInfo && !((message as any).debugInfo?.errorMessage) && (() => {
                    const info = (message as any).debugInfo;
                    const tokPerSec = info.completionTokens && info.responseTimeMs
                        ? Math.round(info.completionTokens / (info.responseTimeMs / 1000))
                        : null;
                    return (
                        <div className="mt-2 w-full flex flex-col items-end gap-1.5">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {info.responseTimeMs && (
                                    <span className="text-[10px] font-mono font-medium text-[var(--color-brand-dim)] bg-[var(--color-brand-light)] border border-[var(--color-brand-glow)] px-1.5 py-0.5 rounded">
                                        ⏱ {info.responseTimeMs}ms
                                    </span>
                                )}
                                {tokPerSec !== null && (
                                    <span className="text-[10px] font-mono font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                        ⚡ {tokPerSec} t/s
                                    </span>
                                )}
                                {(info.promptTokens || info.completionTokens || info.totalTokens) && (
                                    <span className="text-[10px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] border border-[var(--color-border)] px-1.5 py-0.5 rounded">
                                        🔢 {info.promptTokens ?? "?"}↑ {info.completionTokens ?? "?"}↓ {info.totalTokens ? `(${info.totalTokens})` : ""}
                                    </span>
                                )}
                                {info.model && (
                                    <span className="text-[10px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] border border-[var(--color-border)] px-1.5 py-0.5 rounded">
                                        🤖 {info.model.split("/").pop()}
                                    </span>
                                )}
                            </div>
                            {info.thinkingContent && (
                                <details className="mt-1 w-full max-w-[400px]">
                                    <summary className="text-[10px] font-semibold text-purple-600 cursor-pointer select-none flex items-center justify-end gap-1 hover:text-purple-700 transition-colors">
                                        <span>🧠 Düşünce Süreci Göster/Gizle</span>
                                    </summary>
                                    <div className="mt-2 p-3 rounded-xl text-[11px] font-mono leading-relaxed whitespace-pre-wrap text-purple-800 bg-purple-50 border border-purple-100 text-left max-h-[300px] overflow-y-auto content-scroll">
                                        {info.thinkingContent}
                                    </div>
                                </details>
                            )}
                            {/* no errorMessage inline here — handled separately below */}
                        </div>
                    );
                })()}

                {/* Error block — always visible for failed messages */}
                {message.status === "failed" && (() => {
                    const info = (message as any).debugInfo;
                    const hasError = info?.errorMessage;
                    return (
                        <div className="mt-2 w-full">
                            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-left space-y-1.5">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-700 uppercase tracking-wider pb-1.5 border-b border-red-200">
                                    <AlertTriangle size={12} />
                                    <span>Agent Hatası</span>
                                    {info?.errorType && (
                                        <span className="ml-auto font-mono normal-case font-medium text-[10px] bg-red-100 px-1.5 py-0.5 rounded">
                                            {info.errorType}
                                        </span>
                                    )}
                                </div>
                                {hasError ? (
                                    <>
                                        <div className="text-[12px] font-mono text-red-800 whitespace-pre-wrap break-words">
                                            {info.errorMessage}
                                        </div>
                                        {info.errorStack && debugMode && (
                                            <details className="mt-1">
                                                <summary className="text-[10px] font-semibold text-red-500 cursor-pointer hover:text-red-700">
                                                    Stack Trace
                                                </summary>
                                                <pre className="mt-1 p-2 bg-red-100 rounded text-[9px] overflow-x-auto whitespace-pre-wrap max-h-[200px]">
                                                    {info.errorStack}
                                                </pre>
                                            </details>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-[12px] text-red-700">
                                        Hata detayı kaydedilemedi. Sunucu loglarını kontrol edin.
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
