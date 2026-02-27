"use client";

import { useState } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import ConversationList from "./ConversationList";
import ChatView from "./ChatView";
import CustomerPanel from "./CustomerPanel";

interface ChatLayoutProps {
    tenantId: string | null;
    tenantName: string | null;
    tenantLogo: string | null;
    userEmail: string | null;
    isAdmin?: boolean;
    allTenants?: { id: string; name: string; logo_url: string | null }[];
    onTenantChange?: (id: string | null) => void;
    isRoutingMode?: boolean;
    hideListHeader?: boolean;
}

export default function ChatLayout({
    tenantId,
    tenantName,
    tenantLogo,
    userEmail,
    isAdmin,
    allTenants,
    onTenantChange,
    isRoutingMode,
    hideListHeader,
}: ChatLayoutProps) {
    const [selectedConversationId, setSelectedConversationId] =
        useState<Id<"conversations"> | null>(null);
    const [showCustomerPanel, setShowCustomerPanel] = useState(false);
    const [debugMode, setDebugMode] = useState(false);

    return (
        <div className="flex h-full w-full overflow-hidden relative bg-[var(--color-bg-base)]">

            {/* ── Left: Sidebar (List) ── */}
            <aside
                className={`
                    flex flex-col z-30
                    absolute inset-y-0 left-0 w-full
                    md:relative md:w-[300px] lg:w-[320px] md:flex-shrink-0
                    transition-transform duration-300 ease-in-out
                    ${selectedConversationId ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
                `}
            >
                <ConversationList
                    tenantId={tenantId}
                    selectedId={selectedConversationId}
                    onSelect={setSelectedConversationId}
                    tenantName={tenantName}
                    tenantLogo={tenantLogo}
                    userEmail={userEmail}
                    debugMode={debugMode}
                    onToggleDebug={() => setDebugMode(!debugMode)}
                    isAdmin={isAdmin}
                    allTenants={allTenants}
                    onTenantChange={onTenantChange}
                    isRoutingMode={isRoutingMode}
                    hideHeader={hideListHeader}
                />
            </aside>

            {/* ── Center: Main Chat Area ── */}
            <main
                className={`
                    flex-1 flex flex-col min-w-0 z-10 h-full relative
                    transition-transform duration-300 ease-in-out
                    bg-[var(--color-chat-bg)]
                    ${selectedConversationId ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
                `}
            >
                <ChatView
                    conversationId={selectedConversationId}
                    onToggleCustomerPanel={() => setShowCustomerPanel((p) => !p)}
                    showCustomerPanel={showCustomerPanel}
                    debugMode={debugMode}
                    onBack={() => setSelectedConversationId(null)}
                    isAdmin={isAdmin}
                    allTenants={allTenants}
                />
            </main>

            {/* ── Right: Customer Detail Panel ──
                Desktop (xl+): always visible as a side column.
                Below xl: overlay slide-in on demand.
            ── */}
            <aside
                className={`
                    flex flex-col z-40
                    bg-[var(--color-surface-pure)] border-l border-[var(--color-border)]
                    fixed inset-y-0 right-0 w-[85%] sm:w-[320px]
                    xl:relative xl:w-[320px] xl:flex-shrink-0
                    transition-transform duration-300 ease-in-out
                    shadow-xl xl:shadow-none
                    ${(showCustomerPanel || true) && selectedConversationId
                        ? 'xl:translate-x-0'
                        : 'xl:translate-x-0 xl:hidden'
                    }
                    ${showCustomerPanel && selectedConversationId
                        ? 'translate-x-0'
                        : 'translate-x-full xl:translate-x-0'
                    }
                    ${!selectedConversationId ? 'xl:hidden' : ''}
                `}
            >
                {selectedConversationId && (
                    <CustomerPanel
                        conversationId={selectedConversationId}
                        onClose={() => setShowCustomerPanel(false)}
                    />
                )}
            </aside>

            {/* Mobile Backdrop for Customer Panel */}
            {showCustomerPanel && selectedConversationId && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[35] xl:hidden animate-fade-in"
                    onClick={() => setShowCustomerPanel(false)}
                />
            )}
        </div>
    );
}
