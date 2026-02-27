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
    const [showCustomerPanel, setShowCustomerPanel] = useState(true);
    const [debugMode, setDebugMode] = useState(false);

    return (
        <div className="flex h-full w-full overflow-hidden bg-[var(--color-surface-base)] relative">
            {/* ── Left: Conversation Sidebar ── */}
            <aside
                className={`flex flex-col border-r bg-[var(--color-surface-1)] z-20 absolute inset-y-0 left-0 w-full md:relative md:w-[320px] lg:w-[320px] transition-transform duration-300 ease-in-out ${selectedConversationId ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}
                style={{
                    borderColor: "var(--color-border)",
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

            {/* ── Center: Chat View ── */}
            <main className="flex-1 flex flex-col min-w-0 bg-[var(--color-surface-2)] z-10 w-full">
                <ChatView
                    conversationId={selectedConversationId}
                    onToggleCustomerPanel={() => setShowCustomerPanel((p) => !p)}
                    showCustomerPanel={showCustomerPanel}
                    debugMode={debugMode}
                    onBack={() => setSelectedConversationId(null)}
                />
            </main>

            {/* ── Right: Customer Panel ── */}
            {showCustomerPanel && selectedConversationId && (
                <aside
                    className="hidden lg:flex flex-col border-l bg-[var(--color-surface-1)] z-10 w-[300px] flex-shrink-0"
                    style={{
                        borderColor: "var(--color-border)",
                    }}
                >
                    <CustomerPanel conversationId={selectedConversationId} />
                </aside>
            )}
        </div>
    );
}
