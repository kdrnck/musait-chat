import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../lib/convex-api.js";
import { SUPABASE_CONFIG } from "../../config.js";
import { getCustomerByPhone } from "../../services/customers.js";
import { capitalizeName, isLikelyRealName } from "../customer-name.js";

interface ToolContext {
  tenantId: string;
  conversationId: string;
  customerPhone: string;
}

/**
 * update_customer_name - Müşterinin adını ve/veya soyadını günceller.
 *
 * WhatsApp üzerinden müşterinin kendi adını veya soyadını düzeltmesine ya da
 * eklemesine olanak tanır. Değişiklik hem Supabase customers tablosuna hem de
 * Convex customerProfiles.preferences'a yansıtılır.
 *
 * Kullanım örnekleri:
 * - "Adımı yanlış yazmışsınız, Ahmet değil Ahmed"
 * - "Soyadım Yılmaz"
 * - "Adım Mehmet Soyadım Kaya"
 */
export async function updateCustomerName(
  convex: ConvexHttpClient,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const firstNameRaw = (args.first_name as string | undefined)?.trim() || null;
  const lastNameRaw = (args.last_name as string | undefined)?.trim() || null;

  if (!firstNameRaw && !lastNameRaw) {
    return {
      success: false,
      message: "Lütfen güncellemek istediğiniz ad veya soyadı belirtin.",
    };
  }

  // Validate name parts
  if (firstNameRaw && !isLikelyRealName(firstNameRaw)) {
    return {
      success: false,
      message: `"${firstNameRaw}" geçerli bir isim gibi görünmüyor. Lütfen gerçek adınızı girin.`,
    };
  }

  if (lastNameRaw && !isLikelyRealName(lastNameRaw)) {
    return {
      success: false,
      message: `"${lastNameRaw}" geçerli bir soyad gibi görünmüyor. Lütfen gerçek soyadınızı girin.`,
    };
  }

  const firstName = firstNameRaw ? capitalizeName(firstNameRaw) : null;
  const lastName = lastNameRaw ? capitalizeName(lastNameRaw) : null;

  // ─── 1. Fetch existing Supabase customer record ───────────────────────────
  const existingCustomer = await getCustomerByPhone(ctx.tenantId, ctx.customerPhone);

  // Parse existing name to preserve the part not being updated
  let existingFirst: string | null = null;
  let existingLast: string | null = null;

  if (existingCustomer?.name) {
    const parts = existingCustomer.name.trim().split(/\s+/);
    existingFirst = parts[0] ?? null;
    existingLast = parts.slice(1).join(" ") || null;
  }

  const newFirst = firstName ?? existingFirst ?? "";
  const newLast = lastName ?? existingLast ?? null;
  const fullName = newLast ? `${newFirst} ${newLast}`.trim() : newFirst.trim();

  if (!fullName) {
    return {
      success: false,
      message: "Ad bilgisi oluşturulamadı. Lütfen adınızı tekrar yazın.",
    };
  }

  const supabaseHeaders = {
    "Content-Type": "application/json",
    apikey: SUPABASE_CONFIG.serviceKey,
    Authorization: `Bearer ${SUPABASE_CONFIG.serviceKey}`,
    Prefer: "return=representation",
  };

  // ─── 2. Update Supabase customers.name ────────────────────────────────────
  if (existingCustomer) {
    const patchRes = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/customers?id=eq.${existingCustomer.id}&tenant_id=eq.${ctx.tenantId}`,
      {
        method: "PATCH",
        headers: supabaseHeaders,
        body: JSON.stringify({ name: fullName }),
      }
    );

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error(`❌ Failed to update customer name in Supabase:`, errText);
      return {
        success: false,
        message: "İsim güncellenemedi. Lütfen tekrar deneyin.",
      };
    }
  } else {
    // No Supabase customer yet — will be created at first appointment
    console.log(`⚠️ No Supabase customer record for ${ctx.customerPhone}, skipping Supabase update`);
  }

  // ─── 3. Update Convex customerProfiles.preferences.customerName ──────────
  try {
    const profile = await convex.query(api.customerProfiles.getByPhone, {
      tenantId: ctx.tenantId,
      customerPhone: ctx.customerPhone,
    });

    const existingPrefs =
      profile?.preferences && typeof profile.preferences === "object"
        ? (profile.preferences as Record<string, unknown>)
        : {};

    const updatedPrefs = {
      ...existingPrefs,
      customerName: fullName,
      ...(firstName ? { customerFirstName: firstName } : {}),
      ...(lastName ? { customerLastName: lastName } : {}),
    };

    await convex.mutation(api.customerProfiles.upsert, {
      tenantId: ctx.tenantId,
      customerPhone: ctx.customerPhone,
      preferences: updatedPrefs,
    });
  } catch (err) {
    // Not fatal — Supabase update already succeeded
    console.warn(`⚠️ Failed to update Convex profile for ${ctx.customerPhone}:`, err);
  }

  console.log(`✅ Customer name updated: ${ctx.customerPhone} → "${fullName}"`);

  const updatedParts: string[] = [];
  if (firstName) updatedParts.push(`ad: ${firstName}`);
  if (lastName) updatedParts.push(`soyad: ${lastName}`);

  return {
    success: true,
    fullName,
    message: `Bilgileriniz güncellendi (${updatedParts.join(", ")}).`,
  };
}
