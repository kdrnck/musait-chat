"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import {
    Send,
    Bot,
    Brain,
    Wrench,
    ChevronDown,
    ChevronUp,
    Clock,
    BarChart3,
    Coins,
    CheckCircle2,
    Loader2,
    List,
    MousePointerClick,
    Info,
} from "lucide-react";
import type { ChatMessage, StreamEvent, ToolCallEvent, MetricsData } from "./useTestLabStream";

interface TestLabChatPanelProps {
    messages: ChatMessage[];
    isStreaming: boolean;
    input: string;
    onInputChange: (value: string) => void;
    onSend: () => void;
}

export default function TestLabChatPanel({
    messages,
    isStreaming,
    input,
    onInputChange,
    onSend,
}: TestLabChatPanelProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-surface-pure)]">
            {/* Header */}
            <div className="h-[56px] flex-shrink-0 flex items-center justify-between px-6 border-b border-[var(--color-border)] bg-[var(--color-surface-pure)]">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--color-brand-light)] border border-[var(--color-brand-glow)] flex items-center justify-center text-[var(--color-brand-dark)]">
                        <Bot size={18} />
                    </div>
                    <div>
                        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-none">Test Lab</h3>
                        <p className="text-[10px] font-semibold text-[var(--color-status-success)] flex items-center gap-1.5 mt-1 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 bg-[var(--color-status-success)] rounded-full animate-pulse" />
                            {isStreaming ? "Yanıt alınıyor..." : "Hazır"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 bg-[var(--color-bg-base)]">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-4 opacity-70">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)]">
                            <Bot size={24} />
                        </div>
                        <div>
                            <p className="text-[14px] font-semibold text-[var(--color-text-primary)] mb-1">Test Lab</p>
                            <p className="text-[13px] text-[var(--color-text-secondary)]">Bir mesaj göndererek sohbeti başlatın.</p>
                        </div>
                    </div>
                ) : (
                    messages.map((m, idx) => (
                        <MessageBubble
                            key={m.id}
                            message={m}
                            isStreaming={isStreaming && idx === messages.length - 1 && m.role === "assistant"}
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-pure)]">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        onSend();
                    }}
                    className="flex gap-3 items-end"
                >
                    <textarea
                        value={input}
                        onChange={(e) => onInputChange(e.target.value)}
                        placeholder="Test mesajınızı yazın..."
                        className="flex-1 max-h-[120px] min-h-[44px] form-input text-[14px] rounded-xl py-2.5 px-4 resize-none"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                onSend();
                            }
                        }}
                        disabled={isStreaming}
                    />
                    <button
                        type="submit"
                        disabled={isStreaming || !input.trim()}
                        className="flex-shrink-0 w-11 h-11 bg-[var(--color-brand-dark)] hover:bg-[var(--color-brand-pressed)] disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-all"
                    >
                        <Send size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   Message Bubble — renders user + assistant messages
   ═══════════════════════════════════════════════════════════════ */

