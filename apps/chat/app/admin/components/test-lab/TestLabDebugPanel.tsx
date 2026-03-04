"use client";

import { useState } from "react";
import { Wrench, Brain, BarChart3, ChevronDown, ChevronUp, Clock, Coins } from "lucide-react";
import type { StreamState, ToolCallEvent, MetricsData } from "./useTestLabStream";

interface TestLabDebugPanelProps {
    streamState: StreamState;
}

type DebugTab = "tools" | "thinking" | "metrics";

export default function TestLabDebugPanel({ streamState }: TestLabDebugPanelProps) {
    const [activeTab, setActiveTab] = useState<DebugTab>("tools");

    const tabs: { key: DebugTab; label: string; icon: React.ReactNode; count?: number }[] = [
        { key: "tools", label: "Tool Calls", icon: <Wrench size={14} />, count: streamState.toolCalls.length },
        { key: "thinking", label: "Düşünme", icon: <Brain size={14} /> },
        { key: "metrics", label: "Metrikler", icon: <BarChart3 size={14} /> },
    ];

    return (
        <div className="w-[380px] flex-shrink-0 flex flex-col border-l border-[var(--color-border)] bg-[var(--color-surface-pure)]">
            {/* Tabs */}
            <div className="h-[56px] flex-shrink-0 flex items-center border-b border-[var(--color-border)] px-2 gap-1">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                            activeTab === t.key
                                ? "bg-[var(--color-brand-light)] text-[var(--color-brand-dark)] border border-[var(--color-brand-glow)]"
                                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                        }`}
                    >
                        {t.icon}
                        {t.label}
                        {t.count !== undefined && t.count > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[var(--color-brand-dark)] text-white text-[10px] leading-none">
                                {t.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {activeTab === "tools" && <ToolCallsTab toolCalls={streamState.toolCalls} />}
                {activeTab === "thinking" && <ThinkingTab reasoning={streamState.reasoning} isStreaming={streamState.isStreaming} />}
                {activeTab === "metrics" && <MetricsTab metrics={streamState.metrics} />}
            </div>
        </div>
    );
}

/* ── Tool Calls Tab ─────────────────────────────────────── */
function ToolCallsTab({ toolCalls }: { toolCalls: ToolCallEvent[] }) {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    if (toolCalls.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-center text-[var(--color-text-muted)]">
                <Wrench size={20} className="mb-2 opacity-50" />
                <p className="text-[12px]">Henüz tool çağrısı yok</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {toolCalls.map((tc) => {
                const id = tc.id || tc.name + Math.random();
                const isOpen = expanded[id];
                return (
                    <div key={id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] overflow-hidden">
                        <button
                            onClick={() => setExpanded((p) => ({ ...p, [id]: !p[id] }))}
                            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--color-surface-hover)] transition-colors"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tc.result ? "bg-[var(--color-status-success)]" : "bg-[var(--color-status-warning)] animate-pulse"}`} />
                                <span className="text-[12px] font-mono font-semibold text-[var(--color-text-primary)] truncate">{tc.name}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {tc.durationMs && (
                                    <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                                        <Clock size={10} />
                                        {tc.durationMs}ms
                                    </span>
                                )}
                                {isOpen ? <ChevronUp size={14} className="text-[var(--color-text-muted)]" /> : <ChevronDown size={14} className="text-[var(--color-text-muted)]" />}
                            </div>
                        </button>
                        {isOpen && (
                            <div className="px-3 pb-3 space-y-2 border-t border-[var(--color-border)]">
                                <div className="mt-2">
                                    <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Arguments</p>
                                    <pre className="text-[11px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-bg-base)] rounded-md p-2 overflow-x-auto max-h-[200px] whitespace-pre-wrap">
                                        {JSON.stringify(tc.arguments, null, 2)}
                                    </pre>
                                </div>
                                {tc.result && (
                                    <div>
                                        <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Result</p>
                                        <pre className="text-[11px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-bg-base)] rounded-md p-2 overflow-x-auto max-h-[200px] whitespace-pre-wrap">
                                            {typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ── Thinking Tab ───────────────────────────────────────── */
function ThinkingTab({ reasoning, isStreaming }: { reasoning: string; isStreaming: boolean }) {
    if (!reasoning) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-center text-[var(--color-text-muted)]">
                <Brain size={20} className="mb-2 opacity-50" />
                <p className="text-[12px]">Henüz düşünme verisi yok</p>
            </div>
        );
    }

    return (
        <div className="relative">
            {isStreaming && (
                <div className="sticky top-0 right-0 flex items-center gap-1.5 mb-2 text-[10px] text-[var(--color-status-warning)] font-semibold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-warning)] animate-pulse" />
                    Düşünüyor...
                </div>
            )}
            <pre className="text-[12px] font-mono text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap break-words">
                {reasoning}
            </pre>
        </div>
    );
}

/* ── Metrics Tab ────────────────────────────────────────── */
function MetricsTab({ metrics }: { metrics: MetricsData | null }) {
    if (!metrics) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-center text-[var(--color-text-muted)]">
                <BarChart3 size={20} className="mb-2 opacity-50" />
                <p className="text-[12px]">Metrik verisi bekleniyor</p>
            </div>
        );
    }

    const rows: { label: string; value: string; icon: React.ReactNode }[] = [
        { label: "Toplam Süre", value: metrics.totalMs ? `${(metrics.totalMs / 1000).toFixed(1)}s` : "—", icon: <Clock size={14} /> },
        { label: "Input Tokens", value: metrics.promptTokens?.toLocaleString() ?? "—", icon: <BarChart3 size={14} /> },
        { label: "Output Tokens", value: metrics.completionTokens?.toLocaleString() ?? "—", icon: <BarChart3 size={14} /> },
        { label: "Toplam Tokens", value: metrics.totalTokens?.toLocaleString() ?? "—", icon: <BarChart3 size={14} /> },
        { label: "Token/s", value: metrics.tokensPerSec ? `${metrics.tokensPerSec.toFixed(1)}` : "—", icon: <BarChart3 size={14} /> },
        { label: "İterasyonlar", value: metrics.iterations?.toString() ?? "—", icon: <BarChart3 size={14} /> },
        { label: "Tahmini Maliyet", value: metrics.estimatedCost ? `$${metrics.estimatedCost.toFixed(4)}` : "—", icon: <Coins size={14} /> },
    ];

    return (
        <div className="space-y-2">
            {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
                    <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        {r.icon}
                        <span className="text-[12px]">{r.label}</span>
                    </div>
                    <span className="text-[13px] font-mono font-semibold text-[var(--color-text-primary)]">{r.value}</span>
                </div>
            ))}
        </div>
    );
}
