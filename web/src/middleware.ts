/**
 * middleware.ts — Edge middleware for auth protection.
 *
 * Uses the edge-safe auth config (no Node.js APIs). Route rules live in
 * auth.config.ts `authorized()`:
 *   - signed-out → /login (pages) or JSON 401 (APIs)
 *   - free tier on premium pages → /upgrade
 *   - signed-in on /login or /signup → /compare
 *
 * Why the wrapper: Auth.js re-issues the session cookie on *every* middleware
 * response (rolling refresh). A background prefetch that is in flight when the
 * user signs out then lands after logout and resurrects the session. We strip
 * that refresh, so the session cookie is only ever written by sign-in,
 * explicit session updates, and sign-out. Sessions therefore have an absolute
 * lifetime (session.maxAge in auth.config.ts) rather than a sliding one.
 *
 * (Next 16 deprecates `middleware` in favour of `proxy`, but proxy can't run on
 * the edge runtime this config relies on — keep as middleware for now.)
 */

import NextAuth from "next-auth";
import type { NextFetchEvent, NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";

const authMiddleware = NextAuth(authConfig).auth as unknown as (
  req: NextRequest,
  ev: NextFetchEvent
) => Promise<Response>;

const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?=/;

export default async function middleware(req: NextRequest, ev: NextFetchEvent) {
  const res = await authMiddleware(req, ev);

  const setCookies = res.headers.getSetCookie();
  if (!setCookies.some((c) => SESSION_COOKIE.test(c))) return res;

  const headers = new Headers(res.headers);
  headers.delete("set-cookie");
  for (const c of setCookies) {
    if (!SESSION_COOKIE.test(c)) headers.append("set-cookie", c);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logos|.*\\.svg|.*\\.png|.*\\.ico).*)",
  ],
};
