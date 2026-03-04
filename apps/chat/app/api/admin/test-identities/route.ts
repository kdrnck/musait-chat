import { NextResponse } from "next/server";

/**
 * Test Lab Identity CRUD API
 *
 * Test identities allow admins to simulate different customer personas.
 * For now, identities are managed client-side (localStorage).
 * This route provides a future-ready API structure.
 */

export async function GET() {
    return NextResponse.json({
        identities: [
            {
                id: "default",
                name: "Varsayılan Müşteri",
                phone: "+905550000000",
                description: "Kayıtsız yeni müşteri",
            },
        ],
        message: "Default identities. Custom identities stored locally.",
    });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, phone, description } = body;

        if (!name || !phone) {
            return NextResponse.json({ error: "name and phone are required" }, { status: 400 });
        }

        const identity = {
            id: `identity-${Date.now()}`,
            name,
            phone,
            description: description || "",
            createdAt: new Date().toISOString(),
        };

        return NextResponse.json({ identity, message: "Identity created (client-side)" });
    } catch (error) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
}
