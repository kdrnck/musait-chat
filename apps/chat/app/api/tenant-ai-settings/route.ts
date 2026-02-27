import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  AI_MODEL_PRESETS,
  DEFAULT_AI_MODEL_PROFILE,
  resolveAiSettingsFromIntegrationKeys,
  type AiModelProfile,
  type OutboundNumberMode,
} from "@/lib/ai/settings";

interface TenantAiResponse {
  tenantId: string;
  canEdit: boolean;
  modelProfile: AiModelProfile;
  model: string;
  providerPriority: string[];
  allowFallbacks: boolean;
  promptText: string;
  outboundNumberMode: OutboundNumberMode;
  wabaPhoneNumberId: string;
  wabaAccessToken: string;
  wabaBusinessAccountId: string;
  wabaVerifyToken: string;
  wabaAppSecret: string;
}

interface TenantSettingsRow {
  integration_keys: Record<string, unknown> | null;
  waba_phone_number_id: string | null;
  waba_access_token: string | null;
  waba_business_account_id: string | null;
  waba_verify_token: string | null;
  waba_app_secret: string | null;
}

type ChatSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await resolveTenantContext(supabase, user);
  if (!context.tenantId) {
    return NextResponse.json(
      { error: "Tenant bulunamadı" },
      { status: 400 }
    );
  }

  const { data: tenantData, error: tenantError } = await supabase
    .from("tenants")
    .select(
      "integration_keys,waba_phone_number_id,waba_access_token,waba_business_account_id,waba_verify_token,waba_app_secret"
    )
    .eq("id", context.tenantId)
    .single();

  if (tenantError || !tenantData) {
    return NextResponse.json(
      { error: "AI ayarları alınamadı" },
      { status: 500 }
    );
  }

  const tenant = tenantData as unknown as TenantSettingsRow;

  return NextResponse.json(
    buildResponse({
      tenantId: context.tenantId,
      canEdit: context.canEdit,
      tenant,
    })
  );
}

interface UpdateBody {
  modelProfile?: AiModelProfile;
  model?: string;
  providerPriority?: string[];
  allowFallbacks?: boolean;
  promptText?: string;
  outboundNumberMode?: OutboundNumberMode;
  wabaPhoneNumberId?: string;
  wabaAccessToken?: string;
  wabaBusinessAccountId?: string;
  wabaVerifyToken?: string;
  wabaAppSecret?: string;
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const context = await resolveTenantContext(supabase, user);
  if (!context.tenantId) {
    return NextResponse.json(
      { error: "Tenant bulunamadı" },
      { status: 400 }
    );
  }

