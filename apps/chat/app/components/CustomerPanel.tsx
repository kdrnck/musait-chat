"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import {
    User,
    Phone,
    Calendar,
    Scissors,
    StickyNote,
    Clock,
} from "lucide-react";

export default function CustomerPanel({
    conversationId,
}: {
    conversationId: Id<"conversations">;
}) {
    const conversation = useQuery(api.conversations.getById, {
        id: conversationId,
    });

    const profile = useQuery(
        api.customerProfiles.getByPhone,
        conversation?.tenantId && conversation?.customerPhone
            ? {
                tenantId: conversation.tenantId,
                customerPhone: conversation.customerPhone,
            }
            : "skip"
    );

    const upsertProfile = useMutation(api.customerProfiles.upsert);
    const [notesDraft, setNotesDraft] = useState("");
    const [savingNotes, setSavingNotes] = useState(false);

    const effectiveName = useMemo(() => {
        const prefName =
            typeof profile?.preferences?.customerName === "string"
                ? profile.preferences.customerName
                : "";
        return prefName || "—";
    }, [profile?.preferences]);

    useEffect(() => {
        setNotesDraft(profile?.personNotes || "");
    }, [profile?.personNotes, conversationId]);

    const canEditNotes = Boolean(conversation?.tenantId && conversation?.customerPhone);
    const notesChanged = (profile?.personNotes || "") !== notesDraft;

    const handleSaveNotes = async () => {
        if (!canEditNotes || !conversation?.tenantId || !conversation?.customerPhone) return;
        setSavingNotes(true);
        try {
            await upsertProfile({
                tenantId: conversation.tenantId,
                customerPhone: conversation.customerPhone,
                personNotes: notesDraft,
            });
        } catch (err) {
            console.error("Failed to save customer notes:", err);
        } finally {
            setSavingNotes(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--color-surface-1)]">
            {/* ── Header ── */}
            <div className="px-6 py-5 border-b z-10" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-base)" }}>
                <h3 className="text-[13px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">
                    Müşteri Bilgileri
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* ── Profile Card ── */}
                <div
                    className="p-5 rounded-2xl shadow-sm"
                    style={{
                        background: "var(--color-surface-base)",
                        border: "1px solid var(--color-border)",
                    }}
                >
                    {/* Avatar + Phone */}
                    <div className="flex items-center gap-4 mb-5">
                        <div
                            className="w-14 h-14 flex items-center justify-center rounded-full"
                            style={{
                                background: "var(--color-surface-2)",
                            }}
                        >
                            <User size={24} style={{ color: "var(--color-text-secondary)" }} />
                        </div>
                        <div>
                            <span
                                className="text-[16px] font-bold block"
                                style={{
                                    color: "var(--color-text-primary)"
                                }}
                            >
                                {conversation?.customerPhone || "—"}
                            </span>
                            <span
                                className="text-[11px] font-medium uppercase tracking-wider block mt-0.5"
                                style={{ color: "var(--color-text-muted)" }}
                            >
                                WhatsApp
                            </span>
                            <span
                                className="text-[13px] font-medium block mt-1"
                                style={{ color: "var(--color-text-secondary)" }}
                            >
                                {effectiveName}
                            </span>
                        </div>
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-2 gap-3">
                        <InfoChip
                            icon={<Phone size={14} />}
                            label="Telefon"
                            value={conversation?.customerPhone?.slice(-4) || "—"}
                        />
                        <InfoChip
                            icon={<Clock size={14} />}
                            label="Durum"
                            value={conversation?.status === "handoff" ? "İnsan" : "AI"}
                        />
                    </div>
                </div>

                {/* ── Notes ── */}
                <Section
                    icon={<StickyNote size={16} />}
                    title="Müşteri Notları"
                >
                    {canEditNotes ? (
                        <>
                            <textarea
                                value={notesDraft}
                                onChange={(e) => setNotesDraft(e.target.value)}
                                placeholder="Müşteri tercihleri, hassasiyetler, özel notlar..."
                                className="w-full min-h-[120px] p-4 text-[13px] resize-y outline-none rounded-2xl transition-colors"
                                style={{
                                    background: "var(--color-surface-base)",
                                    border: "1px solid var(--color-border)",
                                    color: "var(--color-text-primary)",
                                }}
                                onFocus={(e) => e.target.style.borderColor = "var(--color-border-hover)"}
                                onBlur={(e) => e.target.style.borderColor = "var(--color-border)"}
                            />
                            <div className="flex justify-end mt-3">
                                <button
                                    onClick={handleSaveNotes}
                                    disabled={!notesChanged || savingNotes}
                                    className="px-4 py-2 text-[12px] font-bold rounded-xl transition-all"
                                    style={{
                                        background:
                                            !notesChanged || savingNotes
                                                ? "var(--color-surface-2)"
                                                : "var(--color-brand)",
                                        color:
                                            !notesChanged || savingNotes
                                                ? "var(--color-text-muted)"
                                                : "var(--color-surface-1)",
                                        cursor:
                                            !notesChanged || savingNotes
                                                ? "not-allowed"
                                                : "pointer",
                                    }}
                                >
                                    {savingNotes ? "Kaydediliyor..." : "Notu Kaydet"}
                                </button>
                            </div>
                        </>
                    ) : (
                        <p
                            className="text-[13px] leading-relaxed"
                            style={{ color: "var(--color-text-muted)" }}
                        >
                            Not düzenlemek için bir konuşma seçin.
                        </p>
                    )}
                </Section>

                {/* ── Last Services ── */}
                {profile?.lastServices && profile.lastServices.length > 0 && (
                    <Section icon={<Scissors size={16} />} title="Son Hizmetler">
                        <div className="flex flex-wrap gap-2">
                            {profile.lastServices.map((service, i) => (
                                <span
                                    key={i}
                                    className="text-[12px] font-medium px-3 py-1.5 rounded-full"
                                    style={{
                                        background: "var(--color-surface-base)",
                                        border: "1px solid var(--color-border)",
                                        color: "var(--color-text-secondary)",
                                    }}
                                >
                                    {service}
                                </span>
                            ))}
                        </div>
                    </Section>
                )}

                {/* ── Conversation Summary ── */}
                {conversation?.rollingSummary && (
                    <Section icon={<Calendar size={16} />} title="Konuşma Özeti">
                        <div className="p-4 rounded-xl" style={{ background: "var(--color-surface-base)", border: "1px solid var(--color-border)" }}>
                            <p
                                className="text-[13px] leading-relaxed"
                                style={{ color: "var(--color-text-secondary)" }}
                            >
                                {conversation.rollingSummary}
                            </p>
                        </div>
                    </Section>
                )}

                {/* ── No profile state ── */}
                {!profile && conversation && (
                    <div
                        className="text-center py-8"
                        style={{ color: "var(--color-text-muted)" }}
                    >
                        <User
                            size={32}
                            className="mx-auto mb-3"
                            style={{ opacity: 0.2 }}
                        />
                        <p className="text-[13px] font-medium">
                            Müşteri profili henüz oluşturulmamış
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Sub-components ── */

function InfoChip({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div
            className="flex flex-col gap-1.5 p-3 rounded-xl transition-colors"
            style={{
                background: "var(--color-surface-base)",
                border: "1px solid var(--color-border)",
            }}
        >
            <div
                className="flex items-center gap-2"
                style={{ color: "var(--color-text-muted)" }}
            >
                {icon}
                <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
            </div>
            <span
                className="text-[14px] font-bold"
                style={{
                    color: "var(--color-text-primary)",
                }}
            >
                {value}
            </span>
        </div>
    );
}

function Section({
    icon,
    title,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="mb-6">
            <div
                className="flex items-center gap-2 mb-3 px-1"
                style={{ color: "var(--color-text-muted)" }}
            >
                {icon}
                <span className="text-[11px] font-bold uppercase tracking-widest">
                    {title}
                </span>
            </div>
            {children}
        </div>
    );
}
