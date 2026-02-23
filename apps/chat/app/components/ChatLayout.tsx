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
}

export default function ChatLayout({
    tenantId,
    tenantName,
    tenantLogo,
    userEmail,
}: ChatLayoutProps) {
    const [selectedConversationId, setSelectedConversationId] =
        useState<Id<"conversations"> | null>(null);
    const [showCustomerPanel, setShowCustomerPanel] = useState(true);

    return (
        <div className="flex h-dvh w-full overflow-hidden">
            {/* ── Left: Conversation Sidebar ── */}
            <aside
                className="flex flex-col border-r"
                style={{
                    width: 320,
                    minWidth: 320,
                    background: "var(--color-surface-1)",
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
                />
            </aside>

            {/* ── Center: Chat View ── */}
            <main className="flex-1 flex flex-col min-w-0">
                <ChatView
                    conversationId={selectedConversationId}
                    onToggleCustomerPanel={() => setShowCustomerPanel((p) => !p)}
                    showCustomerPanel={showCustomerPanel}
                />
            </main>

            {/* ── Right: Customer Panel ── */}
            {showCustomerPanel && selectedConversationId && (
                <aside
                    className="flex flex-col border-l"
                    style={{
                        width: 300,
                        minWidth: 300,
                        background: "var(--color-surface-1)",
                        borderColor: "var(--color-border)",
                    }}
                >
                    <CustomerPanel conversationId={selectedConversationId} />
                </aside>
            )}
        </div>
    );
}
