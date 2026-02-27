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
    onTenantChange?: (id: string) => void;
}

export default function ChatLayout({
    tenantId,
    tenantName,
    tenantLogo,
    userEmail,
    isAdmin,
    allTenants,
    onTenantChange,
}: ChatLayoutProps) {
    const [selectedConversationId, setSelectedConversationId] =
        useState<Id<"conversations"> | null>(null);
    const [showCustomerPanel, setShowCustomerPanel] = useState(false); // Default false for cleaner start
    const [debugMode, setDebugMode] = useState(false);

    return (
        <div className="flex h-full w-full overflow-hidden relative">
            {/* ── Left: Dark Sidebar ── */}
            <aside
                className={`
                    flex flex-col z-30
                    absolute inset-y-0 left-0 w-full
                    md:relative md:w-[360px] lg:w-[380px] md:flex-shrink-0
                    transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
                    ${selectedConversationId ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
                `}
                style={{
                    background: "var(--color-sidebar-bg)"
                }}
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
                />
            </aside>

            {/* ── Center: Light Chat Area ── */}
            <main
                className={`
                    flex-1 flex flex-col min-w-0 z-10 w-full h-full relative
                    transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
                    ${selectedConversationId ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
                `}
                style={{ background: "var(--color-surface-base)" }}
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

            {/* ── Right: Customer Detail Panel (Overlay on small screens, sidebar on large) ── */}
            <aside
                className={`
                    flex flex-col z-40
                    fixed inset-y-0 right-0 w-[85%] sm:w-[380px] lg:relative lg:w-[380px] lg:flex-shrink-0
                    transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
                    shadow-[-20px_0_40px_rgba(0,0,0,0.05)] lg:shadow-none
                    ${showCustomerPanel && selectedConversationId ? 'translate-x-0' : 'translate-x-full'}
                    ${!showCustomerPanel && 'hidden lg:hidden'}
                `}
                style={{
                    background: "var(--color-surface-base)",
                    borderLeft: "2px solid var(--color-surface-1)",
                }}
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
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-35 lg:hidden animate-fade-in"
                    onClick={() => setShowCustomerPanel(false)}
                />
            )}
        </div>
    );
}
