import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function checkMasterAdmin(supabase: any) {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
        .from("profiles")
        .select("is_master")
        .eq("id", user.id)
        .single();

    if (!profile?.is_master && user.email !== "kdrnck1@gmail.com" && user.email !== "musait@musait.app") {
        return null;
    }

    return user;
}

export async function GET() {
    try {
        const supabase = await createClient();
        const user = await checkMasterAdmin(supabase);
        if (!user) {
            return NextResponse.json({ error: "Yetki yok — master admin gerekli" }, { status: 403 });
        }

        const { data, error } = await supabase
            .from("tenants")
            .select("id, name")
            .order("name", { ascending: true });

        if (error) {
            console.error("[admin/tenants GET]", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data ?? []);
    } catch (err) {
        console.error("[admin/tenants GET] unexpected:", err);
        return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
    }
}
