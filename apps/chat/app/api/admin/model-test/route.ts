import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const { messages, model, system, phone } = await req.json();

        const openrouter = createOpenRouter({
            apiKey: process.env.OPENROUTER_API_KEY,
        });

        const finalSystemPrompt = `${system}\n\nTest Numarası: ${phone || "Belirtilmedi"}`;

        const result = streamText({
            model: openrouter(model || "deepseek/deepseek-r1"),
            system: finalSystemPrompt,
            messages,
        });

        return result.toTextStreamResponse();
    } catch (error) {
        console.error("Model Test Error:", error);
        return new Response(
            JSON.stringify({ error: "Modele bağlanılamadı. OPENROUTER_API_KEY'ini kontrol et." }),
            { status: 500 }
        );
    }
}
