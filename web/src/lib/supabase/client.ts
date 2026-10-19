/**
 * client.ts — Guarded browser Supabase client (anon key, NEXT_PUBLIC_* only).
 *
 * Lazily constructed; returns null when Supabase env is absent so client
 * bundles and SSR never throw at import. Most auth is server-action driven,
 * so this is used only by "use client" components that need the session
 * client-side.
 */

import { createBrowserClient } from "@supabase/ssr";
import { readSupabaseEnv } from "./env";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let _client: BrowserClient | null = null;

/**
 * Returns the browser Supabase client, or null when keys are absent.
 * (Null means "Supabase not configured" — treat the user as signed-out.)
 */
export function getBrowserClient(): BrowserClient | null {
  if (_client) return _client;
  const env = readSupabaseEnv();
  if (!env) return null;
  _client = createBrowserClient(env.url, env.anonKey);
  return _client;
}
