"use client";

import { Doc } from "../../../../convex/_generated/dataModel";
import { User, ShieldCheck, AlertCircle } from "lucide-react";

function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export default function ConversationCard({
    conversation,
    isSelected,
    onClick,
}: {
    conversation: Doc<"conversations"> & { tenantName?: string };
    isSelected: boolean;
    onClick: () => void;
}) {
    const hasAttention = (conversation.retryState?.count ?? 0) > 0;
    const isHandoff = conversation.status === "handoff";

    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-4 px-4 py-4 rounded-[24px] text-left transition-all duration-300 group relative overflow-hidden
                ${isSelected 
                    ? "bg-white/[0.08] shadow-2xl translate-x-1" 
                    : "hover:bg-white/[0.04] hover:translate-x-1 active:scale-[0.98]"
                }
            `}
        >
            {/* Active Indicator Bar */}
            {isSelected && (
                <div 
                    className="absolute left-0 inset-y-3 w-1.5 rounded-r-full shadow-lg z-10"
                    style={{ background: "var(--color-brand)" }}
                />
            )}

            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <div className={`
                    w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 border
                    ${isSelected ? "bg-[var(--color-brand)] border-transparent" : "bg-white/[0.03] border-white/5 group-hover:bg-white/[0.06]"}
                `}>
                    <User size={20} className={isSelected ? "text-[#111111]" : "text-[#555555]"} />
                </div>
                
                {/* Status Indicator */}
                <div className="absolute -bottom-1 -right-1 p-0.5 rounded-lg bg-[#111111]">
                    {hasAttention ? (
                        <div className="status-dot status-dot--attention" />
                    ) : isHandoff ? (
                        <div className="status-dot status-dot--handoff" />
                    ) : (
                        <div className="status-dot status-dot--ai" />
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className={`text-[14px] font-bold truncate transition-colors ${isSelected ? "text-white" : "text-[#AAAAAA] group-hover:text-white"}`}>
                        {conversation.customerPhone}
                    </h3>
                    <span className={`text-[10px] font-bold ${isSelected ? "text-[var(--color-brand)]" : "text-[#444444]"}`}>
                        {formatTime(conversation.updatedAt)}
                    </span>
                </div>
                
                <div className="flex items-center gap-2">
                    <p className={`text-[12px] font-medium truncate flex-1 ${isSelected ? "text-[#888888]" : "text-[#555555]"}`}>
                        {conversation.rollingSummary || "Sohbet başlıyor..."}
                    </p>
                    
                    {hasAttention && (
                        <AlertCircle size={14} className="text-[var(--color-status-attention)] flex-shrink-0" />
                    ) || isHandoff && (
                        <ShieldCheck size={14} className="text-[var(--color-status-handoff)] flex-shrink-0" />
                    )}
                </div>

                {conversation.tenantName && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-white/[0.03] text-[9px] font-black uppercase tracking-widest text-[#444444]">
                            {conversation.tenantName}
                        </span>
                    </div>
                )}
            </div>

            {/* Glass shine effect */}
            {isSelected && (
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.05] pointer-events-none" />
            )}
        </button>
    );
}
