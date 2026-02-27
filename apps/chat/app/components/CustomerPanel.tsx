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
        <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-black/[0.05] flex items-center justify-between bg-gradient-to-br from-white to-[var(--color-surface-base)]">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--color-brand)] flex items-center justify-center text-[#111111] shadow-lg shadow-[var(--color-brand-glow)]">
                        <User size={24} />
                    </div>
                    <div>
                        <h3 className="text-[16px] font-bold text-[var(--color-text-primary)] tracking-tight">Müşteri Profili</h3>
                        <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest mt-0.5">Müsait Chat CRM</p>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-black/5 transition-colors">
                        <X size={20} className="text-[var(--color-text-muted)]" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto content-scroll p-6 space-y-8">
                {/* Contact Info */}
                <section className="space-y-4">
                    <h4 className="text-[12px] font-black uppercase tracking-widest text-[var(--color-text-muted)] px-1">İletişim Bilgileri</h4>
                    <div className="space-y-2">
                        <div className="flex items-center gap-4 p-4 rounded-[24px] bg-[var(--color-surface-base)] border border-black/[0.02]">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[var(--color-text-secondary)] shadow-sm">
                                <Phone size={18} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-tight">Telefon</span>
                                <span className="text-[14px] font-bold text-[var(--color-text-primary)]">{conversation.customerPhone}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-[24px] bg-[var(--color-surface-base)] border border-black/[0.02]">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[var(--color-text-secondary)] shadow-sm">
                                <MapPin size={18} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-tight">Konum</span>
                                <span className="text-[14px] font-bold text-[var(--color-text-primary)]">Belirtilmedi</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* AI Summary */}
                <section className="space-y-4">
                    <h4 className="text-[12px] font-black uppercase tracking-widest text-[var(--color-text-muted)] px-1">Akıllı Özet</h4>
                    <div className="p-5 rounded-[24px] bg-[var(--color-brand-light)] border border-[var(--color-brand-glow-strong)] relative overflow-hidden group">
                        <div className="absolute top-[-20%] right-[-10%] w-24 h-24 bg-[var(--color-brand)] opacity-5 blur-2xl rounded-full" />
                        <p className="text-[13px] font-medium leading-relaxed text-[var(--color-brand-dim)] relative z-10">
                            {conversation.rollingSummary || "Yapay zeka henüz yeterli veri toplamadı."}
                        </p>
                    </div>
                </section>

                {/* Appointment History Placeholder */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h4 className="text-[12px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Randevular</h4>
                        <span className="px-2 py-0.5 rounded-md bg-black/5 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">0 Kayıt</span>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center py-10 px-6 border-2 border-dashed border-black/[0.05] rounded-[32px] text-center">
                        <div className="w-12 h-12 rounded-2xl bg-black/[0.02] flex items-center justify-center mb-4">
                            <Calendar size={24} className="text-black/[0.1]" />
                        </div>
                        <p className="text-[13px] font-bold text-[var(--color-text-muted)] mb-1">Geçmiş Randevu Bulunmuyor</p>
                        <p className="text-[11px] font-medium text-black/[0.2]">Müşteri henüz bir işlem gerçekleştirmedi.</p>
                    </div>
                </section>

                {/* Staff Preference Placeholder */}
                <section className="space-y-4 pb-10">
                    <h4 className="text-[12px] font-black uppercase tracking-widest text-[var(--color-text-muted)] px-1">Tercih Edilen Personel</h4>
                    <div className="flex items-center gap-3 p-4 rounded-[24px] bg-[var(--color-surface-base)] border border-black/[0.02]">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[var(--color-text-secondary)] shadow-sm">
                            <UserCheck size={18} />
                        </div>
                        <span className="text-[13px] font-bold text-[var(--color-text-primary)] flex-1">Farketmez / Herhangi biri</span>
                        <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
                    </div>
                </section>
            </div>

            {/* Footer Action */}
            <div className="p-6 border-t border-black/[0.05] bg-[var(--color-surface-base)]">
                <button className="w-full py-4 rounded-2xl bg-white border border-black/5 shadow-sm text-[14px] font-bold text-[var(--color-text-primary)] hover:bg-black/5 transition-all flex items-center justify-center gap-2">
                    <Star size={16} className="text-amber-400" />
                    <span>Önemli Müşteri Olarak İşaretle</span>
                </button>
            </div>
        </div>
    );
}
