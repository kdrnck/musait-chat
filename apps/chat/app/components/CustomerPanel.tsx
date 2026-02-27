"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { User, Phone, MapPin, Calendar, UserCheck, Star, Edit2, Save, Loader2, ChevronRight, X } from "lucide-react";
import { useState, useEffect } from "react";

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

    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notesText, setNotesText] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (customerProfile?.personNotes) {
            setNotesText(customerProfile.personNotes);
        }
    }, [customerProfile?.personNotes]);

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

    if (!conversation) return null;

    const displayNotes = customerProfile?.personNotes || conversation.rollingSummary || "";

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
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)]">
                            <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
                                <MapPin size={14} className="text-[var(--color-text-muted)]" />
                            </div>
                            <div>
                                <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-tight">Konum</p>
                                <p className="text-[13px] font-medium text-[var(--color-text-muted)]">Belirtilmedi</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Notes */}
                <section>
                    <div className="flex items-center justify-between mb-2.5 px-1">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                            Müşteri Notları
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
                                placeholder="Müşteri hakkında notlar ekleyin..."
                                autoFocus
                            />
                        ) : (
                            <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap">
                                {displayNotes || (
                                    <span className="text-[var(--color-text-muted)] italic">
                                        Henüz not eklenmedi. Düzenle butonuna tıklayın.
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
