"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useRef, useEffect, useState, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import ChatInput, { OptimisticMessage } from "./ChatInput";
import { ChevronLeft, Info, Calendar, User, Link2, ChevronDown, Bot, Clock, History, Archive } from "lucide-react";

function formatSessionDate(ts: number): string {
    return new Date(ts).toLocaleDateString("tr-TR", {
        day: "numeric", month: "long", year: "numeric",
    });
}

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
    const activeSectionRef = useRef<HTMLDivElement>(null);
    const [showReassign, setShowReassign] = useState(false);
    const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
    const [customerDisplayName, setCustomerDisplayName] = useState<string | null>(null);
    const [olderSessionsEnabled, setOlderSessionsEnabled] = useState(false);
    const updateConversation = useMutation(api.conversations.update);
    const prevMessagesLengthRef = useRef(0);

    // Query data first before using in effects
    const conversation = useQuery(
        api.conversations.getById,
        conversationId ? { id: conversationId } : "skip"
    );

    const messages = useQuery(
        api.messages.listByConversation,
        conversationId ? { conversationId, isAdmin: isAdmin ?? false } : "skip"
    );

    // Lazy: only fires after user clicks "Load older sessions"
    const olderSessions = useQuery(
        api.conversations.getArchivedSessionsWithMessages,
        olderSessionsEnabled && conversation?.tenantId && conversation?.customerPhone
            ? { customerPhone: conversation.customerPhone, tenantId: conversation.tenantId }
            : "skip"
    );

    // Reset per-conversation state when switching conversations
    useEffect(() => {
        setOlderSessionsEnabled(false);
        setCustomerDisplayName(null);
        prevMessagesLengthRef.current = 0;
    }, [conversationId]);

    // Fetch Supabase customer name
    useEffect(() => {
        if (!conversation?.customerPhone) return;
        fetch("/api/customer-names", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phones: [conversation.customerPhone] }),
        })
            .then(res => res.json())
            .then(data => {
                const name = data.names?.[conversation.customerPhone];
                if (name) setCustomerDisplayName(name);
            })
            .catch(() => { });
    }, [conversation?.customerPhone, conversation?.tenantId]);    const handleOptimisticSend = useCallback((message: OptimisticMessage, clearCallback: () => void) => {
        setOptimisticMessages(prev => [...prev, message]);
        // Auto-clear after 5 seconds (real message should arrive before then via Convex)
        setTimeout(() => {
            setOptimisticMessages(prev => prev.filter(m => m.id !== message.id));
        }, 5000);
    }, []);

    // Clear optimistic messages when real messages arrive
    useEffect(() => {
        if (messages && messages.length > 0 && optimisticMessages.length > 0) {
            // Check if any optimistic message content matches a real message
            const lastRealMessage = messages[messages.length - 1];
            setOptimisticMessages(prev => 
                prev.filter(om => {
                    // Remove optimistic message if a real message with same content arrived recently
                    const matchingReal = messages.find(m => 
                        m.content === om.content && 
                        m.role === "human" &&
                        (m.createdAt ?? 0) > om.createdAt - 1000
                    );
                    return !matchingReal;
                })
            );
        }
    }, [messages, optimisticMessages.length]);

    const handleReassign = async (tenantId: string) => {
        if (!conversationId) return;
        await updateConversation({ id: conversationId, tenantId });
        setShowReassign(false);
    };

    // Scroll to bottom ONLY when new messages arrive (not when older sessions load)
    useEffect(() => {
        if (!messages) return;
        const newLen = messages.length;
        if (newLen > prevMessagesLengthRef.current) {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
        }
        prevMessagesLengthRef.current = newLen;
    }, [messages]);

    // When older sessions finish loading, scroll the active-session divider into view
    const olderSessionsLoaded = olderSessions !== undefined && olderSessionsEnabled;
    useEffect(() => {
        if (olderSessionsLoaded && activeSectionRef.current) {
            activeSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [olderSessionsLoaded]);

    if (!conversationId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in bg-[var(--color-chat-bg)] h-full">
                <div className="max-w-[360px]">
                    {/* Logo */}
                    <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] flex items-center justify-center mb-5 shadow-sm mx-auto">
                        <img src="/musait-dark.png" alt="m" className="w-8 h-8 opacity-50 invert" />
                    </div>
                    
                    {/* Title */}
                    <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)] mb-2 tracking-tight">
                        Hoş Geldiniz
                    </h2>
                    <p className="text-[13px] text-[var(--color-text-muted)] max-w-[260px] leading-relaxed mx-auto mb-8">
                        Müşterilerle iletişime geçmek ve AI asistanı izlemek için soldan bir konuşma seçin.
                    </p>

                    {/* Quick Tips */}
                    <div className="space-y-3 text-left">
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)]">
                            <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-light)] flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Bot size={14} className="text-[var(--color-brand)]" />
                            </div>
                            <div>
                                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">AI Otomatik Yanıt</p>
                                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                                    Yapay zeka müşteri sorularını otomatik yanıtlar
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)]">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <User size={14} className="text-blue-400" />
                            </div>
                            <div>
                                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">İnsan Devralma</p>
                                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                                    İstediğiniz zaman sohbeti devralabilirsiniz
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)]">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Info size={14} className="text-amber-400" />
                            </div>
                            <div>
                                <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Dikkat Gerektiren</p>
                                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                                    Kırmızı işaretli sohbetlere öncelik verin
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!conversation) return null;

    const hasAttention = (conversation.retryState?.count ?? 0) > 0;
    const isHandoff = conversation.status === "handoff";

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* ── Chat Header ── */}
            <header className="h-[64px] flex-shrink-0 flex items-center justify-between px-5 z-20 bg-[var(--color-surface-elevated)] border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                    {/* Mobile back */}
                    <button
                        onClick={onBack}
                        className="md:hidden btn-icon !w-10 !h-10 -ml-1"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    {/* Avatar with status */}
                    <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center">
                            <User size={18} className="text-[var(--color-text-muted)]" />
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--color-surface-elevated)] ${
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
                            <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)] leading-none">
                                {customerDisplayName || conversation.customerPhone}
                            </h2>
                            {isHandoff && <span className="badge badge--handoff">İnsan Devraldı</span>}
                            {hasAttention && <span className="badge badge--attention">Hata</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={`ai-status-badge ${
                                isHandoff ? "ai-status-badge--handoff" : "ai-status-badge--active"
                            }`}>
                                <span className={`w-2 h-2 rounded-full ${
                                    isHandoff ? "bg-[var(--color-status-handoff)]" : "bg-[var(--color-brand)] animate-pulse"
                                }`} />
                                <span>{isHandoff ? "Yönetici Aktif" : "Yapay Zeka Aktif"}</span>
                            </div>

                            {/* Admin tenant reassign */}
                            {isAdmin && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowReassign(!showReassign)}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors border border-transparent hover:border-[var(--color-border)]"
                                    >
                                        <Link2 size={12} />
                                        {conversation.tenantId
                                            ? (allTenants?.find(t => t.id === conversation.tenantId)?.name ?? conversation.tenantId.slice(0, 8))
                                            : "İşletmeye Bağla"
                                        }
                                        <ChevronDown size={12} />
                                    </button>
                                    {showReassign && allTenants && allTenants.length > 0 && (
                                        <div className="absolute top-full left-0 mt-2 z-50 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden min-w-[220px] animate-fade-in">
                                            <div className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
                                                İşletme Değiştir
                                            </div>
                                            <div className="max-h-[280px] overflow-y-auto p-2">
                                                {allTenants.map((t) => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => handleReassign(t.id)}
                                                        className={`w-full text-left px-4 py-3 rounded-lg text-[13px] font-medium transition-all ${
                                                            conversation.tenantId === t.id
                                                                ? "text-[var(--color-brand)] bg-[var(--color-brand-light)]"
                                                                : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
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

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleCustomerPanel}
                        className={`btn-icon ${showCustomerPanel ? "!bg-[var(--color-brand-light)] !text-[var(--color-brand)] !border-[var(--color-brand-dim)]" : ""}`}
                        title="Müşteri Detayları"
                    >
                        <Info size={18} />
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

                {/* Load older sessions button — shown at very top, hidden once loaded */}
                {!olderSessionsEnabled && conversation.tenantId && (
                    <div className="flex justify-center mb-2">
                        <button
                            onClick={() => setOlderSessionsEnabled(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:border-[var(--color-brand-dim)] hover:text-[var(--color-text-secondary)] transition-all"
                        >
                            <History size={13} />
                            Eski sohbetleri yükle
                        </button>
                    </div>
                )}

                {/* Older sessions loading spinner */}
                {olderSessionsEnabled && olderSessions === undefined && (
                    <div className="flex justify-center py-6">
                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin border-[var(--color-brand-dim)]" />
                    </div>
                )}

                {/* Older sessions — rendered oldest first above the active session */}
                {olderSessionsEnabled && olderSessions && olderSessions.length === 0 && (
                    <div className="flex items-center justify-center gap-2 py-4 text-[12px] text-[var(--color-text-muted)]">
                        <Archive size={13} />
                        <span>Bu işletme için daha eski sohbet yok.</span>
                    </div>
                )}

                {olderSessionsEnabled && olderSessions && olderSessions.length > 0 && (
                    <>
                        {olderSessions.map((session) => (
                            <div key={session.conversationId}>
                                {/* Session date divider */}
                                <div className="flex items-center gap-3 py-3">
                                    <div className="flex-1 h-px bg-[var(--color-border)]" />
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[11px] font-medium text-[var(--color-text-muted)]">
                                        <Archive size={11} />
                                        {formatSessionDate(session.createdAt)}
                                    </div>
                                    <div className="flex-1 h-px bg-[var(--color-border)]" />
                                </div>
                                {/* Messages from this archived session */}
                                <div className="space-y-1.5">
                                    {session.messages.map((m: any, i: number) => (
                                        <MessageBubble
                                            key={m._id}
                                            message={m}
                                            debugMode={debugMode}
                                            prevRole={i > 0 ? session.messages[i - 1].role : null}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Active session divider */}
                        <div ref={activeSectionRef} className="flex items-center gap-3 py-3 my-2">
                            <div className="flex-1 h-px bg-[var(--color-brand-dim)]" />
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-brand-light)] border border-[var(--color-brand-dim)] text-[11px] font-semibold text-[var(--color-brand)]">
                                <Bot size={11} />
                                Aktif Oturum
                            </div>
                            <div className="flex-1 h-px bg-[var(--color-brand-dim)]" />
                        </div>
                    </>
                )}

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

                        {/* Optimistic messages (sending state) */}
                        {optimisticMessages.map((om) => (
                            <div key={om.id} className="flex justify-end animate-fade-in">
                                <div className="max-w-[75%] sm:max-w-[65%]">
                                    <div className="bubble-human rounded-2xl rounded-br-md opacity-70">
                                        <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                                            {om.content}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-end gap-1.5 mt-1 px-1">
                                        <Clock size={10} className="text-[var(--color-text-muted)] animate-pulse" />
                                        <span className="text-[10px] text-[var(--color-text-muted)]">Gönderiliyor...</span>
                                    </div>
                                </div>
                            </div>
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
            <ChatInput 
                conversationId={conversationId} 
                status={conversation.status}
                onOptimisticSend={handleOptimisticSend}
            />
        </div>
    );
}
