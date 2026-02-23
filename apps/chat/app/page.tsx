import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatLayout from "./components/ChatLayout";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get tenant_id from user metadata (set by musait.app on business login)
  const tenantId = (user.user_metadata?.tenant_id as string) || null;

  // Fetch tenant name from Supabase if we have a tenant_id
  let tenantName: string | null = null;
  let tenantLogo: string | null = null;
  if (tenantId) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, logo_url")
      .eq("id", tenantId)
      .single();
    tenantName = tenant?.name ?? null;
    tenantLogo = tenant?.logo_url ?? null;
  }

  return (
    <ChatLayout
      tenantId={tenantId}
      tenantName={tenantName}
      tenantLogo={tenantLogo}
      userEmail={user.email ?? null}
    />
  );
}
