/**
 * view-mode.ts — Pure helper for the admin-only "View as role" switcher.
 *
 * COSMETIC ONLY. This resolves what tier the UI should *render as* for a preview;
 * it is NOT a security boundary. Real authorization stays in `auth-routing.ts`
 * (edge middleware) and is gated by the JWT tier. Nothing here changes the user's
 * real tier, DB row, Supabase app_metadata, or session.
 *
 * Framework-free (no React, no next/headers, no DB) so it can be imported from the
 * client provider, the server layout, and unit tests alike — one source of truth.
 */

import type { UserTier } from "./types";

/** A preview view tier is just a user tier. */
export type ViewTier = UserTier;

/** Cookie the server layout reads to render the right initial nav (no flash).
 *  Plain (not httpOnly / __Secure-) on purpose: the client provider must also
 *  read and write it with document.cookie. It carries NO security meaning —
 *  the resolver below ignores it entirely for non-admins. */
export const VIEW_COOKIE_NAME = "assura_view_as";

/** localStorage key the client provider uses as its fast path. */
export const VIEW_STORAGE_KEY = "assura:view-as";

const ALL_TIERS: readonly UserTier[] = ["free", "premium", "admin"];

/** Type guard: is the value one of the three valid tiers? */
export function isValidViewTier(v: unknown): v is UserTier {
  return typeof v === "string" && (ALL_TIERS as readonly string[]).includes(v);
}

/**
 * Resolve the effective (cosmetic) view tier.
 *
 * Rule: only a real admin may preview a different tier. For everyone else the
 * requested view is ignored and the real tier is returned — so a real free or
 * premium user can never cosmetically upgrade themselves via the cookie.
 */
export function resolveEffectiveViewTier(
  realTier: UserTier,
  requestedView: string | null | undefined
): UserTier {
  if (realTier === "admin" && isValidViewTier(requestedView)) {
    return requestedView;
  }
  return realTier;
}