  if (!context.canEdit) {
    return NextResponse.json(
      { error: "Bu ayarı sadece owner/admin güncelleyebilir." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as UpdateBody;

  const modelProfile = normalizeModelProfile(body.modelProfile);
  const preset = AI_MODEL_PRESETS[modelProfile];

  const model = normalizeModel(body.model) || preset.model;
  const providerPriority = normalizeProviderPriority(body.providerPriority);
  const allowFallbacks =
    typeof body.allowFallbacks === "boolean"
      ? body.allowFallbacks
      : preset.allowFallbacks;
  const promptText = normalizePrompt(body.promptText);
  const outboundNumberMode = normalizeOutboundMode(body.outboundNumberMode);

  if (!promptText) {
    return NextResponse.json(
      { error: "Prompt alanı boş olamaz." },
      { status: 400 }
    );
  }

  const { data: tenantData, error: tenantError } = await supabase
    .from("tenants")
    .select("integration_keys")
    .eq("id", context.tenantId)
    .single();

  if (tenantError) {
    return NextResponse.json(
      { error: "Tenant ayarları alınamadı" },
      { status: 500 }
    );
  }

  const currentIntegrationKeys = asObject(
    (tenantData as { integration_keys?: unknown } | null)?.integration_keys
  );

  const integrationKeys = {
    ...currentIntegrationKeys,
    ai_model_profile: modelProfile,
    ai_model: model,
    ai_provider_priority: providerPriority.join(","),
    ai_allow_fallbacks: String(allowFallbacks),
    ai_system_prompt_text: promptText,
    ai_outbound_number_mode: outboundNumberMode,
  } as Record<string, unknown>;

  const payload = {
    integration_keys: integrationKeys,
    waba_phone_number_id: normalizeNullable(body.wabaPhoneNumberId),
    waba_access_token: normalizeNullable(body.wabaAccessToken),
    waba_business_account_id: normalizeNullable(body.wabaBusinessAccountId),
    waba_verify_token: normalizeNullable(body.wabaVerifyToken),
    waba_app_secret: normalizeNullable(body.wabaAppSecret),
  };

  const { data: updatedData, error: updateError } = await supabase
    .from("tenants")
    .update(payload)
    .eq("id", context.tenantId)
    .select(
      "integration_keys,waba_phone_number_id,waba_access_token,waba_business_account_id,waba_verify_token,waba_app_secret"
    )
    .single();

  if (updateError || !updatedData) {
    return NextResponse.json(
      { error: "AI ayarları kaydedilemedi" },
      { status: 500 }
    );
  }

  const updated = updatedData as unknown as TenantSettingsRow;

  return NextResponse.json(
    buildResponse({
      tenantId: context.tenantId,
      canEdit: context.canEdit,
      tenant: updated,
    })
  );
}

async function resolveTenantContext(supabase: ChatSupabaseClient, user: User): Promise<{
  tenantId: string | null;
  canEdit: boolean;
}> {
  const tenantFromMetadata =
    normalizeNullable(user?.app_metadata?.tenant_id) ||
    normalizeNullable(user?.user_metadata?.tenant_id);

  let tenantId = tenantFromMetadata;

  if (!tenantId) {
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    tenantId = normalizeNullable(tenantUser?.tenant_id);
  }

  if (!tenantId) {
    return { tenantId: null, canEdit: false };
  }

  const { data: roleRow } = await supabase
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .single();

  const role = String(roleRow?.role || "").toLowerCase();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_master")
    .eq("id", user.id)
    .single();

  const canEdit =
    Boolean(profile?.is_master) ||
    role === "tenant_owner" ||
    role === "owner" ||
    role.includes("admin");

  return { tenantId, canEdit };
}

function buildResponse(args: {
  tenantId: string;
  canEdit: boolean;
  tenant: TenantSettingsRow;
}): TenantAiResponse {
  const resolved = resolveAiSettingsFromIntegrationKeys(args.tenant.integration_keys);
  const wabaPhoneNumberId = normalizeNullable(args.tenant.waba_phone_number_id) || "";
  const wabaAccessToken = normalizeNullable(args.tenant.waba_access_token) || "";
  const wabaBusinessAccountId =
    normalizeNullable(args.tenant.waba_business_account_id) || "";
  const wabaVerifyToken = normalizeNullable(args.tenant.waba_verify_token) || "";
  const wabaAppSecret = normalizeNullable(args.tenant.waba_app_secret) || "";

  return {
    tenantId: args.tenantId,
    canEdit: args.canEdit,
    modelProfile: resolved.modelProfile,
    model: resolved.model,
    providerPriority: resolved.providerPriority,
    allowFallbacks: resolved.allowFallbacks,
    promptText: resolved.promptText.replace(
      /\{\{tenant_id\}\}/gi,
      args.tenantId
    ),
    outboundNumberMode: resolved.outboundNumberMode,
    wabaPhoneNumberId: args.canEdit ? wabaPhoneNumberId : "",
    wabaAccessToken: args.canEdit ? wabaAccessToken : "",
    wabaBusinessAccountId: args.canEdit ? wabaBusinessAccountId : "",
    wabaVerifyToken: args.canEdit ? wabaVerifyToken : "",
    wabaAppSecret: args.canEdit ? wabaAppSecret : "",
  };
}

function normalizeModelProfile(value: unknown): AiModelProfile {
  if (value === "cheap" || value === "fast" || value === "premium") {
    return value;
  }
  return DEFAULT_AI_MODEL_PROFILE;
}

function normalizeModel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
}

function normalizePrompt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 8000);
}

function normalizeOutboundMode(value: unknown): OutboundNumberMode {
  if (value === "inbound" || value === "musait" || value === "tenant") {
    return value;
  }
  return "inbound";
}

function normalizeProviderPriority(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const providers = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => /^[a-z0-9_-]{2,32}$/i.test(item));

  return providers.slice(0, 4);
}

function normalizeNullable(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
