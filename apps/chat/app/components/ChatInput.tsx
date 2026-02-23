"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState } from "react";
import { Send, Hand, Play } from "lucide-react";

export default function ChatInput({
    conversationId,
    conversationStatus,
}: {
    conversationId: Id<"conversations">;
    conversationStatus: "active" | "archived" | "handoff";
}) {
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);

    const sendMessage = useMutation(api.messages.create);
    const disableAgent = useMutation(api.conversations.disableAgent);
    const enableAgent = useMutation(api.conversations.enableAgent);

    const isHandoff = conversationStatus === "handoff";
    const canSend = isHandoff && text.trim().length > 0;

    const handleSend = async () => {
        if (!canSend || sending) return;
        setSending(true);
        try {
            await sendMessage({
                conversationId,
                role: "human",
                content: text.trim(),
                status: "pending",
            });
            setText("");
        } catch (err) {
            console.error("Failed to send message:", err);
        } finally {
            setSending(false);
        }
    };

    const handleTakeOver = async () => {
        try {
            // Disable agent for 24 hours
            await disableAgent({
                id: conversationId,
                disabledUntilMs: Date.now() + 24 * 60 * 60 * 1000,
            });
        } catch (err) {
            console.error("Failed to take over:", err);
        }
    };

    const handleResumeAI = async () => {
        try {
            await enableAgent({ id: conversationId });
        } catch (err) {
            console.error("Failed to resume AI:", err);
        }
    };

    return (
        <div
            className="border-t px-4 py-3"
            style={{
                borderColor: "var(--color-border)",
                background: "var(--color-surface-1)",
            }}
        >
            {/* Handoff controls */}
            <div className="flex items-center gap-2 mb-3">
                {!isHandoff ? (
                    <button
                        onClick={handleTakeOver}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all"
                        style={{
                            background: "transparent",
                            border: "1px solid var(--color-border-brand)",
                            color: "var(--color-brand)",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--color-brand-glow)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                        }}
                    >
                        <Hand size={14} />
                        Devral
                    </button>
                ) : (
                    <button
                        onClick={handleResumeAI}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all"
                        style={{
                            background: "var(--color-brand)",
                            color: "var(--color-surface-base)",
                            border: "1px solid var(--color-brand)",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--color-brand-dim)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "var(--color-brand)";
                        }}
                    >
                        <Play size={14} />
                        AI&apos;ı Devam Ettir
                    </button>
                )}

                {isHandoff && (
                    <span
                        className="text-[10px] uppercase tracking-wider"
                        style={{
                            color: "var(--color-status-handoff)",
                            fontFamily: "var(--font-mono)",
                        }}
                    >
                        ● İnsan kontrolünde
                    </span>
                )}
            </div>

            {/* Text input */}
            <div
                className="flex items-center gap-2"
                style={{
                    background: "var(--color-surface-2)",
                    border: `1px solid ${isHandoff ? "var(--color-border-brand)" : "var(--color-border)"}`,
                    opacity: isHandoff ? 1 : 0.5,
                }}
            >
                <input
                    type="text"
                    placeholder={
                        isHandoff
                            ? "Mesajınızı yazın..."
                            : "Mesaj göndermek için önce devralın"
                    }
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    disabled={!isHandoff}
                    className="flex-1 bg-transparent outline-none px-4 py-3 text-sm placeholder:text-[var(--color-text-muted)]"
                    style={{ color: "var(--color-text-primary)" }}
                />
                <button
                    onClick={handleSend}
                    disabled={!canSend || sending}
                    className="flex items-center justify-center w-10 h-10 mr-1 transition-all"
                    style={{
                        background: canSend ? "var(--color-brand)" : "transparent",
                        color: canSend
                            ? "var(--color-surface-base)"
                            : "var(--color-text-muted)",
                        cursor: canSend ? "pointer" : "not-allowed",
                    }}
                >
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
}
