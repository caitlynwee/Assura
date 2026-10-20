/**
 * auth.ts — Supabase-backed auth facade (Node.js runtime only).
 *
 * Replaces the old NextAuth v5 config. Supabase Auth now verifies credentials
 * and issues the session; this facade maps the Supabase session back to the
 * app's Drizzle `users` row (the source of truth for id/tier/etc.) so the ~16
 * `auth()` call sites and `crm-api.test.ts`'s `jest.mock("@/lib/auth", …)`
 * keep working against the SAME shape and import path.
 *
 * Uses Node.js APIs (DB via db.ts, next/headers via the server client) — never
 * import this from middleware/edge. The edge reads tier from the JWT instead.
 */

import { redirect } from "next/navigation";
import { getServerClient } from "./supabase/server";
import { resolveOrCreateAuthUser } from "./users";
import { syncAuthMetadata } from "./supabase/ensure-demo-user";
import type { UserTier } from "./types";

export type AppSession = {
  user: {
    id: string; // app user id (text, e.g. "user_demo")
    tier: UserTier; // from the app users row (source of truth)
    maskedInbox: string;
    onboarded: boolean;
    email: string;
    name: string;
  };
} | null;

/**
 * Resolve the current session: verify the Supabase user, map to the app row.
 * The app row is the authority for `tier` (server reads are always fresh —
 * the JWT `app_metadata` copy exists only for the edge, which can't hit the DB).
 * Returns null (signed-out) when there is no Supabase user or no linked app row.
 */
export async function auth(): Promise<AppSession> {
  const supabase = await getServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (
    error?.code === "refresh_token_not_found" ||
    (error?.status === 400 && /invalid refresh token/i.test(error.message))
  ) {
    redirect("/auth/reset");
  }
  if (!user) return null;

  const appUser = await resolveOrCreateAuthUser(user);
  if (!appUser) return null;

  return {
    user: {
      id: appUser.id,
      tier: appUser.tier,
      maskedInbox: appUser.maskedInbox,
      onboarded: appUser.onboarded,
      email: appUser.email,
      name: appUser.name,
    },
  };
}

/** Sign out via Supabase and redirect (clears the Supabase session cookies). */
export async function signOut(opts?: { redirectTo?: string }): Promise<void> {
  const supabase = await getServerClient();
  await supabase.auth.signOut();
  redirect(opts?.redirectTo ?? "/");
}

/**
 * Re-sync app_metadata (tier/onboarded) into the Supabase identity and refresh
 * the session cookie so the edge sees the new values on the next request.
 * Called after tier/onboarding changes. No-op-safe when keys are absent.
 */
export async function refreshSessionCookie(): Promise<AppSession> {
  const session = await auth();
  if (!session?.user?.id) return null;

  await syncAuthMetadata(session.user.id);
  const supabase = await getServerClient();
  // A plain refresh re-reads the user and re-embeds the current app_metadata
  // into the newly-minted access token; the server client's setAll writes the
  // refreshed cookie onto the response. (Live-project assumption — see the
  // design's demo-setup checklist for the named fallback if a plain refresh
  // does not pick up the updated app_metadata.)
  const { error } = await supabase.auth.refreshSession();
  if (error) throw new Error(`Could not refresh Supabase session: ${error.message}`);
  return session;
}
