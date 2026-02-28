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
        <div className="px-4 pb-4 pt-3 bg-[var(--color-surface-elevated)] border-t border-[var(--color-border)]">
            <div className="max-w-3xl mx-auto flex flex-col gap-2.5">

                {/* Status + Handoff toggle row */}
                <div className="flex items-center justify-between">
                    {/* Status indicator */}
                    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold ${
                        isHandoff
                            ? "bg-[rgba(59,130,246,0.12)] border-[rgba(59,130,246,0.25)] text-blue-400"
                            : "bg-[var(--color-surface-hover)] border-[var(--color-border)] text-[var(--color-text-muted)]"
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                            isHandoff ? "bg-blue-400 animate-pulse" : "bg-[var(--color-border-hover)]"
                        }`} />
                        {isHandoff ? "İnsan Yönetiminde" : "Yapay Zeka Yönetiyor"}
                    </div>

                    {/* Handoff toggle button */}
                    <button
                        onClick={handleHandoffToggle}
                        className={isHandoff
                            ? "btn-secondary gap-1.5 px-3 py-1.5 text-[12px]"
                            : "btn-primary gap-1.5 px-3 py-1.5 text-[12px]"
                        }
                    >
                        {isHandoff ? (
                            <>
                                <Zap size={13} />
                                <span>AI'ya Devret</span>
                            </>
                        ) : (
                            <>
                                <UserPlus size={13} />
                                <span>Görüşmeyi Devral</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Input area */}
                <form
                    onSubmit={handleSend}
                    className={`flex items-center gap-2 bg-[var(--color-surface-hover)] border rounded-2xl px-3 py-2 transition-all duration-150 ${
                        isHandoff
                            ? "border-[var(--color-border)] focus-within:border-[var(--color-brand)] focus-within:ring-2 focus-within:ring-[rgba(34,197,94,0.15)] focus-within:bg-[var(--color-surface-pure)]"
                            : "border-[var(--color-border)] opacity-60"
                    }`}
                >
                    <div className="flex-shrink-0 w-8 flex items-center justify-center text-[var(--color-text-muted)]">
                        {isHandoff
                            ? <Sparkles size={16} className="text-[var(--color-brand-dim)]" />
                            : <Zap size={16} />
                        }
                    </div>

                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={isHandoff ? "Mesajınızı yazın..." : "Görüşmeyi devralarak mesaj gönderebilirsiniz"}
                        disabled={!isHandoff}
                        className="flex-1 bg-transparent border-none outline-none py-1.5 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:ring-0 disabled:cursor-not-allowed"
                    />

                    <button
                        type="submit"
                        disabled={!text.trim() || sending || !isHandoff}
                        className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 ${
                            text.trim() && isHandoff
                                ? "bg-[var(--color-brand)] text-black hover:bg-[#16A34A]"
                                : "bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed"
                        }`}
                    >
                        {sending
                            ? <Loader2 className="animate-spin" size={15} />
                            : <Send size={15} className={text.trim() && isHandoff ? "translate-x-0.5 -translate-y-0.5" : ""} />
                        }
                    </button>
                </form>
            </div>
        </div>
    );
}
