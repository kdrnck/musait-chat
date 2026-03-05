/* eslint-disable */
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
    User,
    Phone,
    Calendar,
    Edit2,
    Loader2,
    X,
    Bot,
    Database,
    Check,
    FileText,
    Scissors,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

interface SupabaseCustomer {
    id: string;
    name: string | null;
    phone: string;
    tenant_id: string;
}

interface AppointmentRow {
    startTime: string;
    status: string;
    serviceName: string | null;
    staffName: string | null;
    notes: string | null;
}

function formatAppointmentDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function formatAppointmentTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(status: string): { text: string; className: string } {
    switch (status) {
        case "attended":
            return { text: "Tamamlandı", className: "chip chip--brand" };
        case "booked":
        case "upcoming":
            return { text: "Yaklaşan", className: "chip chip--info" };
        case "no_show":
            return { text: "Gelmedi", className: "chip chip--warning" };
        case "cancelled":
            return { text: "İptal", className: "chip chip--danger" };
        default:
            return { text: status, className: "chip" };
    }
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

    // Appointments state
    const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
    const [appointmentsTotal, setAppointmentsTotal] = useState(0);
    const [recentServices, setRecentServices] = useState<string[]>([]);
    const [loadingAppointments, setLoadingAppointments] = useState(false);
    const [showAllAppointments, setShowAllAppointments] = useState(false);

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

    // Fetch appointments from Supabase (tenant-isolated)
    const fetchAppointments = useCallback(async (limit = 3, offset = 0, append = false) => {
        if (!conversation?.tenantId || !conversation?.customerPhone) return;

        setLoadingAppointments(true);
        try {
            const res = await fetch(
                `/api/customer-appointments?phone=${encodeURIComponent(conversation.customerPhone)}&tenantId=${encodeURIComponent(conversation.tenantId)}&limit=${limit}&offset=${offset}`
            );
            if (res.ok) {
                const data = await res.json();
                if (append) {
                    setAppointments((prev) => [...prev, ...data.appointments]);
                } else {
                    setAppointments(data.appointments);
                    setRecentServices(data.services || []);
                }
                setAppointmentsTotal(data.total);
            }
        } catch (err) {
            console.error("Failed to fetch appointments:", err);
        } finally {
            setLoadingAppointments(false);
        }
    }, [conversation?.tenantId, conversation?.customerPhone]);

    useEffect(() => {
        fetchSupabaseCustomer();
    }, [fetchSupabaseCustomer]);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    useEffect(() => {
        if (customerProfile?.personNotes) {
            setNotesText(customerProfile.personNotes);
        }
    }, [customerProfile?.personNotes]);

    useEffect(() => {
        const prefs = customerProfile?.preferences as Record<string, unknown> | undefined;
        if (prefs?.customerName) {
            setAiName(prefs.customerName as string);
        }
    }, [customerProfile?.preferences]);

    const handleShowAll = () => {
        setShowAllAppointments(true);
        if (appointments.length < appointmentsTotal) {
            fetchAppointments(20, 0);
        }
    };

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
    const visibleAppointments = showAllAppointments ? appointments : appointments.slice(0, 3);

    return (
        <div className="flex flex-col h-full bg-[var(--color-bg-base)] overflow-hidden">

            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-pure)] flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-center justify-center">
                        <User size={17} className="text-[var(--color-text-muted)]" />
                    </div>
                    <div>
                        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-tight">
                            {supabaseCustomer?.name || aiNameDisplay || conversation.customerPhone}
                        </h3>
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Müşteri Profili</p>
                    </div>
                </div>
                {onClose && (
                    <button onClick={onClose} className="btn-icon">
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Contact */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)]">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-hover)] flex items-center justify-center flex-shrink-0">
                        <Phone size={14} className="text-[var(--color-brand-dim)]" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Telefon</p>
                        <p className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
                            {conversation.customerPhone}
                        </p>
                    </div>
                </div>

                {/* System Profile (Supabase) */}
                <section className="rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-surface-hover)] border-b border-[var(--color-border)]">
                        <div className="flex items-center gap-2">
                            <Database size={12} className="text-blue-400" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Sistem Profili</span>
                        </div>
                    </div>
                    <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-tight mb-0.5">Kayıtlı İsim</p>
                                {isEditingSystemName ? (
                                    <input
                                        type="text"
                                        value={systemName}
                                        onChange={(e) => setSystemName(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)]"
                                        placeholder="Ad Soyad"
                                        autoFocus
                                        onKeyDown={(e) => e.key === "Enter" && handleSaveSystemName()}
                                    />
                                ) : (
                                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                                        {supabaseCustomer?.name || <span className="text-[var(--color-text-muted)] italic font-normal text-[12px]">Belirtilmedi</span>}
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
                                    className="btn-ghost px-2 py-1.5 text-[11px] gap-1 flex-shrink-0"
                                >
                                    {isSavingSystem ? (
                                        <Loader2 size={12} className="animate-spin" />
                                    ) : isEditingSystemName ? (
                                        <Check size={12} />
                                    ) : (
                                        <Edit2 size={12} />
                                    )}
                                </button>
                            )}
                        </div>
                        {isEditingSystemName && (
                            <button onClick={() => setIsEditingSystemName(false)} className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                                İptal
                            </button>
                        )}
                        <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                            Randevu bildirimlerinde ve faturalarda kullanılır.
                        </p>
                    </div>
                </section>

                {/* AI Profile (Convex) */}
                <section className="rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-surface-hover)] border-b border-[var(--color-border)]">
                        <div className="flex items-center gap-2">
                            <Bot size={12} className="text-[var(--color-brand)]" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">AI Profili</span>
                        </div>
                    </div>
                    <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-tight mb-0.5">Hitap İsmi</p>
                                {isEditingAiName ? (
                                    <input
                                        type="text"
                                        value={aiName}
                                        onChange={(e) => setAiName(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)]"
                                        placeholder="Müşteriye nasıl hitap edilecek"
                                        autoFocus
                                        onKeyDown={(e) => e.key === "Enter" && handleSaveAiName()}
                                    />
                                ) : (
                                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                                        {aiNameDisplay || <span className="text-[var(--color-text-muted)] italic font-normal text-[12px]">Belirtilmedi</span>}
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
                                    className="btn-ghost px-2 py-1.5 text-[11px] gap-1 flex-shrink-0"
                                >
                                    {isSavingAi ? (
                                        <Loader2 size={12} className="animate-spin" />
                                    ) : isEditingAiName ? (
                                        <Check size={12} />
                                    ) : (
                                        <Edit2 size={12} />
                                    )}
                                </button>
                            )}
                        </div>
                        {isEditingAiName && (
                            <button onClick={() => setIsEditingAiName(false)} className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                                İptal
                            </button>
                        )}
                        <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
                            AI asistan bu isimle müşteriye hitap eder.
                        </p>
                    </div>
                </section>

                {/* AI Notes (Convex) */}
                <section className="rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-surface-hover)] border-b border-[var(--color-border)]">
                        <div className="flex items-center gap-2">
                            <FileText size={12} className="text-amber-400" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">AI Notları</span>
                        </div>
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
                                className="btn-ghost px-2 py-1 text-[11px] gap-1"
                            >
                                {isSaving ? (
                                    <Loader2 size={12} className="animate-spin" />
                                ) : isEditingNotes ? (
                                    <><Check size={12} /> Kaydet</>
                                ) : (
                                    <><Edit2 size={12} /> Düzenle</>
                                )}
                            </button>
                        )}
                    </div>
                    <div className="p-4">
                        {isEditingNotes ? (
                            <>
                                <textarea
                                    value={notesText}
                                    onChange={(e) => setNotesText(e.target.value)}
                                    className="w-full min-h-[80px] text-[13px] leading-relaxed text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg p-3 outline-none resize-none focus:border-[var(--color-brand)]"
                                    placeholder="Bu müşteri hakkında AI'ın bilmesi gereken notlar..."
                                    autoFocus
                                />
                                <button onClick={() => setIsEditingNotes(false)} className="mt-2 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                                    İptal
                                </button>
                            </>
                        ) : (
                            <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap">
                                {displayNotes || (
                                    <span className="text-[var(--color-text-muted)] italic text-[12px]">
                                        Henüz not yok. AI asistanın müşteriyi daha iyi anlamasına yardımcı olur.
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                </section>

                {/* Recent Services (derived from Supabase appointments) */}
                {recentServices.length > 0 && (
                    <section className="rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface-hover)] border-b border-[var(--color-border)]">
                            <Scissors size={12} className="text-[var(--color-brand-dim)]" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Son Hizmetler</span>
                        </div>
                        <div className="p-3 flex flex-wrap gap-1.5">
                            {recentServices.map((svc, i) => (
                                <span key={i} className="chip chip--brand">{svc}</span>
                            ))}
                        </div>
                    </section>
                )}

                {/* Appointments (Supabase, tenant-isolated) */}
                <section className="rounded-xl bg-[var(--color-surface-pure)] border border-[var(--color-border)] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-surface-hover)] border-b border-[var(--color-border)]">
                        <div className="flex items-center gap-2">
                            <Calendar size={12} className="text-blue-400" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Randevular</span>
                        </div>
                        <span className="chip text-[10px] py-0.5 px-2">
                            {appointmentsTotal} kayıt
                        </span>
                    </div>

                    {loadingAppointments && appointments.length === 0 ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 size={18} className="animate-spin text-[var(--color-text-muted)]" />
                        </div>
                    ) : visibleAppointments.length === 0 ? (
                        <div className="flex flex-col items-center py-6 px-4 text-center">
                            <Calendar size={20} className="text-[var(--color-text-muted)] mb-2" />
                            <p className="text-[12px] text-[var(--color-text-muted)]">Geçmiş randevu yok</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--color-border)]">
                            {visibleAppointments.map((appt, i) => (
                                <div key={i} className="px-4 py-3 flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-[var(--color-surface-hover)] flex items-center justify-center">
                                        <Calendar size={13} className="text-[var(--color-text-muted)]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
                                                {appt.serviceName || "Hizmet belirtilmedi"}
                                            </p>
                                            <span className={statusLabel(appt.status).className + " text-[10px] py-0.5 flex-shrink-0"}>
                                                {statusLabel(appt.status).text}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                                            <span>{formatAppointmentDate(appt.startTime)}</span>
                                            <span>·</span>
                                            <span>{formatAppointmentTime(appt.startTime)}</span>
                                            {appt.staffName && (
                                                <>
                                                    <span>·</span>
                                                    <span>{appt.staffName}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Show more / less */}
                            {appointmentsTotal > 3 && (
                                <div className="px-4 py-2.5">
                                    <button
                                        onClick={() => {
                                            if (showAllAppointments) {
                                                setShowAllAppointments(false);
                                            } else {
                                                handleShowAll();
                                            }
                                        }}
                                        disabled={loadingAppointments}
                                        className="w-full flex items-center justify-center gap-1.5 text-[12px] font-medium text-[var(--color-brand)] hover:text-[var(--color-brand-dim)] transition-colors py-1"
                                    >
                                        {loadingAppointments ? (
                                            <Loader2 size={13} className="animate-spin" />
                                        ) : showAllAppointments ? (
                                            <>
                                                <ChevronUp size={14} />
                                                <span>Daralt</span>
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown size={14} />
                                                <span>Tümünü Gör ({appointmentsTotal})</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </section>

            </div>
        </div>
    );
}