function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming: boolean }) {
    if (message.role === "user") {
        return (
            <div className="flex justify-end animate-fade-in">
                <div className="px-4 py-3 max-w-[80%] rounded-2xl text-[14px] leading-relaxed break-words border bg-[var(--color-customer-bg)] border-[var(--color-customer-border)] text-[var(--color-text-primary)] rounded-tr-sm">
                    {message.content}
                </div>
            </div>
        );
    }

    // Assistant message — render stream events inline
    return (
        <div className="flex justify-start animate-fade-in">
            <div className="max-w-[85%] w-full space-y-2">
                {/* Stream Events (thinking + tool calls) */}
                <InlineStreamEvents events={message.streamEvents || []} isStreaming={isStreaming} />

                {/* Final content bubble */}
                {(message.content || (!isStreaming && !message.streamEvents?.length)) && (
                    <div className="px-4 py-3 rounded-2xl text-[14px] leading-relaxed break-words border bg-[var(--color-agent-bg)] border-[var(--color-agent-border)] text-[var(--color-text-primary)] rounded-tl-sm">
                        <MessageContent content={message.content || (isStreaming ? "" : "(boş yanıt)")} />
                    </div>
                )}

                {/* Streaming indicator when no content yet */}
                {isStreaming && !message.content && !message.streamEvents?.some(e => e.type === "thinking" || e.type === "tool_call") && (
                    <div className="px-4 py-3 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-tl-sm flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" />
                    </div>
                )}

                {/* Metrics details (collapsed) */}
                {message.metrics && !isStreaming && (
                    <MetricsDetails metrics={message.metrics} toolCalls={message.toolCalls} />
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   Inline Stream Events — thinking + tool calls in the chat
   ═══════════════════════════════════════════════════════════════ */

function InlineStreamEvents({ events, isStreaming }: { events: StreamEvent[]; isStreaming: boolean }) {
    if (!events || events.length === 0) return null;

    // Group sequential events and skip content events (rendered separately)
    const inlineEvents = events.filter((e) => e.type !== "content");
    if (inlineEvents.length === 0) return null;

    return (
        <div className="space-y-1.5">
            {inlineEvents.map((event, idx) => {
                switch (event.type) {
                    case "thinking":
                        return <ThinkingBlock key={`thinking-${idx}`} content={event.content} done={event.done} isStreaming={isStreaming} />;
                    case "tool_call":
                        return <ToolCallBlock key={`tc-${event.id}-${idx}`} event={event} />;
                    case "tool_result":
                        return <ToolResultBlock key={`tr-${event.id}-${idx}`} event={event} />;
                    default:
                        return null;
                }
            })}
        </div>
    );
}

/* ── Thinking Block ───────────────────────────────────────── */

function ThinkingBlock({ content, done, isStreaming }: { content: string; done: boolean; isStreaming: boolean }) {
    const [expanded, setExpanded] = useState(true);

    return (
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 overflow-hidden transition-all">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-purple-500/10 transition-colors"
            >
                <Brain size={14} className="text-purple-400 flex-shrink-0" />
                <span className="text-[12px] font-semibold text-purple-300 flex-1">
                    Düşünüyor{!done && isStreaming ? "..." : ""}
                </span>
                {!done && isStreaming && (
                    <Loader2 size={12} className="text-purple-400 animate-spin flex-shrink-0" />
                )}
                {done && (
                    <CheckCircle2 size={12} className="text-purple-400/60 flex-shrink-0" />
                )}
                {expanded ? (
                    <ChevronUp size={12} className="text-purple-400/40 flex-shrink-0" />
                ) : (
                    <ChevronDown size={12} className="text-purple-400/40 flex-shrink-0" />
                )}
            </button>
            {expanded && (
                <div className="px-3 pb-2.5 border-t border-purple-500/10">
                    <pre className="text-[11px] font-mono text-purple-200/70 leading-relaxed whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto mt-2">
                        {content}
                    </pre>
                </div>
            )}
        </div>
    );
}

/* ── Tool Call Block ──────────────────────────────────────── */

function ToolCallBlock({ event }: { event: { id: string; name: string; arguments: Record<string, unknown> } }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 overflow-hidden transition-all">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-sky-500/10 transition-colors"
            >
                <Wrench size={13} className="text-sky-400 flex-shrink-0" />
                <span className="text-[12px] font-mono font-semibold text-sky-300 flex-1 truncate">
                    {event.name}
                </span>
                <Loader2 size={12} className="text-sky-400 animate-spin flex-shrink-0" />
                {expanded ? (
                    <ChevronUp size={12} className="text-sky-400/40 flex-shrink-0" />
                ) : (
                    <ChevronDown size={12} className="text-sky-400/40 flex-shrink-0" />
                )}
            </button>
            {expanded && Object.keys(event.arguments).length > 0 && (
                <div className="px-3 pb-2.5 border-t border-sky-500/10">
                    <p className="text-[10px] font-semibold text-sky-400/50 uppercase tracking-wider mt-2 mb-1">Argümanlar</p>
                    <pre className="text-[11px] font-mono text-sky-200/60 bg-sky-900/20 rounded-md p-2 overflow-x-auto max-h-[150px] whitespace-pre-wrap">
                        {JSON.stringify(event.arguments, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

/* ── Tool Result Block ────────────────────────────────────── */

function ToolResultBlock({ event }: { event: { id: string; name: string; result: unknown; durationMs: number | null } }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden transition-all">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-emerald-500/10 transition-colors"
            >
                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                <span className="text-[12px] font-mono font-semibold text-emerald-300 flex-1 truncate">
                    {event.name}
                </span>
                {event.durationMs !== null && (
                    <span className="text-[10px] text-emerald-400/60 flex items-center gap-1 flex-shrink-0">
                        <Clock size={10} />
                        {event.durationMs}ms
                    </span>
                )}
                {expanded ? (
                    <ChevronUp size={12} className="text-emerald-400/40 flex-shrink-0" />
                ) : (
                    <ChevronDown size={12} className="text-emerald-400/40 flex-shrink-0" />
                )}
            </button>
            {expanded && !!event.result && (
                <div className="px-3 pb-2.5 border-t border-emerald-500/10">
                    <p className="text-[10px] font-semibold text-emerald-400/50 uppercase tracking-wider mt-2 mb-1">Sonuç</p>
                    <pre className="text-[11px] font-mono text-emerald-200/60 bg-emerald-900/20 rounded-md p-2 overflow-x-auto max-h-[150px] whitespace-pre-wrap">
                        {typeof event.result === "string" ? event.result : JSON.stringify(event.result as Record<string, unknown>, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   Metrics Details — collapsible under the message
   ═══════════════════════════════════════════════════════════════ */

function MetricsDetails({ metrics, toolCalls }: { metrics: MetricsData; toolCalls?: ToolCallEvent[] }) {
    const [open, setOpen] = useState(false);

    const rows = [
        { label: "Toplam Süre", value: metrics.totalMs ? `${(metrics.totalMs / 1000).toFixed(1)}s` : "—", icon: <Clock size={13} /> },
        { label: "İterasyonlar", value: metrics.iterations?.toString() ?? "—", icon: <BarChart3 size={13} /> },
        { label: "Input Tokens", value: metrics.promptTokens?.toLocaleString() ?? "—", icon: <BarChart3 size={13} /> },
        { label: "Output Tokens", value: metrics.completionTokens?.toLocaleString() ?? "—", icon: <BarChart3 size={13} /> },
        { label: "Toplam Tokens", value: metrics.totalTokens?.toLocaleString() ?? "—", icon: <BarChart3 size={13} /> },
        { label: "Token/s", value: metrics.tokensPerSec ? `${metrics.tokensPerSec.toFixed(1)}` : "—", icon: <BarChart3 size={13} /> },
        { label: "Tahmini Maliyet", value: metrics.estimatedCost ? `$${metrics.estimatedCost.toFixed(4)}` : "—", icon: <Coins size={13} /> },
    ];

    return (
        <div className="mt-1">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors py-1 px-1 rounded-md hover:bg-[var(--color-surface-hover)]"
            >
                <Info size={12} />
                <span className="font-medium">{open ? "Detayları Gizle" : "Detay Gör"}</span>
                {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {open && (
                <div className="mt-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 space-y-1.5 animate-fade-in">
                    {rows.map((r) => (
                        <div key={r.label} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors">
                            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                                {r.icon}
                                <span className="text-[11px]">{r.label}</span>
                            </div>
                            <span className="text-[12px] font-mono font-semibold text-[var(--color-text-primary)]">{r.value}</span>
                        </div>
                    ))}
                    {toolCalls && toolCalls.length > 0 && (
                        <div className="pt-2 mt-1 border-t border-[var(--color-border)]">
                            <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 px-2">Tool Çağrıları ({toolCalls.length})</p>
                            {toolCalls.map((tc) => (
                                <div key={tc.id} className="flex items-center justify-between py-1 px-2 rounded-lg">
                                    <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                                        <Wrench size={11} />
                                        <span className="text-[11px] font-mono">{tc.name}</span>
                                    </div>
                                    {tc.durationMs !== null && (
                                        <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                                            <Clock size={10} />
                                            {tc.durationMs}ms
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   Message Content — plain text + WhatsApp interactive rendering
   ═══════════════════════════════════════════════════════════════ */

interface WhatsAppButtons {
    body: string;
    buttons: { id: string; title: string }[];
}

interface WhatsAppList {
    body: string;
    button: string;
    sections: {
        title: string;
        rows: { id: string; title: string; description?: string }[];
    }[];
}

function MessageContent({ content }: { content: string }) {
    const parsed = useMemo(() => parseWhatsAppContent(content), [content]);

    return (
        <div className="space-y-3">
            {parsed.map((segment, idx) => {
                if (segment.type === "text") {
                    return segment.text ? (
                        <span key={idx} className="whitespace-pre-wrap">{segment.text}</span>
                    ) : null;
                }
                if (segment.type === "buttons") {
                    return <WhatsAppButtonsRenderer key={idx} data={segment.data as WhatsAppButtons} />;
                }
                if (segment.type === "list") {
                    return <WhatsAppListRenderer key={idx} data={segment.data as WhatsAppList} />;
                }
                return null;
            })}
        </div>
    );
}

type ParsedSegment =
    | { type: "text"; text: string }
    | { type: "buttons"; data: WhatsAppButtons }
    | { type: "list"; data: WhatsAppList };

function parseWhatsAppContent(content: string): ParsedSegment[] {
    const segments: ParsedSegment[] = [];
    let remaining = content;

    // Match <<BUTTONS>>...<<\/BUTTONS>> and <<LIST>>...<<\/LIST>>
    const regex = /<<(BUTTONS|LIST)>>\s*([\s\S]*?)\s*<<\/(BUTTONS|LIST)>>/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(remaining)) !== null) {
        // Text before this match
        if (match.index > lastIndex) {
            const text = remaining.slice(lastIndex, match.index).trim();
            if (text) segments.push({ type: "text", text });
        }

        const kind = match[1].toLowerCase() as "buttons" | "list";
        const json = match[2].trim();

        try {
            const data = JSON.parse(json);
            segments.push({ type: kind, data });
        } catch {
            // If JSON is invalid, render as text
            segments.push({ type: "text", text: match[0] });
        }

        lastIndex = match.index + match[0].length;
    }

    // Remaining text after last match
    if (lastIndex < remaining.length) {
        const text = remaining.slice(lastIndex).trim();
        if (text) segments.push({ type: "text", text });
    }

    // If no segments found, treat as plain text
    if (segments.length === 0 && content) {
        segments.push({ type: "text", text: content });
    }

    return segments;
}

/* ── WhatsApp Buttons Renderer ────────────────────────────── */

function WhatsAppButtonsRenderer({ data }: { data: WhatsAppButtons }) {
    return (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] overflow-hidden">
            {/* WhatsApp badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border-b border-emerald-500/20">
                <MousePointerClick size={11} className="text-emerald-400" />
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">WhatsApp Butonlar</span>
            </div>
            {/* Body */}
            <div className="px-3 py-2.5">
                <p className="text-[13px] text-[var(--color-text-primary)] whitespace-pre-wrap">{data.body}</p>
            </div>
            {/* Buttons */}
            {data.buttons && data.buttons.length > 0 && (
                <div className="px-3 pb-3 flex flex-wrap gap-2">
                    {data.buttons.map((btn) => (
                        <button
                            key={btn.id}
                            className="px-4 py-2 rounded-lg bg-[var(--color-brand-dark)]/10 border border-[var(--color-brand-dark)]/30 text-[var(--color-brand-dark)] text-[12px] font-semibold hover:bg-[var(--color-brand-dark)]/20 transition-colors cursor-default"
                        >
                            {btn.title}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── WhatsApp List Renderer ───────────────────────────────── */

function WhatsAppListRenderer({ data }: { data: WhatsAppList }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] overflow-hidden">
            {/* WhatsApp badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border-b border-emerald-500/20">
                <List size={11} className="text-emerald-400" />
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">WhatsApp Liste</span>
            </div>
            {/* Body */}
            <div className="px-3 py-2.5">
                <p className="text-[13px] text-[var(--color-text-primary)] whitespace-pre-wrap">{data.body}</p>
            </div>
            {/* List button */}
            <div className="px-3 pb-2">
                <button
                    onClick={() => setOpen(!open)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] font-semibold hover:bg-emerald-500/20 transition-colors"
                >
                    <List size={14} />
                    {data.button || "Seçiniz"}
                    {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
            </div>
            {/* Sections */}
            {open && data.sections && (
                <div className="border-t border-[var(--color-border)]">
                    {data.sections.map((section, sIdx) => (
                        <div key={sIdx}>
                            {section.title && (
                                <div className="px-3 py-1.5 bg-[var(--color-surface-hover)]">
                                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{section.title}</p>
                                </div>
                            )}
                            {section.rows.map((row) => (
                                <div
                                    key={row.id}
                                    className="px-3 py-2.5 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-hover)] transition-colors cursor-default"
                                >
                                    <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{row.title}</p>
                                    {row.description && (
                                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{row.description}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
