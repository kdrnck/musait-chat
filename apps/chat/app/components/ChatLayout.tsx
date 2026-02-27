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
                    md:relative md:w-[320px] lg:w-[350px] md:flex-shrink-0
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
                />
            </aside>

            {/* ── Center: Main Chat Area ── */}
            <main
                className={`
                    flex-1 flex flex-col min-w-0 z-10 w-full h-full relative
                    transition-transform duration-300 ease-in-out
                    bg-[var(--color-surface-pure)]
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

            {/* ── Right: Customer Detail Panel (Overlay on small, sidebar on large) ── */}
            <aside
                className={`
                    flex flex-col z-40 bg-[var(--color-surface-pure)]
                    fixed inset-y-0 right-0 w-[85%] sm:w-[320px] lg:relative lg:w-[340px] lg:flex-shrink-0
                    transition-transform duration-300 ease-in-out
                    border-l border-[var(--color-border)] shadow-2xl lg:shadow-none
                    ${showCustomerPanel && selectedConversationId ? 'translate-x-0' : 'translate-x-full'}
                    ${!showCustomerPanel && 'hidden lg:hidden'}
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
                    className="fixed inset-0 bg-black/10 backdrop-blur-[2px] z-[35] lg:hidden animate-fade-in"
                    onClick={() => setShowCustomerPanel(false)}
                />
            )}
        </div>
    );
}
