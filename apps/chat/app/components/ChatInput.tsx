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
    status: "active" | "handoff";
}) {
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    
    const sendMessage = useMutation(api.messages.send);
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
        <div className="px-6 py-6 pb-8 bg-gradient-to-t from-[var(--color-surface-base)] via-[var(--color-surface-base)] to-transparent z-20">
            <div className="max-w-4xl mx-auto space-y-4">
                
                {/* Status Bar / Actions */}
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all ${
                            isHandoff 
                            ? 'bg-[var(--color-brand-light)] border-[var(--color-brand-glow-strong)] text-[var(--color-brand-dim)]' 
                            : 'bg-white border-black/5 text-[var(--color-text-muted)]'
                        }`}>
                            <div className={`w-2 h-2 rounded-full ${isHandoff ? 'bg-[var(--color-brand-dim)] animate-pulse' : 'bg-gray-300'}`} />
                            <span className="text-[11px] font-bold uppercase tracking-wider">
                                {isHandoff ? "İnsan Modu Aktif" : "Yapay Zeka Yönetiyor"}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleHandoffToggle}
                        className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[12px] font-bold transition-all ${
                            isHandoff
                            ? "bg-white border border-black/5 text-[var(--color-text-primary)] hover:bg-black/5"
                            : "bg-[var(--color-brand)] text-[#111111] shadow-xl shadow-[var(--color-brand-glow)] hover:scale-105"
                        }`}
                    >
                        {isHandoff ? (
                            <>
                                <Zap size={14} />
                                <span>AI'yı Devam Ettir</span>
                            </>
                        ) : (
                            <>
                                <UserPlus size={14} />
                                <span>Görüşmeyi Devral</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Input Area */}
                <form 
                    onSubmit={handleSend}
                    className={`relative glass-pill p-2 flex items-center gap-2 transition-all duration-300 border ${
                        !isHandoff && !text ? "opacity-60 grayscale-[0.5]" : "opacity-100"
                    }`}
                >
                    <div className="w-12 h-12 flex items-center justify-center text-[var(--color-text-muted)]">
                        {isHandoff ? <Sparkles size={20} className="text-[var(--color-brand-dim)]" /> : <Zap size={20} />}
                    </div>
                    
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={isHandoff ? "Mesajınızı yazın..." : "Mesaj yazmak için önce görüşmeyi devralın"}
                        disabled={!isHandoff}
                        className="flex-1 bg-transparent border-none outline-none py-4 px-2 text-[15px] font-medium text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] placeholder:font-normal"
                    />

                    <button
                        type="submit"
                        disabled={!text.trim() || sending || !isHandoff}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                            text.trim() && isHandoff
                            ? "bg-[var(--color-brand)] text-[#111111] shadow-lg shadow-[var(--color-brand-glow)] scale-100 rotate-0" 
                            : "bg-black/[0.03] text-[var(--color-text-muted)] scale-90"
                        }`}
                    >
                        {sending ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <Send size={20} className={text.trim() && isHandoff ? "translate-x-0.5 -translate-y-0.5" : ""} />
                        )}
                    </button>
                </form>

                {!isHandoff && (
                    <p className="text-center text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest animate-fade-in">
                        Asistan şu an müşteriye cevap veriyor
                    </p>
                )}
            </div>
        </div>
    );
}
