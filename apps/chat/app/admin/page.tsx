import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminDashboard from "./AdminDashboard";

export default async function AdminPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Not logged in at all — go to dedicated admin login
    if (!user) {
        redirect("/admin/login");
    }

    // Logged in but not a master — go to admin login (not regular login)
    if (user.app_metadata?.role !== "master") {
        redirect("/admin/login");
    }

    // Fetch ALL tenants from Supabase
    const { data: tenants, error } = await supabase
        .from("tenants")
        .select("id, name, logo_url")
        .order("name", { ascending: true });

    if (error) {
        console.error("Failed to fetch tenants for admin dashboard:", error);
    }

    return (
        <AdminDashboard
            userEmail={user.email ?? "Admin"}
            tenants={tenants || []}
        />
    );
}
