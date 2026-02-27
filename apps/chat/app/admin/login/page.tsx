import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminLoginForm from "./AdminLoginForm";

export default async function AdminLoginPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Already logged in as master — go straight to admin
    if (user && user.app_metadata?.role === "master") {
        redirect("/admin");
    }

    return <AdminLoginForm />;
}
