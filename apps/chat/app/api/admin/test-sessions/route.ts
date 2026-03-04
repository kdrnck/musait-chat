import { NextResponse } from "next/server";

/**
 * Test Lab Session Persistence API
 *
 * Sessions are stored in localStorage on the client side.
 * This route provides a future-ready API structure for server-side
 * session persistence if needed (e.g. sharing sessions between admins).
 *
 * For now, session save/load is handled entirely client-side.
 * This route returns a placeholder so the frontend can reference it.
 */

export async function GET() {
    // In a future version, this could query a sessions table
    return NextResponse.json({
        sessions: [],
        message: "Test Lab sessions are stored locally. Server persistence coming soon.",
    });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, config, messages } = body;

        if (!name || !config) {
            return NextResponse.json({ error: "name and config are required" }, { status: 400 });
        }

        // Future: Save to database
        const session = {
            id: `session-${Date.now()}`,
            name,
            config,
            messages: messages || [],
            createdAt: new Date().toISOString(),
        };

        return NextResponse.json({ session, message: "Session saved (client-side)" });
    } catch (error) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
}
