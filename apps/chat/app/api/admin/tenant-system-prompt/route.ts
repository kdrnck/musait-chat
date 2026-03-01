import { NextRequest, NextResponse } from "next/server";
import { requireMasterAdmin, isErrorResponse } from "@/lib/admin-auth";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  return "";
}

export async function GET(request: NextRequest) {
  const auth = await requireMasterAdmin();
  if (isErrorResponse(auth)) return auth;
  const { supabase } = auth;

  const tenantId = request.nextUrl.searchParams.get("tenantId");
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId zorunlu" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tenants")
    .select("integration_keys")
    .eq("id", tenantId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Tenant alınamadı" }, { status: 500 });
  }

  const keys = asObject((data as { integration_keys?: unknown }).integration_keys);
  const promptText = asString(keys.ai_system_prompt_text);

  return NextResponse.json({ tenantId, promptText });
}

export async function PUT(request: NextRequest) {
  const auth = await requireMasterAdmin();
  if (isErrorResponse(auth)) return auth;
  const { supabase } = auth;

  const body = (await request.json()) as { tenantId?: string; promptText?: string };
  const tenantId = (body.tenantId || "").trim();
  const promptText = typeof body.promptText === "string" ? body.promptText.trim() : "";

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId zorunlu" }, { status: 400 });
  }

  const { data: existingRow, error: fetchError } = await supabase
    .from("tenants")
    .select("integration_keys")
    .eq("id", tenantId)
    .single();

  if (fetchError || !existingRow) {
    return NextResponse.json({ error: "Tenant ayarları alınamadı" }, { status: 500 });
  }

  const currentKeys = asObject(
    (existingRow as { integration_keys?: unknown }).integration_keys
  );

  const integrationKeys = {
    ...currentKeys,
    ai_system_prompt_text: promptText,
  } as Record<string, unknown>;

  const { data: updated, error: updateError } = await supabase
    .from("tenants")
    .update({ integration_keys: integrationKeys })
    .eq("id", tenantId)
    .select("integration_keys")
    .single();

  if (updateError || !updated) {
    console.error("[tenant-system-prompt PUT] Update error:", updateError);
    return NextResponse.json(
      { error: "Prompt kaydedilemedi (RLS/policy olabilir)." },
      { status: 500 }
    );
  }

  const updatedKeys = asObject((updated as { integration_keys?: unknown }).integration_keys);
  const updatedPromptText = asString(updatedKeys.ai_system_prompt_text);

  return NextResponse.json({ tenantId, promptText: updatedPromptText });
}
