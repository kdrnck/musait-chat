import { NextResponse } from "next/server";
import { requireMasterAdmin, isErrorResponse } from "@/lib/admin-auth";

export async function GET() {
    try {
        const auth = await requireMasterAdmin();
        if (isErrorResponse(auth)) return auth;
        const { supabase } = auth;

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
