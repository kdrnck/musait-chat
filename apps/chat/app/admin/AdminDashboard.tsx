"use client";

import { useState } from "react";
import ChatLayout from "../components/ChatLayout";
import GlobalAiSettingsPanel from "./components/GlobalAiSettingsPanel";

interface Tenant {
    id: string;
    name: string;
    logo_url: string | null;
}

export default function AdminDashboard({
    userEmail,
    tenants,
}: {
    userEmail: string;
    tenants: Tenant[];
}) {
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(
        tenants.length > 0 ? tenants[0].id : null
    );

    const selectedTenant = tenants.find((t) => t.id === selectedTenantId);

    return (
        <div className="flex flex-col h-full w-full bg-[var(--color-surface-base)]">
            <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
                <GlobalAiSettingsPanel />

                <div className="mt-8 border-t border-[var(--color-border)] pt-8 h-[800px] mb-12">
                    <ChatLayout
                        tenantId={selectedTenant?.id ?? null}
                        tenantName={selectedTenant?.name ?? null}
                        tenantLogo={selectedTenant?.logo_url ?? null}
                        userEmail={userEmail}
                        isAdmin={true}
                        allTenants={tenants}
                        onTenantChange={setSelectedTenantId}
                    />
                </div>
            </div>
        </div>
    );
}
