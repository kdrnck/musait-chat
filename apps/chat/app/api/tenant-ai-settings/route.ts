import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  AI_MODEL_PRESETS,
  DEFAULT_AI_MODEL_PROFILE,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_LLM_TIMEOUT_MS,
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
  bookingFlowEnabled: boolean;
  maxIterations: number;
  llmTimeoutMs: number;
  globalPromptText: string;
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

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Master admin: allow explicit tenantId query param
  const isMaster = user.app_metadata?.role === "master";
  const paramTenantId = request.nextUrl.searchParams.get("tenantId");

  let context: { tenantId: string | null; canEdit: boolean };
  if (isMaster && paramTenantId) {
    context = { tenantId: paramTenantId, canEdit: true };
  } else {
    context = await resolveTenantContext(supabase, user);
  }

  if (!context.tenantId) {
    return NextResponse.json(
      { error: "Tenant bulunamadı" },
      { status: 400 }
    );
  }

  const [tenantResult, globalResult] = await Promise.all([
    supabase
      .from("tenants")
      .select(
        "integration_keys,waba_phone_number_id,waba_access_token,waba_business_account_id,waba_verify_token,waba_app_secret"
      )
      .eq("id", context.tenantId)
      .single(),
    supabase
      .from("global_settings")
      .select("ai_system_prompt_text")
      .eq("id", "default")
      .single()
  ]);

  const { data: tenantData, error: tenantError } = tenantResult;
  const globalPrompt = globalResult.data?.ai_system_prompt_text || null;

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
      globalPrompt,
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
  bookingFlowEnabled?: boolean;
  maxIterations?: number;
  llmTimeoutMs?: number;
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

  // Master admin: allow explicit tenantId in request body
  const isMasterPut = user.app_metadata?.role === "master";
  let rawBody: UpdateBody & { tenantId?: string };
  try {
    rawBody = (await request.json()) as UpdateBody & { tenantId?: string };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek formatı." }, { status: 400 });
  }

  let context: { tenantId: string | null; canEdit: boolean };
  if (isMasterPut && rawBody.tenantId) {
    context = { tenantId: rawBody.tenantId, canEdit: true };
  } else {
    context = await resolveTenantContext(supabase, user);
  }

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

  const body: UpdateBody = rawBody;

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
  const bookingFlowEnabled = typeof body.bookingFlowEnabled === "boolean" ? body.bookingFlowEnabled : false;
  const maxIterations = normalizeInt(body.maxIterations, DEFAULT_MAX_ITERATIONS, 1, 10);
  const llmTimeoutMs = normalizeInt(body.llmTimeoutMs, DEFAULT_LLM_TIMEOUT_MS, 3000, 30000);

  if (!promptText) {
    return NextResponse.json(
      { error: "Prompt alanı boş olamaz." },
      { status: 400 }
    );
  }

  const [tenantResult, globalResult, modelRegistryResult] = await Promise.all([
    supabase
      .from("tenants")
      .select("integration_keys")
      .eq("id", context.tenantId)
      .single(),
    supabase
      .from("global_settings")
      .select("ai_system_prompt_text")
      .eq("id", "default")
      .single(),
    // Fetch provider_config from ai_models registry if model is set
    model
      ? supabase
          .from("ai_models")
          .select("provider_config")
          .eq("openrouter_id", model)
          .eq("is_enabled", true)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (tenantResult.error) {
    return NextResponse.json(
      { error: "Tenant ayarları alınamadı" },
      { status: 500 }
    );
  }

  const currentIntegrationKeys = asObject(
    (tenantResult.data as { integration_keys?: unknown } | null)?.integration_keys
  );

  const globalPrompt = globalResult.data?.ai_system_prompt_text || null;

  // Get provider_config from model registry (if model matched)
  const registryProviderConfig = modelRegistryResult?.data?.provider_config ?? null;

  const integrationKeys = {
    ...currentIntegrationKeys,
    ai_model_profile: modelProfile,
    ai_model: model,
    ai_provider_priority: providerPriority.join(","),
    ai_allow_fallbacks: String(allowFallbacks),
    ai_system_prompt_text: promptText,
    ai_outbound_number_mode: outboundNumberMode,
    ai_booking_flow_enabled: String(bookingFlowEnabled),
    ai_max_iterations: String(maxIterations),
    ai_llm_timeout_ms: String(llmTimeoutMs),
    // Write provider_config from model registry — worker uses this for OpenRouter routing
    ai_provider_config: registryProviderConfig,
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
      globalPrompt,
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
  globalPrompt?: string | null;
}): TenantAiResponse {
  const resolved = resolveAiSettingsFromIntegrationKeys(
    args.tenant.integration_keys,
    args.globalPrompt
  );
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
    bookingFlowEnabled: resolved.bookingFlowEnabled,
    maxIterations: resolved.maxIterations,
    llmTimeoutMs: resolved.llmTimeoutMs,
    globalPromptText: args.globalPrompt || "",
    wabaPhoneNumberId: args.canEdit ? wabaPhoneNumberId : "",
    wabaAccessToken: args.canEdit ? wabaAccessToken : "",
    wabaBusinessAccountId: args.canEdit ? wabaBusinessAccountId : "",
    wabaVerifyToken: args.canEdit ? wabaVerifyToken : "",
    wabaAppSecret: args.canEdit ? wabaAppSecret : "",
  };
}

function normalizeModelProfile(value: unknown): AiModelProfile {
  if (value === "cheap" || value === "fast" || value === "premium" || value === "oss-deepinfra" || value === "oss-groq") {
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
  return trimmed;
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
    .filter((item) => /^[a-z0-9_\-\/]{2,64}$/i.test(item));

  return providers.slice(0, 4);
}

function normalizeInt(value: unknown, defaultVal: number, min: number, max: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(min, Math.min(max, Math.round(value)));
  }
  return defaultVal;
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
