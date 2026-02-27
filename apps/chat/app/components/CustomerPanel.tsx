"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { User, Phone, MapPin, Calendar, Clock, CreditCard, ChevronRight, X, UserCheck, Star } from "lucide-react";

export default function CustomerPanel({
    conversationId,
    onClose,
}: {
    conversationId: Id<"conversations">;
    onClose?: () => void;
}) {
    const conversation = useQuery(api.conversations.getById, { id: conversationId });

    if (!conversation) return null;

    return (
        <div className="flex flex-col h-full bg-[var(--color-surface-pure)] overflow-hidden">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface-pure)]">
                <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-full bg-[var(--color-brand-light)] border border-[var(--color-brand-glow)] flex items-center justify-center font-bold">
                        <User size={20} className="text-[var(--color-brand-dark)]" />
                    </div>
                    <div>
                        <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] tracking-tight">Müşteri Profili</h3>
                        <p className="text-[11px] font-medium text-[var(--color-text-secondary)] mt-0.5">Müsait Chat CRM</p>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                        <X size={20} />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto content-scroll p-5 sm:p-6 space-y-8 bg-[var(--color-bg-base)]">
                {/* Contact Info */}
                <section className="space-y-3">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] px-1">İletişim Bilgileri</h4>
                    <div className="space-y-2">
                        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] shadow-sm">
                            <div className="w-9 h-9 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-brand-dark)]">
                                <Phone size={16} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-tight">Telefon</span>
                                <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">{conversation.customerPhone}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] shadow-sm">
                            <div className="w-9 h-9 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
                                <MapPin size={16} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-tight">Konum</span>
                                <span className="text-[13px] font-medium text-[var(--color-text-secondary)]">Belirtilmedi</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* AI Summary */}
                <section className="space-y-3">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] px-1">Akıllı Özet</h4>
                    <div className="p-4 rounded-2xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-brand-light)] opacity-20 blur-3xl rounded-full" />
                        <p className="text-[13px] font-medium leading-[1.6] text-[var(--color-text-secondary)] relative z-10">
                            {conversation.rollingSummary || "Yapay zeka henüz yeterli veri toplamadı."}
                        </p>
                    </div>
                </section>

                {/* Appointment History Placeholder */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Randevular</h4>
                        <span className="px-1.5 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-surface-pure)] text-[9px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-widest">0 Kayıt</span>
                    </div>

                    <div className="flex flex-col items-center justify-center py-8 px-4 bg-[var(--color-surface-pure)] border border-[var(--color-border)] border-dashed rounded-2xl text-center shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center mb-3">
                            <Calendar size={18} className="text-[var(--color-text-muted)]" />
                        </div>
                        <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-0.5">Geçmiş Randevu Bulunmuyor</p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">Müşteri henüz bir işlem gerçekleştirmedi.</p>
                    </div>
                </section>

                {/* Staff Preference Placeholder */}
                <section className="space-y-3 pb-8">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] px-1">Tercih Edilen Personel</h4>
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] shadow-sm">
                        <div className="w-9 h-9 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
                            <UserCheck size={16} />
                        </div>
                        <span className="text-[13px] font-medium text-[var(--color-text-primary)] flex-1">Farketmez / Herhangi biri</span>
                        <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
                    </div>
                </section>
            </div>

            {/* Footer Action */}
            <div className="p-5 sm:p-6 border-t border-[var(--color-border)] bg-[var(--color-surface-pure)]">
                <button className="w-full py-3.5 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] hover:border-[var(--color-brand-dark)] text-[13px] font-semibold text-[var(--color-text-primary)] hover:shadow-sm transition-all flex items-center justify-center gap-2">
                    <Star size={16} className="text-amber-500" />
                    <span>Önemli Müşteri Olarak İşaretle</span>
                </button>
            </div>
        </div>
    );
}
