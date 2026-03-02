/* eslint-disable */
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { 
    User, 
    Phone, 
    Calendar, 
    UserCheck, 
    Star, 
    Edit2, 
    Save, 
    Loader2, 
    ChevronRight, 
    X,
    Bot,
    Database,
    Check
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

interface SupabaseCustomer {
    id: string;
    name: string | null;
    phone: string;
    tenant_id: string;
}

export default function CustomerPanel({
    conversationId,
    onClose,
}: {
    conversationId: Id<"conversations">;
    onClose?: () => void;
}) {
    const conversation = useQuery(api.conversations.getById, { id: conversationId });

    const customerProfile = useQuery(
        api.customerProfiles.getByPhone,
        conversation?.tenantId && conversation?.customerPhone
            ? { tenantId: conversation.tenantId, customerPhone: conversation.customerPhone }
            : "skip"
    );

    const updatePersonNotes = useMutation(api.customerProfiles.updatePersonNotes);
    const upsertProfile = useMutation(api.customerProfiles.upsert);

    // Supabase customer state
    const [supabaseCustomer, setSupabaseCustomer] = useState<SupabaseCustomer | null>(null);
    const [loadingSupabase, setLoadingSupabase] = useState(false);

    // Edit states
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notesText, setNotesText] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // System profile (Supabase) edit state
    const [isEditingSystemName, setIsEditingSystemName] = useState(false);
    const [systemName, setSystemName] = useState("");
    const [isSavingSystem, setIsSavingSystem] = useState(false);

    // AI profile (Convex) edit state
    const [isEditingAiName, setIsEditingAiName] = useState(false);
    const [aiName, setAiName] = useState("");
    const [isSavingAi, setIsSavingAi] = useState(false);

    // Fetch Supabase customer profile
    const fetchSupabaseCustomer = useCallback(async () => {
        if (!conversation?.tenantId || !conversation?.customerPhone) return;

        setLoadingSupabase(true);
        try {
            const res = await fetch(
                `/api/customer-profile?phone=${encodeURIComponent(conversation.customerPhone)}&tenantId=${encodeURIComponent(conversation.tenantId)}`
            );
            if (res.ok) {
                const data = await res.json();
                setSupabaseCustomer(data.customer);
                if (data.customer?.name) {
                    setSystemName(data.customer.name);
                }
            }
        } catch (err) {
            console.error("Failed to fetch Supabase customer:", err);
        } finally {
            setLoadingSupabase(false);
        }
    }, [conversation?.tenantId, conversation?.customerPhone]);

    useEffect(() => {
        fetchSupabaseCustomer();
    }, [fetchSupabaseCustomer]);

    useEffect(() => {
        if (customerProfile?.personNotes) {
            setNotesText(customerProfile.personNotes);
        }
    }, [customerProfile?.personNotes]);

    useEffect(() => {
        // Set AI name from Convex preferences
        const prefs = customerProfile?.preferences as Record<string, unknown> | undefined;
        if (prefs?.customerName) {
            setAiName(prefs.customerName as string);
        }
    }, [customerProfile?.preferences]);

    const handleSaveNotes = async () => {
        if (!conversation?.tenantId || !conversation?.customerPhone) return;
        setIsSaving(true);
        try {
            await updatePersonNotes({
                tenantId: conversation.tenantId,
                customerPhone: conversation.customerPhone,
                personNotes: notesText,
            });
            setIsEditingNotes(false);
        } catch (err) {
            console.error("Failed to save notes:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSystemName = async () => {
        if (!conversation?.tenantId || !conversation?.customerPhone) return;
        setIsSavingSystem(true);
        try {
            const res = await fetch("/api/customer-profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: conversation.customerPhone,
                    tenantId: conversation.tenantId,
                    name: systemName,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setSupabaseCustomer(data.customer);
                setIsEditingSystemName(false);
            }
        } catch (err) {
            console.error("Failed to save system name:", err);
        } finally {
            setIsSavingSystem(false);
        }
    };

    const handleSaveAiName = async () => {
        if (!conversation?.tenantId || !conversation?.customerPhone) return;
        setIsSavingAi(true);
        try {
            const existingPrefs = customerProfile?.preferences as Record<string, unknown> || {};
            
            // Parse first/last name
            const nameParts = aiName.trim().split(/\s+/);
            const firstName = nameParts[0] || "";
            const lastName = nameParts.slice(1).join(" ") || null;

            await upsertProfile({
                tenantId: conversation.tenantId,
                customerPhone: conversation.customerPhone,
                preferences: {
                    ...existingPrefs,
                    customerName: aiName.trim(),
                    customerFirstName: firstName,
                    ...(lastName ? { customerLastName: lastName } : {}),
                },
            });
            setIsEditingAiName(false);
        } catch (err) {
            console.error("Failed to save AI name:", err);
        } finally {
            setIsSavingAi(false);
        }
    };

    if (!conversation) return null;

    const displayNotes = customerProfile?.personNotes || conversation.rollingSummary || "";
    const aiNameDisplay = (customerProfile?.preferences as Record<string, unknown>)?.customerName as string | undefined;

    return (
        <div className="flex flex-col h-full bg-[var(--color-surface-pure)] overflow-hidden">

            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center">
                        <User size={17} className="text-[var(--color-text-muted)]" />
                    </div>
                    <div>
                        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-none">Müşteri Profili</h3>
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Müsait Chat CRM</p>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="btn-ghost xl:hidden">
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-[var(--color-bg-base)]">

                {/* Contact Info */}
                <section>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2.5 px-1">
                        İletişim Bilgileri
                    </h4>
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)]">
                            <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
                                <Phone size={14} className="text-[var(--color-brand-dim)]" />
                            </div>
                            <div>
                                <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-tight">Telefon</p>
                                <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                                    {conversation.customerPhone}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* System Profile (Supabase) */}
                <section>
                    <div className="flex items-center justify-between mb-2.5 px-1">
                        <div className="flex items-center gap-2">
                            <Database size={12} className="text-blue-400" />
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                                Sistem Profili
                            </h4>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800/50">
                            Randevu & Fatura
                        </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] space-y-3">
                        {/* System Name */}
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-tight mb-1">
                                    Kayıtlı İsim
                                </p>
                                {isEditingSystemName ? (
                                    <input
                                        type="text"
                                        value={systemName}
                                        onChange={(e) => setSystemName(e.target.value)}
                                        className="w-full px-3 py-2 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)]"
                                        placeholder="Ad Soyad"
                                        autoFocus
                                    />
                                ) : (
                                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                                        {supabaseCustomer?.name || (
                                            <span className="text-[var(--color-text-muted)] italic font-normal">Belirtilmedi</span>
                                        )}
                                    </p>
                                )}
                            </div>
                            {conversation.tenantId && (
                                <button
                                    onClick={() => {
                                        if (isEditingSystemName) {
                                            handleSaveSystemName();
                                        } else {
                                            setSystemName(supabaseCustomer?.name || "");
                                            setIsEditingSystemName(true);
                                        }
                                    }}
                                    disabled={isSavingSystem}
                                    className="btn-secondary px-2.5 py-1.5 text-[11px] gap-1 ml-2"
                                >
                                    {isSavingSystem ? (
                                        <Loader2 size={11} className="animate-spin" />
                                    ) : isEditingSystemName ? (
                                        <><Check size={11} /><span>Kaydet</span></>
                                    ) : (
                                        <><Edit2 size={11} /><span>Düzenle</span></>
                                    )}
                                </button>
                            )}
                        </div>
                        {isEditingSystemName && (
                            <button
                                onClick={() => setIsEditingSystemName(false)}
                                className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                                İptal
                            </button>
                        )}
                        <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                            Bu isim randevu bildirimlerinde ve faturalarda görünür.
                        </p>
                    </div>
                </section>

                {/* AI Profile (Convex) */}
                <section>
                    <div className="flex items-center justify-between mb-2.5 px-1">
                        <div className="flex items-center gap-2">
                            <Bot size={12} className="text-[var(--color-brand)]" />
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                                AI Profili
                            </h4>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded bg-[rgba(34,197,94,0.15)] text-[var(--color-brand)] border border-[rgba(34,197,94,0.3)]">
                            Asistan & Kişiselleştirme
                        </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] space-y-3">
                        {/* AI Name */}
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-tight mb-1">
                                    Hitap İsmi
                                </p>
                                {isEditingAiName ? (
                                    <input
                                        type="text"
                                        value={aiName}
                                        onChange={(e) => setAiName(e.target.value)}
                                        className="w-full px-3 py-2 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)]"
                                        placeholder="Müşteriye nasıl hitap edilecek"
                                        autoFocus
                                    />
                                ) : (
                                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                                        {aiNameDisplay || (
                                            <span className="text-[var(--color-text-muted)] italic font-normal">Belirtilmedi</span>
                                        )}
                                    </p>
                                )}
                            </div>
                            {conversation.tenantId && (
                                <button
                                    onClick={() => {
                                        if (isEditingAiName) {
                                            handleSaveAiName();
                                        } else {
                                            setAiName(aiNameDisplay || "");
                                            setIsEditingAiName(true);
                                        }
                                    }}
                                    disabled={isSavingAi}
                                    className="btn-secondary px-2.5 py-1.5 text-[11px] gap-1 ml-2"
                                >
                                    {isSavingAi ? (
                                        <Loader2 size={11} className="animate-spin" />
                                    ) : isEditingAiName ? (
                                        <><Check size={11} /><span>Kaydet</span></>
                                    ) : (
                                        <><Edit2 size={11} /><span>Düzenle</span></>
                                    )}
                                </button>
                            )}
                        </div>
                        {isEditingAiName && (
                            <button
                                onClick={() => setIsEditingAiName(false)}
                                className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                                İptal
                            </button>
                        )}
                        <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                            AI asistan bu isimle müşteriye hitap eder. Farklı olabilir (örn: Mehmet Bey → Mehmet).
                        </p>
                    </div>
                </section>

                {/* Notes (AI Context) */}
                <section>
                    <div className="flex items-center justify-between mb-2.5 px-1">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                            AI Notları
                        </h4>
                        {conversation.tenantId && (
                            <button
                                onClick={() => {
                                    if (isEditingNotes) {
                                        handleSaveNotes();
                                    } else {
                                        setNotesText(displayNotes);
                                        setIsEditingNotes(true);
                                    }
                                }}
                                disabled={isSaving}
                                className="btn-secondary px-2.5 py-1 text-[11px] gap-1"
                            >
                                {isSaving ? (
                                    <Loader2 size={11} className="animate-spin" />
                                ) : isEditingNotes ? (
                                    <><Save size={11} /><span>Kaydet</span></>
                                ) : (
                                    <><Edit2 size={11} /><span>Düzenle</span></>
                                )}
                            </button>
                        )}
                    </div>
                    <div className="p-3.5 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)]">
                        {isEditingNotes ? (
                            <textarea
                                value={notesText}
                                onChange={(e) => setNotesText(e.target.value)}
                                className="w-full min-h-[100px] text-[13px] leading-relaxed text-[var(--color-text-secondary)] bg-transparent border-none outline-none resize-none"
                                placeholder="Bu müşteri hakkında AI'ın bilmesi gereken notlar..."
                                autoFocus
                            />
                        ) : (
                            <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap">
                                {displayNotes || (
                                    <span className="text-[var(--color-text-muted)] italic">
                                        Henüz not eklenmedi. Bu notlar AI asistanın müşteriyi daha iyi anlamasına yardımcı olur.
                                    </span>
                                )}
                            </p>
                        )}
                        {isEditingNotes && (
                            <button
                                onClick={() => setIsEditingNotes(false)}
                                className="mt-2 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                                İptal
                            </button>
                        )}
                    </div>
                </section>

                {/* Appointments */}
                <section>
                    <div className="flex items-center justify-between mb-2.5 px-1">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                            Randevular
                        </h4>
                        <span className="text-[10px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-surface-pure)] border border-[var(--color-border)] px-2 py-0.5 rounded">
                            0 kayıt
                        </span>
                    </div>
                    <div className="flex flex-col items-center py-7 px-4 rounded-xl bg-[var(--color-surface-pure)] border border-dashed border-[var(--color-border)] text-center">
                        <Calendar size={20} className="text-[var(--color-text-muted)] mb-2" />
                        <p className="text-[13px] font-medium text-[var(--color-text-primary)]">Geçmiş Randevu Yok</p>
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Henüz bir işlem gerçekleştirmedi</p>
                    </div>
                </section>

                {/* Staff preference */}
                <section>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2.5 px-1">
                        Tercih Edilen Personel
                    </h4>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-border-hover)] hover:bg-[var(--color-surface-hover)] transition-all">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
                            <UserCheck size={14} className="text-[var(--color-text-muted)]" />
                        </div>
                        <span className="text-[13px] font-medium text-[var(--color-text-primary)] flex-1">
                            Farketmez / Herhangi biri
                        </span>
                        <ChevronRight size={15} className="text-[var(--color-text-muted)]" />
                    </div>
                </section>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-pure)] flex-shrink-0">
                <button className="btn-secondary w-full justify-center gap-2 py-2.5">
                    <Star size={15} className="text-amber-500" />
                    <span>Önemli Müşteri Olarak İşaretle</span>
                </button>
            </div>
        </div>
    );
}
