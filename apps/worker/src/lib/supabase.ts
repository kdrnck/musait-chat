// Supabase Admin Client Factory
// Creates a Supabase client with service_role key for server-side operations.
// This client has FULL access — use with extreme care.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CONFIG } from "../config.js";

let adminClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase admin client.
 * Uses service_role key — NEVER expose this to frontend.
 *
 * Singleton pattern — reuses the same client across the worker process.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.serviceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment"
    );
  }

  adminClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log("✅ Supabase admin client initialized");
  return adminClient;
}
