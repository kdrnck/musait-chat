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

/** A single inline event that shows up in the chat stream */
export type StreamEvent =
    | { type: "thinking"; content: string; done: boolean }
    | { type: "tool_call"; id: string; name: string; arguments: Record<string, unknown> }
    | { type: "tool_result"; id: string; name: string; result: unknown; durationMs: number | null }
    | { type: "content"; content: string };

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
    /** Ordered list of stream events for inline rendering */
    streamEvents?: StreamEvent[];
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
            { id: assistantMessageId, role: "assistant", content: "", streamEvents: [] },
        ]);

        try {
            const res = await fetch("/api/admin/model-test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    // Limit to the last 20 messages to prevent context overflow.
                    // In long Test Lab sessions, old tool results accumulate and
                    // increase token cost + hallucination risk.
                    messages: [...messages, userMessage].slice(-20).map((m) => ({
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
                const streamEvents: StreamEvent[] = [];

                /** Helper to push a stream event and update the message */
                const pushEvent = (event: StreamEvent) => {
                    streamEvents.push(event);
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMessageId
                                ? { ...m, streamEvents: [...streamEvents] }
                                : m
                        )
                    );
                };

                /** Update thinking event — merge content into the last thinking event or create new */
                const appendThinking = (chunk: string) => {
                    accReasoning += chunk;
                    // Find or create thinking event
                    const lastThinking = streamEvents.findLast(
                        (e) => e.type === "thinking"
                    );
                    if (lastThinking && lastThinking.type === "thinking" && !lastThinking.done) {
                        lastThinking.content = accReasoning;
                    } else {
                        streamEvents.push({ type: "thinking", content: accReasoning, done: false });
                    }
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMessageId
                                ? { ...m, reasoning: accReasoning, streamEvents: [...streamEvents] }
                                : m
                        )
                    );
                };

                /** Finalize thinking block */
                const finalizeThinking = () => {
                    if (accReasoning) {
                        const lastThinking = streamEvents.findLast(
                            (e) => e.type === "thinking"
                        );
                        if (lastThinking && lastThinking.type === "thinking") {
                            lastThinking.done = true;
                        }
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantMessageId
                                    ? { ...m, streamEvents: [...streamEvents] }
                                    : m
                            )
                        );
                    }
                };

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
                                // First content after reasoning → finalize thinking
                                if (accReasoning && !streamEvents.some(e => e.type === "thinking" && e.type === "thinking" && (e as any).done)) {
                                    finalizeThinking();
                                }
                                accContent += parsed.content;
                                setState((s) => ({ ...s, content: accContent }));

                                // Find or create the last content event
                                const lastContent = streamEvents.findLast(e => e.type === "content");
                                if (lastContent && lastContent.type === "content") {
                                    lastContent.content = accContent;
                                } else {
                                    streamEvents.push({ type: "content", content: accContent });
                                }
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === assistantMessageId
                                            ? { ...m, content: accContent, streamEvents: [...streamEvents] }
                                            : m
                                    )
                                );
                            }

                            if (parsed.type === "reasoning" && parsed.reasoning) {
                                appendThinking(parsed.reasoning);
                                setState((s) => ({ ...s, reasoning: accReasoning }));
                            }

                            if (parsed.type === "tool_call") {
                                // Finalize thinking before tool calls
                                finalizeThinking();
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
                                pushEvent({
                                    type: "tool_call",
                                    id: tc.id,
                                    name: tc.name,
                                    arguments: tc.arguments,
                                });
                            }

                            if (parsed.type === "tool_result") {
                                const existing = toolCalls.find((t) => t.id === parsed.tool_call_id);
                                if (existing) {
                                    existing.result = parsed.result;
                                    existing.durationMs = parsed.durationMs || null;
                                    setState((s) => ({ ...s, toolCalls: [...toolCalls] }));
                                }
                                pushEvent({
                                    type: "tool_result",
                                    id: parsed.tool_call_id || parsed.id,
                                    name: parsed.name,
                                    result: parsed.result,
                                    durationMs: parsed.durationMs || null,
                                });
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

                // Finalize thinking if still open
                finalizeThinking();

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
