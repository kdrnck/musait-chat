import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveTenantAiSettings,
  type OutboundNumberMode,
} from "../agent/tenant-ai-settings.js";

interface RouteResult {
  phoneNumberId: string;
  accessToken: string;
  mode: OutboundNumberMode;
}

export async function resolveOutboundRoute(args: {
  supabase: SupabaseClient;
  tenantId: string | null | undefined;
  inboundPhoneNumberId?: string | null;
  inboundAccessToken?: string | null;
}): Promise<RouteResult> {
  const fallbackPhoneNumberId =
    args.inboundPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const fallbackAccessToken =
    args.inboundAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || "";

  if (!args.tenantId) {
    return {
      phoneNumberId: fallbackPhoneNumberId,
      accessToken: fallbackAccessToken,
      mode: "inbound",
    };
  }

  const { data: tenantCfg, error } = await args.supabase
    .from("tenants")
    .select("waba_phone_number_id, waba_access_token, integration_keys")
    .eq("id", args.tenantId)
    .single();

  if (error || !tenantCfg) {
    return {
      phoneNumberId: fallbackPhoneNumberId,
      accessToken: fallbackAccessToken,
      mode: "inbound",
    };
  }

  const aiSettings = resolveTenantAiSettings(
    (tenantCfg.integration_keys as Record<string, unknown> | null) || null
  );

  if (aiSettings.outboundNumberMode === "musait") {
    return {
      phoneNumberId:
        process.env.WHATSAPP_PHONE_NUMBER_ID || fallbackPhoneNumberId,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || fallbackAccessToken,
      mode: "musait",
    };
  }

  if (aiSettings.outboundNumberMode === "tenant") {
    const tenantPhone = normalizeValue(tenantCfg.waba_phone_number_id);
    const tenantToken = normalizeValue(tenantCfg.waba_access_token);

    return {
      phoneNumberId: tenantPhone || fallbackPhoneNumberId,
      accessToken: tenantToken || fallbackAccessToken,
      mode: "tenant",
    };
  }

  return {
    phoneNumberId: fallbackPhoneNumberId,
    accessToken: fallbackAccessToken,
    mode: "inbound",
  };
}

function normalizeValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
