/**
 * server.ts — Guarded cookie-bound server Supabase client.
 *
 * Used by the auth() facade, server actions, and route handlers. Bound to
 * next/headers cookies() so it reads and refreshes the Supabase session and
 * writes refreshed cookies back onto the response.
 *
 * When Supabase env is absent, getServerClient() returns a STUB whose auth
 * calls resolve to a null user/session and whose mutating calls reject with a
 * clear error — so `next build` and keyless tests never throw at import or
 * during route collection. (Mirrors the DeepSeek lazy-client pattern in ai.ts.)
 *
 * Node runtime only — never import from middleware/edge.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readSupabaseEnv } from "./env";

type RealServerClient = ReturnType<typeof createServerClient>;

/**
 * The subset of the Supabase client surface the app relies on. A stub
 * implements this shape when Supabase is not configured.
 */
export type AppSupabaseServerClient = Pick<RealServerClient, "auth">;

const NOT_CONFIGURED = "Supabase not configured";

function stubServerClient(): AppSupabaseServerClient {
  // Minimal no-op auth surface: everyone is signed-out; mutations reject.
  const auth = {
    async getUser() {
      return { data: { user: null }, error: null };
    },
    async getSession() {
      return { data: { session: null }, error: null };
    },
    async signInWithPassword() {
      return {
        data: { user: null, session: null },
        error: { message: NOT_CONFIGURED, name: "AuthError", status: 500 },
      };
    },
    async signUp() {
      return {
        data: { user: null, session: null },
        error: { message: NOT_CONFIGURED, name: "AuthError", status: 500 },
      };
    },
    async signOut() {
      return { error: null };
    },
    async refreshSession() {
      return {
        data: { user: null, session: null },
        error: { message: NOT_CONFIGURED, name: "AuthError", status: 500 },
      };
    },
    async updateUser() {
      return {
        data: { user: null },
        error: { message: NOT_CONFIGURED, name: "AuthError", status: 500 },
      };
    },
    async exchangeCodeForSession() {
      return {
        data: { user: null, session: null },
        error: { message: NOT_CONFIGURED, name: "AuthError", status: 500 },
      };
    },
    async verifyOtp() {
      return {
        data: { user: null, session: null },
        error: { message: NOT_CONFIGURED, name: "AuthError", status: 500 },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { auth };
}

/**
 * Create a cookie-bound server Supabase client (or a stub when keys are absent).
 * Not memoized: each request binds to its own cookie store.
 */
export async function getServerClient(): Promise<AppSupabaseServerClient> {
  const env = readSupabaseEnv();
  if (!env) return stubServerClient();

  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where cookies are read-only. The
          // middleware refreshes the session cookie instead, so this is safe
          // to ignore (standard @supabase/ssr guidance).
        }
      },
    },
  });
}
