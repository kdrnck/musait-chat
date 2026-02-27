/* eslint-disable */
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Send, Zap, UserPlus, Loader2, Sparkles } from "lucide-react";

export default function ChatInput({
    conversationId,
    status,
}: {
    conversationId: Id<"conversations">;
    status: "active" | "handoff" | "archived";
}) {
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);

    const sendMessage = useMutation(api.messages.create);
    const updateStatus = useMutation(api.conversations.updateStatus);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim() || sending) return;

        setSending(true);
        try {
            await sendMessage({
                conversationId,
                content: text.trim(),
                role: "human",
                status: "pending",
            });
            setText("");
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    const handleHandoffToggle = async () => {
        await updateStatus({
            id: conversationId,
            status: status === "handoff" ? "active" : "handoff",
        });
    };

    const isHandoff = status === "handoff";

    return (
        <div className="px-4 pb-6 pt-4 bg-[var(--color-bg-base)] border-t border-[var(--color-border)] z-20">
            <div className="max-w-4xl mx-auto flex flex-col gap-3">

                {/* Status Bar / Actions */}
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${isHandoff
                                ? 'bg-[var(--color-brand-light)] text-[var(--color-brand-dark)]'
                                : 'bg-[var(--color-surface-pure)] border border-[var(--color-border)] text-[var(--color-text-secondary)]'
                            }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isHandoff ? 'bg-[var(--color-brand-dark)] animate-pulse' : 'bg-[var(--color-border-hover)]'}`} />
                            <span className="text-[11px] font-semibold tracking-wide">
                                {isHandoff ? "İnsan Yöneticide" : "Yapay Zeka Yönetiyor"}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleHandoffToggle}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${isHandoff
                                ? "bg-[var(--color-surface-pure)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                                : "bg-[var(--color-surface-pure)] border border-[var(--color-border)] hover:border-[var(--color-brand-dark)] text-[var(--color-text-primary)] hover:shadow-sm"
                            }`}
                    >
                        {isHandoff ? (
                            <>
                                <Zap size={14} className="text-[var(--color-text-muted)]" />
                                <span>AI'ya Devret</span>
                            </>
                        ) : (
                            <>
                                <UserPlus size={14} className="text-[var(--color-brand-dark)]" />
                                <span>Görüşmeyi Devral</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Input Area */}
                <form
                    onSubmit={handleSend}
                    className={`relative bg-[var(--color-surface-pure)] border border-[var(--color-border)] focus-within:border-[var(--color-brand)] focus-within:ring-1 focus-within:ring-[var(--color-brand)] rounded-[20px] p-1.5 flex items-center transition-all duration-200 shadow-sm ${!isHandoff ? "bg-[var(--color-surface-hover)] cursor-not-allowed opacity-80" : ""
                        }`}
                >
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-[var(--color-text-muted)] ml-1">
                        {isHandoff ? <Sparkles size={18} className="text-[var(--color-brand-dark)]" /> : <Zap size={18} />}
                    </div>

                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={isHandoff ? "Mesajınızı yazın..." : "Mesaj yazmak için görüşmeyi devralmalısınız"}
                        disabled={!isHandoff}
                        className="flex-1 min-w-0 bg-transparent border-none outline-none py-2 px-1 text-[15px] font-normal text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:ring-0 disabled:text-[var(--color-text-muted)]"
                    />

                    <button
                        type="submit"
                        disabled={!text.trim() || sending || !isHandoff}
                        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ml-1 ${text.trim() && isHandoff
                                ? "bg-[var(--color-brand-dark)] text-white hover:bg-[var(--color-brand-dim)]"
                                : "bg-[var(--color-surface-hover)] text-[var(--color-border-hover)]"
                            }`}
                    >
                        {sending ? (
                            <Loader2 className="animate-spin" size={16} />
                        ) : (
                            <Send size={16} className={text.trim() && isHandoff ? "translate-x-0.5 -translate-y-0.5" : ""} />
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
