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
        <div className="flex flex-col h-full">
            {/* ── Header ── */}
            <div
                className="px-4 py-3 border-b"
                style={{
                    borderColor: "var(--color-border)",
                    background: "var(--color-surface-1)",
                }}
            >
                <h3
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "var(--color-text-muted)" }}
                >
                    Müşteri Bilgileri
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {/* ── Profile Card ── */}
                <div
                    className="p-4 mb-4"
                    style={{
                        background: "var(--color-surface-2)",
                        border: "1px solid var(--color-border)",
                    }}
                >
                    {/* Avatar + Phone */}
                    <div className="flex items-center gap-3 mb-4">
                        <div
                            className="w-10 h-10 flex items-center justify-center"
                            style={{
                                background: "var(--color-surface-3)",
                                border: "1px solid var(--color-border)",
                            }}
                        >
                            <User size={18} style={{ color: "var(--color-text-secondary)" }} />
                        </div>
                        <div>
                            <span
                                className="text-sm font-semibold block"
                                style={{
                                    color: "var(--color-text-primary)",
                                    fontFamily: "var(--font-mono)",
                                }}
                            >
                                {conversation?.customerPhone || "—"}
                            </span>
                            <span
                                className="text-[10px] uppercase tracking-wider"
                                style={{ color: "var(--color-text-muted)" }}
                            >
                                WhatsApp
                            </span>
                            <span
                                className="text-[11px] block mt-1"
                                style={{ color: "var(--color-text-secondary)" }}
                            >
                                İsim: {effectiveName}
                            </span>
                        </div>
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-2 gap-2">
                        <InfoChip
                            icon={<Phone size={12} />}
                            label="Telefon"
                            value={conversation?.customerPhone?.slice(-4) || "—"}
                        />
                        <InfoChip
                            icon={<Clock size={12} />}
                            label="Durum"
                            value={conversation?.status === "handoff" ? "İnsan" : "AI"}
                        />
                    </div>
                </div>

                {/* ── Notes ── */}
                <Section
                    icon={<StickyNote size={14} />}
                    title="Müşteri Notları"
                >
                    {canEditNotes ? (
                        <>
                            <textarea
                                value={notesDraft}
                                onChange={(e) => setNotesDraft(e.target.value)}
                                placeholder="Müşteri tercihleri, hassasiyetler, özel notlar..."
                                className="w-full min-h-[120px] p-2 text-xs resize-y outline-none"
                                style={{
                                    background: "var(--color-surface-2)",
                                    border: "1px solid var(--color-border)",
                                    color: "var(--color-text-secondary)",
                                }}
                            />
                            <div className="flex justify-end mt-2">
                                <button
                                    onClick={handleSaveNotes}
                                    disabled={!notesChanged || savingNotes}
                                    className="px-3 py-1.5 text-[11px] font-semibold transition-colors"
                                    style={{
                                        background:
                                            !notesChanged || savingNotes
                                                ? "var(--color-surface-3)"
                                                : "var(--color-brand)",
                                        color:
                                            !notesChanged || savingNotes
                                                ? "var(--color-text-muted)"
                                                : "var(--color-surface-base)",
                                        border: "1px solid var(--color-border)",
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
                            className="text-xs leading-relaxed"
                            style={{ color: "var(--color-text-muted)" }}
                        >
                            Not düzenlemek için tenant-a bağlı bir konuşma seçin.
                        </p>
                    )}
                </Section>

                {/* ── Last Services ── */}
                {profile?.lastServices && profile.lastServices.length > 0 && (
                    <Section icon={<Scissors size={14} />} title="Son Hizmetler">
                        <div className="flex flex-wrap gap-1.5">
                            {profile.lastServices.map((service, i) => (
                                <span
                                    key={i}
                                    className="text-[11px] px-2 py-1"
                                    style={{
                                        background: "var(--color-surface-3)",
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
                    <Section icon={<Calendar size={14} />} title="Konuşma Özeti">
                        <p
                            className="text-xs leading-relaxed"
                            style={{ color: "var(--color-text-secondary)" }}
                        >
                            {conversation.rollingSummary}
                        </p>
                    </Section>
                )}

                {/* ── No profile state ── */}
                {!profile && conversation && (
                    <div
                        className="text-center py-6"
                        style={{ color: "var(--color-text-muted)" }}
                    >
                        <User
                            size={24}
                            className="mx-auto mb-2"
                            style={{ opacity: 0.3 }}
                        />
                        <p className="text-xs">
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
            className="flex flex-col gap-1 p-2"
            style={{
                background: "var(--color-surface-3)",
                border: "1px solid var(--color-border)",
            }}
        >
            <div
                className="flex items-center gap-1.5"
                style={{ color: "var(--color-text-muted)" }}
            >
                {icon}
                <span className="text-[10px] uppercase tracking-wider">{label}</span>
            </div>
            <span
                className="text-sm font-semibold"
                style={{
                    color: "var(--color-text-primary)",
                    fontFamily: "var(--font-mono)",
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
        <div className="mb-4">
            <div
                className="flex items-center gap-2 mb-2"
                style={{ color: "var(--color-text-muted)" }}
            >
                {icon}
                <span className="text-[10px] font-bold uppercase tracking-widest">
                    {title}
                </span>
            </div>
            {children}
        </div>
    );
}
