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

  // tenant_id is stored in app_metadata (set by Supabase admin on business account creation)
  // NOT in user_metadata — app_metadata is server-controlled and more reliable
  const tenantId =
    (user.app_metadata?.tenant_id as string) ||
    (user.user_metadata?.tenant_id as string) ||
    null;

  // Fetch tenant name and logo from Supabase
  let tenantName: string | null = null;
  let tenantLogo: string | null = null;
  if (tenantId) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, logo_url")
      .eq("id", tenantId)
      .single();
    tenantName = tenant?.name?.trim() ?? null;
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
