import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminDashboard from "./AdminDashboard";

export default async function AdminPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Since kdrnck1@gmail.com is master, we can hardcode email check or allow any logged-in user to see /admin if they are 'master'.
    // For now, allow the known master accounts or check a role if it exists.
    if (user.email !== "kdrnck1@gmail.com" && user.email !== "musait@musait.app") {
        // Just a basic safety check, redirect them back to the normal chat app.
        redirect("/");
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
