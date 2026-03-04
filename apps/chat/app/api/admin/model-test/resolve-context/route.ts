import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveModelTestPromptContext } from "../prompt-context";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      tenantId?: string;
      phone?: string;
      system?: string;
    };

    const tenantId = (body.tenantId || "").trim();
    const phone = (body.phone || "").trim() || "+905550000000";
    const system = typeof body.system === "string" ? body.system : "";

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId zorunludur." }, { status: 400 });
    }

    const supabase = await createClient();
    const resolved = await resolveModelTestPromptContext({
      supabase,
      tenantId,
      phone,
      systemPrompt: system,
    });

    return NextResponse.json({
      placeholders: resolved.placeholders,
      resolvedPrompt: resolved.resolvedPrompt,
      unresolvedPlaceholders: resolved.unresolvedPlaceholders,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Prompt context çözümlenirken hata oluştu.",
      },
      { status: 500 }
    );
  }
}
