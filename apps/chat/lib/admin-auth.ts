import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const MASTER_EMAILS = new Set(
  (process.env.MASTER_ADMIN_EMAILS || "kdrnck1@gmail.com,musait@musait.app")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
);

export interface MasterAdminResult {
  supabase: ReturnType<typeof createAdminClient>;
  user: { id: string; email?: string | null; [key: string]: any };
}

/**
 * Verify the current request is from a master admin.
 * Returns { supabase, user } on success, or a NextResponse error on failure.
 */
export async function requireMasterAdmin(): Promise<MasterAdminResult | NextResponse> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check profiles.is_master flag
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_master")
    .eq("id", user.id)
    .single();

  const authorized =
    profile?.is_master === true ||
    (!!user.email && MASTER_EMAILS.has(user.email));

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Return service-role client so admin routes bypass RLS
  return { supabase: createAdminClient(), user };
}

/**
 * Type guard: check if requireMasterAdmin returned an error response.
 */
export function isErrorResponse(result: MasterAdminResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
