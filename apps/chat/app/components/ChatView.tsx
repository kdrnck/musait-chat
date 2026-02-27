"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useRef, useEffect, useState } from "react";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { ChevronLeft, Info, Phone, Calendar, User, MoreVertical, Search, Link2, ChevronDown } from "lucide-react";

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
        conversationId ? { conversationId } : "skip"
    );

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    if (!conversationId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in bg-[var(--color-surface-pure)] h-full">
                <div className="w-20 h-20 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center mb-6 relative group">
                    <img src="/musait-dark.png" alt="m" className="w-10 h-10 grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
                </div>
                <h2 className="text-[20px] font-semibold text-[var(--color-text-primary)] mb-2 tracking-tight">Sohbet Seçin</h2>
                <p className="text-[14px] text-[var(--color-text-secondary)] max-w-xs leading-relaxed">
                    Müşterilerinizle iletişime geçmek ve asistanı izlemek için soldan bir konuşma seçin.
                </p>
            </div>
        );
    }

    if (!conversation) return null;

    const hasAttention = (conversation.retryState?.count ?? 0) > 0;
    const isHandoff = conversation.status === "handoff";

    return (
        <div className="flex-1 flex flex-col h-full bg-[var(--color-bg-base)]">
            {/* ── Chat Header ── */}
            <header className="h-[72px] flex-shrink-0 flex items-center justify-between px-4 sm:px-6 z-20 bg-[var(--color-surface-pure)] border-b border-[var(--color-border)] shadow-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="md:hidden p-2 -ml-2 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>

                    <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center">
                            <User size={18} className="text-[var(--color-text-secondary)]" />
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--color-surface-pure)] flex items-center justify-center ${hasAttention ? 'bg-[var(--color-status-attention)]' :
                            isHandoff ? 'bg-[var(--color-status-handoff)]' : 'bg-[var(--color-status-ai)]'
                            }`}>
                        </div>
                    </div>

                    <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)] tracking-tight leading-none">
                                {conversation.customerPhone}
                            </h2>
                            {isHandoff && (
                                <span className="badge badge--handoff">İnsan Devraldı</span>
                            )}
                            {hasAttention && (
                                <span className="badge badge--attention">Hata</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                            <p className="text-[11px] font-medium text-[var(--color-text-secondary)] flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${isHandoff ? "bg-[var(--color-status-handoff)]" : "bg-[var(--color-brand-dark)]"} `} />
                                {isHandoff ? 'Yönetici Aktif' : 'Yapay Zeka Aktif'}
                            </p>
                            {isAdmin && (
                                <div className="relative ml-2 flex items-center">
                                    <div className="w-1 h-1 rounded-full bg-[var(--color-border)] mx-1"></div>
                                    <button
                                        onClick={() => setShowReassign(!showReassign)}
                                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-[var(--color-surface-hover)] transition-colors text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                    >
                                        <Link2 size={12} />
                                        {conversation.tenantId
                                            ? (allTenants?.find(t => t.id === conversation.tenantId)?.name ?? conversation.tenantId.slice(0, 8))
                                            : "İşletmeye Bağla"
                                        }
                                        <ChevronDown size={12} />
                                    </button>
                                    {showReassign && allTenants && allTenants.length > 0 && (
                                        <div className="absolute top-full left-0 mt-2 z-50 bg-[var(--color-surface-pure)] border border-[var(--color-border)] rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden min-w-[220px] animate-fade-in">
                                            <div className="px-3 py-2 text-[11px] font-semibold text-[var(--color-text-muted)] border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]/50">
                                                İşletme Değiştir
                                            </div>
                                            <div className="max-h-[300px] overflow-y-auto">
                                                {allTenants.map((t) => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => handleReassign(t.id)}
                                                        className={`w-full text-left px-3 py-2.5 text-[13px] hover:bg-[var(--color-surface-hover)] transition-colors ${conversation.tenantId === t.id ? "text-[var(--color-brand-dark)] font-medium bg-[var(--color-brand-light)]/50" : "text-[var(--color-text-primary)]"
                                                            }`}
                                                    >
                                                        {t.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                    <button className="hidden sm:flex p-2 rounded-xl hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                        <Search size={18} />
                    </button>
                    <button className="hidden sm:flex p-2 rounded-xl hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                        <Phone size={18} />
                    </button>
                    <button
                        onClick={onToggleCustomerPanel}
                        className={`p-2 rounded-xl transition-colors flex items-center gap-1.5 ${showCustomerPanel
                            ? "bg-[var(--color-brand-light)] text-[var(--color-brand-dark)]"
                            : "hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                            }`}
                        title="Müşteri Detayları"
                    >
                        <Info size={18} />
                    </button>
                    <div className="w-px h-5 bg-[var(--color-border)] mx-1" />
                    <button className="p-2 rounded-xl hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                        <MoreVertical size={18} />
                    </button>
                </div>
            </header>

            {/* ── Messages Area ── */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 py-6 content-scroll"
                style={{ scrollBehavior: 'smooth' }}
            >
                {/* Scroll padding-top */}
                <div className="h-4" />

                {!messages ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin border-[var(--color-brand-dark)]" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
                        <div className="w-14 h-14 rounded-full bg-[var(--color-surface-pure)] border border-[var(--color-border)] flex items-center justify-center mb-4">
                            <Calendar size={20} className="text-[var(--color-text-muted)]" />
                        </div>
                        <p className="text-[13px] font-medium text-[var(--color-text-muted)]">Henüz mesaj yok</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((m) => (
                            <MessageBubble key={m._id} message={m} debugMode={debugMode} />
                        ))}
                    </div>
                )}

                {/* Scroll padding-bottom */}
                <div className="h-4" />
            </div>

            {/* ── Chat Input ── */}
            <ChatInput conversationId={conversationId} status={conversation.status} />
        </div>
    );
}
