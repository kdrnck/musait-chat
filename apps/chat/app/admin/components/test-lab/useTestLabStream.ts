"use client";

import { useState, useRef, useCallback } from "react";

/* ─────────────── Types ─────────────── */

export interface ToolCallEvent {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result: string | null;
    durationMs: number | null;
    timestamp: number;
}

export interface MetricsData {
    totalMs: number;
    tokensPerSec: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    iterations?: number;
    estimatedCost?: number;
}

export interface StreamState {
    content: string;
    reasoning: string;
    toolCalls: ToolCallEvent[];
    metrics: MetricsData | null;
    isStreaming: boolean;
}

export interface TestConfig {
    model: string;
    tenantId: string;
    phone: string;
    system: string;
}

export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    reasoning?: string;
    toolCalls?: ToolCallEvent[];
    metrics?: MetricsData;
}

const INITIAL_STATE: StreamState = {
    content: "",
    reasoning: "",
    toolCalls: [],
    metrics: null,
    isStreaming: false,
};

/* ─────────────── Hook ─────────────── */

export function useTestLabStream() {
    const [state, setState] = useState<StreamState>(INITIAL_STATE);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const abortRef = useRef<AbortController | null>(null);

    const sendMessage = useCallback(async (msg: string, config: TestConfig) => {
        // Abort any in-flight request
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: msg.trim(),
        };

        const assistantMessageId = (Date.now() + 1).toString();

        setMessages((prev) => [...prev, userMessage]);

        // Reset stream state
        setState({
            content: "",
            reasoning: "",
            toolCalls: [],
            metrics: null,
            isStreaming: true,
        });

        // Add placeholder assistant message
        setMessages((prev) => [
            ...prev,
            { id: assistantMessageId, role: "assistant", content: "" },
        ]);

        try {
            const res = await fetch("/api/admin/model-test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                    model: config.model,
                    tenantId: config.tenantId,
                    system: config.system,
                    phone: config.phone,
                }),
                signal: controller.signal,
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || "API hatası");
            }

            const contentType = res.headers.get("content-type");

            if (contentType?.includes("text/event-stream")) {
                const reader = res.body?.getReader();
                const decoder = new TextDecoder();

                if (!reader) throw new Error("Stream reader not available");

                let accContent = "";
                let accReasoning = "";
                const toolCalls: ToolCallEvent[] = [];
                let finalMetrics: MetricsData | null = null;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split("\n").filter((l) => l.trim() !== "");

                    for (const line of lines) {
                        if (!line.startsWith("data: ")) continue;
                        const data = line.slice(6);
                        if (data === "[DONE]") break;

                        try {
                            const parsed = JSON.parse(data);

                            if (parsed.type === "content" && parsed.content) {
                                accContent += parsed.content;
                                setState((s) => ({ ...s, content: accContent }));
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === assistantMessageId
                                            ? { ...m, content: accContent }
                                            : m
                                    )
                                );
                            }

                            if (parsed.type === "reasoning" && parsed.reasoning) {
                                accReasoning += parsed.reasoning;
                                setState((s) => ({ ...s, reasoning: accReasoning }));
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === assistantMessageId
                                            ? { ...m, reasoning: accReasoning }
                                            : m
                                    )
                                );
                            }

                            if (parsed.type === "tool_call") {
                                const tc: ToolCallEvent = {
                                    id: parsed.id || `tc-${Date.now()}`,
                                    name: parsed.name,
                                    arguments: parsed.arguments || {},
                                    result: null,
                                    durationMs: null,
                                    timestamp: Date.now(),
                                };
                                toolCalls.push(tc);
                                setState((s) => ({ ...s, toolCalls: [...toolCalls] }));
                            }

                            if (parsed.type === "tool_result") {
                                const existing = toolCalls.find((t) => t.id === parsed.tool_call_id);
                                if (existing) {
                                    existing.result = parsed.result;
                                    existing.durationMs = parsed.durationMs || null;
                                    setState((s) => ({ ...s, toolCalls: [...toolCalls] }));
                                }
                            }

                            if (parsed.type === "metrics" && parsed.metrics) {
                                finalMetrics = parsed.metrics;
                                setState((s) => ({ ...s, metrics: finalMetrics }));
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === assistantMessageId
                                            ? { ...m, metrics: finalMetrics! }
                                            : m
                                    )
                                );
                            }
                        } catch {
                            // Skip invalid JSON
                        }
                    }
                }

                // Store final tool calls on the message
                if (toolCalls.length > 0) {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMessageId
                                ? { ...m, toolCalls: [...toolCalls] }
                                : m
                        )
                    );
                }
            } else {
                // Non-streaming fallback
                const data = await res.json();
                const content = data.content || "";
                const reasoning = data.reasoning || "";
                const metrics = data.metrics || null;

                setState({
                    content,
                    reasoning,
                    toolCalls: [],
                    metrics,
                    isStreaming: false,
                });

                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantMessageId
                            ? { ...m, content, reasoning, metrics }
                            : m
                    )
                );
            }
        } catch (err) {
            if ((err as Error).name === "AbortError") return;
            const errorMsg = `❌ Hata: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`;
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantMessageId ? { ...m, content: errorMsg } : m
                )
            );
        } finally {
            setState((s) => ({ ...s, isStreaming: false }));
        }
    }, [messages]);

    const abort = useCallback(() => {
        abortRef.current?.abort();
        setState((s) => ({ ...s, isStreaming: false }));
    }, []);

    const reset = useCallback(() => {
        abortRef.current?.abort();
        setMessages([]);
        setState(INITIAL_STATE);
    }, []);

    return { sendMessage, state, messages, setMessages, abort, reset };
}
