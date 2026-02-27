"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { ChevronLeft, Info, Phone, Calendar, User, MoreVertical, Search } from "lucide-react";

export default function ChatView({
    conversationId,
    onToggleCustomerPanel,
    showCustomerPanel,
    debugMode,
    onBack,
}: {
    conversationId: Id<"conversations"> | null;
    onToggleCustomerPanel: () => void;
    showCustomerPanel: boolean;
    debugMode: boolean;
    onBack: () => void;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const conversation = useQuery(
        api.conversations.getById,
        conversationId ? { id: conversationId } : "skip"
    );

    const messages = useQuery(
        api.messages.listByConversation,
        conversationId ? { conversationId } : "skip"
    );

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    if (!conversationId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in"
                 style={{ background: "var(--color-surface-base)" }}>
                <div className="w-24 h-24 rounded-[40px] bg-white shadow-2xl flex items-center justify-center mb-8 relative group">
                    <img src="/musait-dark.png" alt="m" className="w-12 h-12 grayscale opacity-10 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-black/[0.01] to-black/[0.03] rounded-[40px]" />
                </div>
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3 tracking-tight">Sohbet Seçin</h2>
                <p className="text-[var(--color-text-secondary)] max-w-xs leading-relaxed font-medium">
                    Müşterilerle iletişime geçmek ve asistanı izlemek için soldan bir konuşma seçin.
                </p>
            </div>
        );
    }

    if (!conversation) return null;

    const hasAttention = (conversation.retryState?.count ?? 0) > 0;
    const isHandoff = conversation.status === "handoff";

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--color-surface-base)]">
            {/* ── Chat Header ── */}
            <header className="h-20 flex-shrink-0 flex items-center justify-between px-6 z-20 glass-light border-b border-black/[0.05] shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="md:hidden p-2.5 rounded-2xl hover:bg-black/5 transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    
                    <div className="relative">
                        <div className="w-11 h-11 rounded-2xl bg-white shadow-md border border-black/[0.05] flex items-center justify-center">
                            <User size={20} className="text-[var(--color-text-secondary)]" />
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-lg border-2 border-white flex items-center justify-center ${
                            hasAttention ? 'bg-[var(--color-status-attention)]' : 
                            isHandoff ? 'bg-[var(--color-status-handoff)]' : 'bg-[var(--color-status-ai)]'
                        }`}>
                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-[16px] font-bold text-[var(--color-text-primary)] tracking-tight leading-none">
                                {conversation.customerPhone}
                            </h2>
                            {isHandoff && (
                                <span className="badge badge--handoff !py-0.5">İnsan</span>
                            )}
                            {hasAttention && (
                                <span className="badge badge--attention !py-0.5">Hata</span>
                            )}
                        </div>
                        <p className="text-[11px] font-bold text-[var(--color-text-muted)] mt-1.5 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-status-ai)]" />
                            {isHandoff ? 'Yönetici Devraldı' : 'Yapay Zeka Aktif'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button className="hidden sm:flex p-3 rounded-2xl hover:bg-black/5 text-[var(--color-text-secondary)] transition-all">
                        <Search size={18} />
                    </button>
                    <button className="hidden sm:flex p-3 rounded-2xl hover:bg-black/5 text-[var(--color-text-secondary)] transition-all">
                        <Phone size={18} />
                    </button>
                    <button
                        onClick={onToggleCustomerPanel}
                        className={`p-3 rounded-2xl transition-all ${
                            showCustomerPanel 
                            ? "bg-[var(--color-brand)] text-[#111111] shadow-lg shadow-[var(--color-brand-glow)]" 
                            : "hover:bg-black/5 text-[var(--color-text-secondary)]"
                        }`}
                        title="Müşteri Detayları"
                    >
                        <Info size={18} />
                    </button>
                    <div className="w-px h-6 bg-black/[0.05] mx-2" />
                    <button className="p-3 rounded-2xl hover:bg-black/5 text-[var(--color-text-secondary)] transition-all">
                        <MoreVertical size={18} />
                    </button>
                </div>
            </header>

            {/* ── Messages Area ── */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-6 py-8 content-scroll space-y-2"
                style={{ scrollBehavior: 'smooth' }}
            >
                {/* Scroll padding-top */}
                <div className="h-4" />
                
                {!messages ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin border-[var(--color-brand)]" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                        <div className="w-16 h-16 rounded-3xl bg-white border border-black/5 shadow-sm flex items-center justify-center mb-6">
                            <Calendar size={24} className="text-[var(--color-text-muted)] opacity-20" />
                        </div>
                        <p className="text-[14px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Henüz mesaj yok</p>
                    </div>
                ) : (
                    messages.map((m) => (
                        <MessageBubble key={m._id} message={m} debugMode={debugMode} />
                    ))
                )}
                
                {/* Scroll padding-bottom */}
                <div className="h-8" />
            </div>

            {/* ── Chat Input ── */}
            <ChatInput conversationId={conversationId} status={conversation.status} />
        </div>
    );
}
