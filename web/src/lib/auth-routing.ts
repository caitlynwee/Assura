/**
 * auth-routing.ts — Edge-safe, pure routing rules for auth gating.
 *
 * No Node.js APIs, no DB, no next-auth, no next/headers — safe to import from
 * the edge middleware. Reimplements the gating logic that previously lived in
 * auth.config.ts `authorized()`, as a pure function so it is trivially unit-
 * testable and shared between middleware and tests.
 */

import type { UserTier } from "./types";

/** Pages only for signed-out visitors; signed-in users are bounced to the app. */
export const AUTH_PAGES = ["/login", "/signup"];

/** Premium-only areas. Free users are sent to /upgrade. (APIs are separately
 *  enforced by the policy engine — this is the UI layer of defence in depth.) */
export const PREMIUM_PATHS = ["/onboarding", "/outreach", "/crm", "/activity"];
export const ADMIN_PATHS = ["/admin"];

export function isPremiumPath(pathname: string): boolean {
  return PREMIUM_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Reachable without a session. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/api/auth") ||
    pathname === "/auth/reset" ||
    // Server-to-server callbacks (Python outreach server → web). No user
    // session exists; each route enforces the x-internal-api-key header itself.
    pathname.startsWith("/api/internal/")
  );
}

export type RouteAction =
  | { type: "allow" }
  | { type: "redirect"; to: string }
  | { type: "json401" };

export interface RouteContext {
  pathname: string;
  isLoggedIn: boolean;
  tier: UserTier;
}

/**
 * Pure gating decision reproducing every rule from the old authorized():
 *   - signed-in on /login or /signup → redirect /compare
 *   - signed-in + premium path + tier !== "premium" → redirect /upgrade?from=
 *   - public path or signed-in → allow
 *   - signed-out /api/* → JSON 401
 *   - else (signed-out page) → redirect /login
 */
export function evaluateRoute({ pathname, isLoggedIn, tier }: RouteContext): RouteAction {
  // Already signed in → skip login/signup.
  if (isLoggedIn && AUTH_PAGES.includes(pathname)) {
    return { type: "redirect", to: "/compare" };
  }

  if (isLoggedIn && isPremiumPath(pathname) && tier !== "premium" && tier !== "admin") {
    return { type: "redirect", to: `/upgrade?from=${encodeURIComponent(pathname)}` };
  }

  if (isLoggedIn && isAdminPath(pathname) && tier !== "admin") {
    return { type: "redirect", to: "/compare" };
  }

  if (isPublicPath(pathname) || isLoggedIn) return { type: "allow" };

  // API callers get a JSON 401 instead of an HTML redirect to /login.
  if (pathname.startsWith("/api/")) return { type: "json401" };

  return { type: "redirect", to: "/login" };
}
