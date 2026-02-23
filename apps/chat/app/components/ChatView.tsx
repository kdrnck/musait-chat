"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { useEffect, useRef } from "react";
import { Bot, User, PanelRightOpen, PanelRightClose } from "lucide-react";

export default function ChatView({
    conversationId,
    onToggleCustomerPanel,
    showCustomerPanel,
}: {
    conversationId: Id<"conversations"> | null;
    onToggleCustomerPanel: () => void;
    showCustomerPanel: boolean;
}) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const conversation = useQuery(
        api.conversations.getById,
        conversationId ? { id: conversationId } : "skip"
    );

    const messages = useQuery(
        api.messages.listByConversation,
        conversationId ? { conversationId } : "skip"
    );

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (messages && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // Empty state — no conversation selected
    if (!conversationId) {
        return (
            <div
                className="flex-1 flex flex-col items-center justify-center gap-4"
                style={{ background: "var(--color-surface-base)" }}
            >
                <div
                    className="w-16 h-16 flex items-center justify-center glow"
                    style={{
                        background: "var(--color-brand-glow)",
                        border: "1px solid var(--color-border-brand)",
                    }}
                >
                    <Bot size={28} style={{ color: "var(--color-brand)" }} />
                </div>
                <div className="text-center">
                    <h2
                        className="text-lg font-bold tracking-wide"
                        style={{ color: "var(--color-text-primary)" }}
                    >
                        Konuşma Seçin
                    </h2>
                    <p
                        className="text-sm mt-1"
                        style={{ color: "var(--color-text-muted)" }}
                    >
                        Soldan bir konuşma seçerek başlayın
                    </p>
                </div>
            </div>
        );
    }

    const statusLabel =
        conversation?.status === "handoff"
            ? "İnsan Kontrolünde"
            : conversation?.retryState?.count && conversation.retryState.count > 0
                ? "Dikkat Gerekli"
                : "AI Aktif";

    const statusBadgeClass =
        conversation?.status === "handoff"
            ? "badge--handoff"
            : conversation?.retryState?.count && conversation.retryState.count > 0
                ? "badge--attention"
                : "badge--ai";

    return (
        <div
            className="flex-1 flex flex-col h-full"
            style={{ background: "var(--color-surface-base)" }}
        >
            {/* ── Chat Header ── */}
            <header
                className="flex items-center justify-between px-5 py-3 border-b"
                style={{
                    borderColor: "var(--color-border)",
                    background: "var(--color-surface-1)",
                }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-8 h-8 flex items-center justify-center"
                        style={{
                            background: "var(--color-surface-3)",
                            border: "1px solid var(--color-border)",
                        }}
                    >
                        <User size={14} style={{ color: "var(--color-text-secondary)" }} />
                    </div>
                    <div>
                        <span
                            className="text-sm font-semibold"
                            style={{
                                color: "var(--color-text-primary)",
                                fontFamily: "var(--font-mono)",
                            }}
                        >
                            {conversation?.customerPhone || "..."}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={`badge ${statusBadgeClass}`}>
                                {statusLabel}
                            </span>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onToggleCustomerPanel}
                    className="p-2 transition-colors"
                    style={{ color: "var(--color-text-muted)" }}
                    onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "var(--color-brand)")
                    }
                    onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "var(--color-text-muted)")
                    }
                    title={showCustomerPanel ? "Paneli kapat" : "Paneli aç"}
                >
                    {showCustomerPanel ? (
                        <PanelRightClose size={18} />
                    ) : (
                        <PanelRightOpen size={18} />
                    )}
                </button>
            </header>

            {/* ── Messages ── */}
            <div
                className="flex-1 overflow-y-auto px-6 py-4"
                style={{ background: "var(--color-surface-base)" }}
            >
                {!messages ? (
                    // Loading
                    <div className="flex flex-col gap-3">
                        {[...Array(4)].map((_, i) => (
                            <div
                                key={i}
                                className="animate-pulse"
                                style={{
                                    height: 48,
                                    width: i % 2 === 0 ? "60%" : "45%",
                                    marginLeft: i % 2 !== 0 ? "auto" : 0,
                                    background: "var(--color-surface-2)",
                                }}
                            />
                        ))}
                    </div>
                ) : messages.length === 0 ? (
                    // Empty messages
                    <div className="flex items-center justify-center h-full">
                        <p
                            className="text-sm"
                            style={{ color: "var(--color-text-muted)" }}
                        >
                            Henüz mesaj yok
                        </p>
                    </div>
                ) : (
                    // Message bubbles
                    <div className="flex flex-col gap-2">
                        {messages.map((message, i) => (
                            <div
                                key={message._id}
                                className="animate-fade-in"
                                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                            >
                                <MessageBubble message={message} />
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* ── Input Area ── */}
            <ChatInput
                conversationId={conversationId}
                conversationStatus={conversation?.status ?? "active"}
            />
        </div>
    );
}
