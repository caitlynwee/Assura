/**
 * admin.ts — Guarded service-role Supabase client (SERVER-ONLY).
 *
 * Full admin access via the service-role key (NEVER NEXT_PUBLIC_, never sent to
 * the browser). Imported solely by ensure-demo-user.ts / syncAuthMetadata — the
 * demo-user seed and metadata sync. Lazily constructed; returns null when the
 * URL or service-role key is absent so keyless builds/CLI runs never throw.
 *
 * Node runtime only.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readServiceRoleKey, readSupabaseEnv } from "./env";

let _admin: SupabaseClient | null = null;

/**
 * Returns the service-role admin client, or null when Supabase env or the
 * service-role key is absent. Callers treat null as "Supabase not configured"
 * and no-op with a warning (never throw).
 */
export function getAdminClient(): SupabaseClient | null {
  if (_admin) return _admin;
  const env = readSupabaseEnv();
  const serviceRoleKey = readServiceRoleKey();
  if (!env || !serviceRoleKey) return null;
  _admin = createClient(env.url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
