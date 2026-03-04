"use client";

import { useRef, useEffect } from "react";
import { Send, Bot } from "lucide-react";
import type { ChatMessage } from "./useTestLabStream";

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
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-[var(--color-bg-base)]">
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
                    messages.map((m) => (
                        <div
                            key={m.id}
                            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
                        >
                            <div
                                className={`px-4 py-3 max-w-[80%] rounded-2xl text-[14px] leading-relaxed break-words border ${
                                    m.role === "user"
                                        ? "bg-[var(--color-customer-bg)] border-[var(--color-customer-border)] text-[var(--color-text-primary)] rounded-tr-sm"
                                        : "bg-[var(--color-agent-bg)] border-[var(--color-agent-border)] text-[var(--color-text-primary)] rounded-tl-sm"
                                }`}
                            >
                                {m.content || (m.role === "assistant" && isStreaming ? "" : "(boş yanıt)")}
                            </div>
                        </div>
                    ))
                )}

                {isStreaming && (
                    <div className="flex justify-start animate-fade-in">
                        <div className="px-4 py-3 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-tl-sm flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-bounce" />
                        </div>
                    </div>
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
