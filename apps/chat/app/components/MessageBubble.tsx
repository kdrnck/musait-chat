/* eslint-disable */
"use client";

import { Doc } from "../../../../convex/_generated/dataModel";
import { Bot, User, Headset, Wrench, AlertTriangle, ChevronDown, ChevronUp, Clock, Zap, Hash, Cpu, Brain, DollarSign, Info } from "lucide-react";
import { useState } from "react";

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

/* ── Tool call name mapping ── */
function getTurkishToolCallName(toolName: string) {
    if (!toolName) return "İşlem yapılıyor...";
    const lookup: Record<string, string> = {
        check_calendar: "Takvim Kontrolü",
        create_appointment: "Randevu Oluşturma",
        cancel_appointment: "Randevu İptali",
        get_business_info: "İşletme Bilgisi Sorgulama",
        get_pricing: "Fiyat Listesi Sorgulama",
        human_handoff: "İnsan Desteği Talebi",
        ask_human: "Yöneticiye Danışma",
        get_staff: "Personel Müsaitliği Sorgulama",
        get_services: "Hizmet Listesi Güncelleme",
    };
    return lookup[toolName] || toolName;
}

/* ── Parse JSON tool call from content ── */
function parseToolCall(content: string) {
    try {
        const parsed = JSON.parse(content);
        if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch { }

    const match = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (match) {
        try {
            const parsed = JSON.parse(match[1]);
            if (typeof parsed === "object" && parsed !== null) return parsed;
        } catch { }
    }

    if (content.includes("{") && content.includes("}")) {
        try {
            const start = content.indexOf("{");
            const end = content.lastIndexOf("}");
            if (start !== -1 && end !== -1 && end > start) {
                const parsed = JSON.parse(content.substring(start, end + 1));
                if (typeof parsed === "object" && parsed !== null) return parsed;
            }
        } catch { }
    }

    return null;
}

/* ── Tool Call Block (center-aligned chip) ── */
function ToolCallBlock({ parsedData, timestamp, debugMode }: {
    parsedData: any;
    timestamp: number;
    debugMode: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const toolName = parsedData?.tool || parsedData?.name || parsedData?.action || parsedData?.tool_name || Object.keys(parsedData)[0] || "işlem";
    const toolLabel = getTurkishToolCallName(toolName);

    return (
        <div className="flex justify-center my-3 w-full">
            <div className="max-w-[480px] w-full">
                <div className="debug-tool-call">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[var(--color-surface-active)] flex items-center justify-center flex-shrink-0">
                            <Wrench size={13} className="text-[var(--color-text-secondary)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">Tool Call</span>
                                <span className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-active)] px-1.5 py-0.5 rounded">
                                    {toolName}
                                </span>
                            </div>
                            <p className="text-[13px] font-medium text-[var(--color-text-primary)] mt-0.5">{toolLabel} <span className="text-emerald-400">✓</span></p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[11px] text-[var(--color-text-muted)]">{formatTime(timestamp)}</span>
                            {debugMode && (
                                <button
                                    onClick={() => setExpanded(!expanded)}
                                    className="btn-ghost p-1"
                                    title="Detayları göster/gizle"
                                >
                                    {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                            )}
                        </div>
                    </div>

                    {debugMode && expanded && (
                        <div className="mt-3 pt-3 border-t border-[var(--color-system-chip-border)]">
                            <pre className="text-[11px] font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap break-words leading-relaxed overflow-hidden">
                                {JSON.stringify(parsedData, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── Cost Calculation Helper ── */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    "deepseek/deepseek-chat": { input: 0.14, output: 0.28 },
    "deepseek/deepseek-chat-v3-0324": { input: 0.14, output: 0.28 },
    "deepseek/deepseek-reasoner": { input: 0.55, output: 2.19 },
    "google/gemini-2.0-flash-001": { input: 0.1, output: 0.4 },
    "google/gemini-2.5-flash-preview": { input: 0.15, output: 0.6 },
    "anthropic/claude-3.5-sonnet": { input: 3.0, output: 15.0 },
    "openai/gpt-oss-120b": { input: 0.0, output: 0.0 },
};

function calculateMessageCost(debugInfo: any): number | null {
    if (!debugInfo?.model || !debugInfo?.promptTokens) return null;
    const pricing = MODEL_PRICING[debugInfo.model] ||
        Object.entries(MODEL_PRICING).find(([k]) => debugInfo.model?.includes(k.split("/")[1]))?.[1];
    if (!pricing) return null;
    return ((debugInfo.promptTokens * pricing.input) + ((debugInfo.completionTokens ?? 0) * pricing.output)) / 1_000_000;
}

/* ── Debug Metrics Block ── */
function DebugMetricsBlock({ debugInfo }: { debugInfo: any }) {
    const tokPerSec = debugInfo.completionTokens && debugInfo.responseTimeMs
        ? Math.round(debugInfo.completionTokens / (debugInfo.responseTimeMs / 1000))
        : null;

    return (
        <div className="flex justify-end mt-1.5">
            <div className="debug-metrics max-w-[380px]">
                <div className="flex items-center gap-1.5 mb-2">
                    <Cpu size={11} className="text-sky-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Debug Metrikler</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {debugInfo.responseTimeMs && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-sky-300 bg-[var(--color-surface-elevated)] border border-[rgba(14,165,233,0.2)] px-2 py-0.5 rounded-md">
                            <Clock size={10} />
                            {debugInfo.responseTimeMs}ms
                        </span>
                    )}
                    {tokPerSec !== null && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-[var(--color-surface-elevated)] border border-emerald-800 px-2 py-0.5 rounded-md">
                            <Zap size={10} />
                            {tokPerSec} tok/s
                        </span>
                    )}
                    {debugInfo.totalTokens && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] px-2 py-0.5 rounded-md">
                            <Hash size={10} />
                            {debugInfo.promptTokens ?? "?"}↑ {debugInfo.completionTokens ?? "?"}↓ ({debugInfo.totalTokens})
                        </span>
                    )}
                    {debugInfo.model && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] px-2 py-0.5 rounded-md">
                            <Cpu size={10} />
                            {debugInfo.model.split("/").pop()}
                        </span>
                    )}
                    {(() => {
                        const cost = calculateMessageCost(debugInfo);
                        if (cost === null) return null;
                        return (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-[var(--color-surface-elevated)] border border-amber-800 px-2 py-0.5 rounded-md">
                                <DollarSign size={10} />
                                ${cost.toFixed(4)}
                            </span>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}

/* ── Thinking / Internal Monologue Block ── */
function ThinkingBlock({ content }: { content: string }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="flex justify-end mt-1.5">
            <div className="debug-thinking max-w-[480px] w-full">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center gap-2 text-left"
                >
                    <Brain size={13} className="text-purple-400 flex-shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-purple-300 flex-1">
                        İç Monolog (Thinking)
                    </span>
                    <span className="text-[10px] text-purple-400">{expanded ? "Gizle" : "Göster"}</span>
                    {expanded ? <ChevronUp size={12} className="text-purple-400" /> : <ChevronDown size={12} className="text-purple-400" />}
                </button>

                {expanded && (
                    <div className="mt-2.5 pt-2.5 border-t border-purple-800">
                        <p className="text-[12px] font-mono leading-relaxed whitespace-pre-wrap text-purple-200 max-h-[280px] overflow-y-auto">
                            {content}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Tool Call Trace Block ── */
function ToolTraceBlock({ content }: { content: string }) {
    const [expanded, setExpanded] = useState(false);
    const lineCount = content.split("\n").length;

    return (
        <div className="flex justify-end mt-1.5">
            <div className="max-w-[480px] w-full rounded-xl border border-amber-800 bg-[rgba(217,119,6,0.08)] px-3 py-2">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center gap-2 text-left"
                >
                    <Wrench size={13} className="text-amber-400 flex-shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300 flex-1">
                        Tool Call Trace
                    </span>
                    <span className="text-[10px] text-amber-400 mr-1">{lineCount} satır</span>
                    {expanded ? <ChevronUp size={12} className="text-amber-400" /> : <ChevronDown size={12} className="text-amber-400" />}
                </button>

                {expanded && (
                    <div className="mt-2.5 pt-2.5 border-t border-amber-800">
                        <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap text-amber-200 max-h-[320px] overflow-y-auto">
                            {content}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Error Block ── */
function ErrorBlock({ debugInfo, debugMode }: { debugInfo: any; debugMode: boolean }) {
    return (
        <div className="mt-2">
            <div className="p-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-red-900">
                <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
                    <span className="text-[11px] font-bold text-red-300 uppercase tracking-wider">Agent Hatası</span>
                    {debugInfo?.errorType && (
                        <span className="ml-auto text-[10px] font-mono bg-red-900/30 text-red-400 px-2 py-0.5 rounded border border-red-800">
                            {debugInfo.errorType}
                        </span>
                    )}
                </div>
                <p className="text-[12px] font-mono text-red-300 break-words">
                    {debugInfo?.errorMessage || "Hata detayı kaydedilemedi. Sunucu loglarını kontrol edin."}
                </p>
                {debugInfo?.errorStack && debugMode && (
                    <details className="mt-2">
                        <summary className="text-[10px] font-semibold text-red-400 cursor-pointer hover:text-red-300">
                            Stack Trace
                        </summary>
                        <pre className="mt-1 p-2 bg-red-900/20 rounded text-[9px] overflow-hidden whitespace-pre-wrap max-h-[200px] border border-red-800">
                            {debugInfo.errorStack}
                        </pre>
                    </details>
                )}
            </div>
        </div>
    );
}

/* ── Message Detail Panel (always available, togglable) ── */
function MessageDetailPanel({ debugInfo, debugMode }: { debugInfo: any; debugMode: boolean }) {
    const [open, setOpen] = useState(debugMode);
    const [thinkingOpen, setThinkingOpen] = useState(debugMode);
    const [traceOpen, setTraceOpen] = useState(debugMode);

    const hasContent = debugInfo.responseTimeMs || debugInfo.totalTokens || debugInfo.model ||
        debugInfo.thinkingContent || debugInfo.toolCallTrace;

    if (!hasContent) return null;

    return (
        <div className="mt-1.5">
            <button
                onClick={() => setOpen(!open)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
                <Info size={11} />
                {open ? "Detay Gizle" : "Detay Gör"}
            </button>

            {open && (
                <div className="debug-detail-panel mt-1.5">
                    {/* Metrics */}
                    <DebugMetricsBlock debugInfo={debugInfo} />

                    {/* Thinking */}
                    {debugInfo.thinkingContent && (
                        <div className="mt-1.5">
                            <div className="debug-thinking max-w-[480px] w-full">
                                <button
                                    onClick={() => setThinkingOpen(!thinkingOpen)}
                                    className="w-full flex items-center gap-2 text-left"
                                >
                                    <Brain size={13} className="text-purple-400 flex-shrink-0" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-purple-300 flex-1">
                                        İç Monolog (Thinking)
                                    </span>
                                    <span className="text-[10px] text-purple-400">{thinkingOpen ? "Gizle" : "Göster"}</span>
                                    {thinkingOpen ? <ChevronUp size={12} className="text-purple-400" /> : <ChevronDown size={12} className="text-purple-400" />}
                                </button>

                                {thinkingOpen && (
                                    <div className="mt-2.5 pt-2.5 border-t border-purple-800">
                                        <p className="text-[12px] font-mono leading-relaxed whitespace-pre-wrap text-purple-200 max-h-[280px] overflow-y-auto">
                                            {debugInfo.thinkingContent}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tool Call Trace */}
                    {debugInfo.toolCallTrace && (
                        <div className="mt-1.5">
                            <div className="max-w-[480px] w-full rounded-xl border border-amber-800 bg-[rgba(217,119,6,0.08)] px-3 py-2">
                                <button
                                    onClick={() => setTraceOpen(!traceOpen)}
                                    className="w-full flex items-center gap-2 text-left"
                                >
                                    <Wrench size={13} className="text-amber-400 flex-shrink-0" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300 flex-1">
                                        Tool Call Trace
                                    </span>
                                    <span className="text-[10px] text-amber-400 mr-1">{debugInfo.toolCallTrace.split("\n").length} satır</span>
                                    {traceOpen ? <ChevronUp size={12} className="text-amber-400" /> : <ChevronDown size={12} className="text-amber-400" />}
                                </button>

                                {traceOpen && (
                                    <div className="mt-2.5 pt-2.5 border-t border-amber-800">
                                        <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap text-amber-200 max-h-[320px] overflow-y-auto">
                                            {debugInfo.toolCallTrace}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ════════════════════════════════════════
   Main MessageBubble Component
═══════════════════════════════════════ */
export default function MessageBubble({
    message,
    debugMode = false,
    prevRole,
}: {
    message: Doc<"messages">;
    debugMode?: boolean;
    prevRole?: "customer" | "agent" | "human" | null;
}) {
    const role = message.role;
    const isRight = role === "agent" || role === "human";
    const showSenderLabel = prevRole !== role; // Only show label when sender changes

    // Check if agent message is a tool call
    let isToolCall = false;
    let parsedData: any = null;

    if (role === "agent") {
        parsedData = parseToolCall(message.content);
        if (parsedData) isToolCall = true;
    }

    const debugInfo = (message as any).debugInfo;

    /* ── Tool call → special center block ── */
    if (isToolCall) {
        if (!debugMode) {
            // Non-debug: compact center chip
            return (
                <ToolCallBlock
                    parsedData={parsedData}
                    timestamp={message.createdAt}
                    debugMode={false}
                />
            );
        }
        // Debug: full expandable tool call
        return (
            <ToolCallBlock
                parsedData={parsedData}
                timestamp={message.createdAt}
                debugMode={true}
            />
        );
    }

    /* ── Bubble config per role ── */
    const bubbleConfig = {
        customer: {
            bubbleClass: "bubble-customer",
            labelIcon: <User size={11} />,
            labelText: "Müşteri",
            labelColor: "text-[var(--color-text-muted)]",
            borderRadius: "4px 16px 16px 16px",
        },
        agent: {
            bubbleClass: "bubble-agent",
            labelIcon: <Bot size={11} />,
            labelText: "Asistan",
            labelColor: "text-[var(--color-brand-dim)]",
            borderRadius: "16px 4px 16px 16px",
        },
        human: {
            bubbleClass: "bubble-human",
            labelIcon: <Headset size={11} />,
            labelText: "Yönetici",
            labelColor: "text-[var(--color-brand-dim)]",
            borderRadius: "16px 4px 16px 16px",
        },
    };

    const config = bubbleConfig[role];

    return (
        <div className={`flex flex-col ${isRight ? "items-end" : "items-start"} w-full`}>

            {/* Sender label — only shown when role changes */}
            {showSenderLabel && (
                <div className={`flex items-center gap-1.5 mb-1.5 px-1 ${isRight ? "flex-row-reverse" : ""}`}>
                    <span className={`text-[11px] font-semibold ${config.labelColor} flex items-center gap-1`}>
                        {config.labelIcon}
                        {config.labelText}
                    </span>
                </div>
            )}

            {/* Bubble */}
            <div className={`max-w-[80%] md:max-w-[68%] flex flex-col ${isRight ? "items-end" : "items-start"}`}>
                <div
                    className={`px-4 py-2.5 text-[14px] leading-relaxed break-words whitespace-pre-wrap shadow-sm ${config.bubbleClass}`}
                    style={{ borderRadius: config.borderRadius }}
                >
                    {message.content}
                </div>

                {/* Timestamp + status */}
                <div className={`flex items-center gap-2 mt-1 px-0.5 ${isRight ? "flex-row-reverse" : "flex-row"}`}>
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                        {formatTime(message.createdAt)}
                    </span>
                    {message.status === "failed" && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-red-400 bg-red-900/20 border border-red-800 uppercase tracking-wider">
                            Gönderilemedi
                        </span>
                    )}
                    {message.status === "processing" && (
                        <div className="flex items-center gap-1 bg-[var(--color-surface-hover)] px-2 py-1 rounded-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                    )}
                </div>

                {/* Message Detail Panel — always visible for agent messages */}
                {role === "agent" && debugInfo && (
                    <MessageDetailPanel debugInfo={debugInfo} debugMode={debugMode} />
                )}

                {/* Error block — always visible for failed messages */}
                {message.status === "failed" && (
                    <ErrorBlock debugInfo={debugInfo} debugMode={debugMode} />
                )}
            </div>
        </div>
    );
}
