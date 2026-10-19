/**
 * env.ts — Shared Supabase env reader + keyless guard.
 *
 * All three Supabase client factories (client/server/admin) use readSupabaseEnv()
 * so that `next build` and test imports never throw when keys are absent — they
 * construct a null-session/erroring-on-mutation stub instead. This mirrors the
 * lazy no-throw pattern in ai.ts / quarantine.ts.
 */

export interface SupabasePublicEnv {
  url: string;
  anonKey: string;
}

/**
 * Returns the public Supabase env (URL + anon key) or null when either is
 * missing/empty. Callers treat null as "Supabase not configured" and fall back
 * to a stub client — never throwing at import time.
 */
export function readSupabaseEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** Service-role key (server-only, never NEXT_PUBLIC_), or null when absent. */
export function readServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return key ? key : null;
}

/** JWT secret (server-only) used for local edge token verification, or null. */
export function readJwtSecret(): string | null {
  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  return secret ? secret : null;
}
