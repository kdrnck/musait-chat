"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useRef, useEffect, useState } from "react";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { ChevronLeft, Info, Phone, Calendar, User, MoreVertical, Search, Link2, ChevronDown, Bot } from "lucide-react";

export default function ChatView({
    conversationId,
    onToggleCustomerPanel,
    showCustomerPanel,
    debugMode,
    onBack,
    isAdmin,
    allTenants,
}: {
    conversationId: Id<"conversations"> | null;
    onToggleCustomerPanel: () => void;
    showCustomerPanel: boolean;
    debugMode: boolean;
    onBack: () => void;
    isAdmin?: boolean;
    allTenants?: { id: string; name: string; logo_url: string | null }[];
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showReassign, setShowReassign] = useState(false);
    const bindToTenant = useMutation(api.conversations.bindToTenant);

    const handleReassign = async (tenantId: string) => {
        if (!conversationId) return;
        await bindToTenant({ id: conversationId, tenantId });
        setShowReassign(false);
    };

    const conversation = useQuery(
        api.conversations.getById,
        conversationId ? { id: conversationId } : "skip"
    );

    const messages = useQuery(
        api.messages.listByConversation,
        conversationId ? { conversationId, isAdmin: isAdmin ?? false } : "skip"
    );

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    if (!conversationId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in bg-[var(--color-chat-bg)] h-full">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] flex items-center justify-center mb-5 shadow-sm">
                    <img src="/musait-dark.png" alt="m" className="w-8 h-8 opacity-50 invert" />
                </div>
                <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)] mb-2 tracking-tight">
                    Bir sohbet seçin
                </h2>
                <p className="text-[13px] text-[var(--color-text-muted)] max-w-[260px] leading-relaxed">
                    Müşterilerle iletişime geçmek ve AI asistanı izlemek için soldan bir konuşma seçin.
                </p>
            </div>
        );
    }

    if (!conversation) return null;

    const hasAttention = (conversation.retryState?.count ?? 0) > 0;
    const isHandoff = conversation.status === "handoff";

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* ── Chat Header ── */}
            <header className="h-[60px] flex-shrink-0 flex items-center justify-between px-4 z-20 bg-[var(--color-surface-elevated)] border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2.5">
                    {/* Mobile back */}
                    <button
                        onClick={onBack}
                        className="md:hidden btn-ghost -ml-1"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    {/* Avatar with status */}
                    <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center">
                            <User size={16} className="text-[var(--color-text-muted)]" />
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-surface-pure)] ${
                            hasAttention
                                ? "bg-[var(--color-status-attention)]"
                                : isHandoff
                                ? "bg-[var(--color-status-handoff)]"
                                : "bg-[var(--color-status-ai)]"
                        }`} />
                    </div>

                    {/* Name + status */}
                    <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-none">
                                {conversation.customerPhone}
                            </h2>
                            {isHandoff && <span className="badge badge--handoff">İnsan Devraldı</span>}
                            {hasAttention && <span className="badge badge--attention">Hata</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                isHandoff ? "bg-[var(--color-status-handoff)]" : "bg-[var(--color-brand)]"
                            }`} />
                            <span className="text-[11px] text-[var(--color-text-muted)]">
                                {isHandoff ? "Yönetici Aktif" : "Yapay Zeka Aktif"}
                            </span>

                            {/* Admin tenant reassign */}
                            {isAdmin && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowReassign(!showReassign)}
                                            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                                        >
                                            <Link2 size={11} />
                                            {conversation.tenantId
                                                ? (allTenants?.find(t => t.id === conversation.tenantId)?.name ?? conversation.tenantId.slice(0, 8))
                                                : "İşletmeye Bağla"
                                            }
                                            <ChevronDown size={11} />
                                        </button>
                                        {showReassign && allTenants && allTenants.length > 0 && (
                                            <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden min-w-[200px] animate-fade-in">
                                                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
                                                    İşletme Değiştir
                                                </div>
                                                <div className="max-h-[240px] overflow-y-auto">
                                                    {allTenants.map((t) => (
                                                        <button
                                                            key={t.id}
                                                            onClick={() => handleReassign(t.id)}
                                                            className={`w-full text-left px-3 py-2.5 text-[13px] hover:bg-[var(--color-surface-hover)] transition-colors ${
                                                                conversation.tenantId === t.id
                                                                    ? "text-[var(--color-brand-dark)] font-semibold bg-[var(--color-brand-light)]"
                                                                    : "text-[var(--color-text-primary)]"
                                                            }`}
                                                        >
                                                            {t.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                    <button className="hidden sm:flex btn-ghost">
                        <Search size={17} />
                    </button>
                    <button className="hidden sm:flex btn-ghost">
                        <Phone size={17} />
                    </button>
                    <button
                        onClick={onToggleCustomerPanel}
                        className={`btn-ghost xl:hidden ${showCustomerPanel ? "bg-[var(--color-brand-light)] text-[var(--color-brand)] hover:bg-[var(--color-brand-light)]" : ""}`}
                        title="Müşteri Detayları"
                    >
                        <Info size={17} />
                    </button>
                    <div className="w-px h-4 bg-[var(--color-border)] mx-1" />
                    <button className="btn-ghost">
                        <MoreVertical size={17} />
                    </button>
                </div>
            </header>

            {/* ── Messages Area ── */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 md:px-8 py-4"
                style={{ scrollBehavior: "smooth" }}
            >
                <div className="h-2" />

                {!messages ? (
                    <div className="flex justify-center py-20">
                        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin border-[var(--color-brand-dim)]" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                        <div className="w-12 h-12 rounded-full bg-[var(--color-surface-pure)] border border-[var(--color-border)] flex items-center justify-center mb-3">
                            <Calendar size={18} className="text-[var(--color-text-muted)]" />
                        </div>
                        <p className="text-[13px] text-[var(--color-text-muted)]">Henüz mesaj yok</p>
                    </div>
                ) : (
                    <div className="space-y-1.5 min-w-0 w-full">
                        {messages.map((m, i) => (
                            <MessageBubble
                                key={m._id}
                                message={m}
                                debugMode={debugMode}
                                prevRole={i > 0 ? messages[i - 1].role : null}
                            />
                        ))}

                        {/* Typing indicator when AI is processing */}
                        {messages.some(m => m.status === "processing") && (
                            <div className="flex justify-center my-3">
                                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-system-chip)] border border-[var(--color-system-chip-border)]">
                                    <Bot size={13} className="text-[var(--color-brand)]" />
                                    <span className="text-[12px] text-[var(--color-text-secondary)]">AI yanıt hazırlıyor</span>
                                    <div className="flex items-center gap-0.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="h-4" />
            </div>

            {/* ── Chat Input ── */}
            <ChatInput conversationId={conversationId} status={conversation.status} />
        </div>
    );
}
