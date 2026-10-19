/**
 * auth.config.ts — Edge-runtime-safe NextAuth configuration.
 *
 * No Node.js APIs (no fs, no process.cwd, no bcrypt).
 * Used by middleware.ts which runs on the Edge Runtime.
 * auth.ts extends this with the full Credentials provider and a jwt callback
 * that re-reads the user record on every server-side request.
 */

import type { NextAuthConfig } from "next-auth";

/** Pages only for signed-out visitors; signed-in users are bounced to the app. */
const AUTH_PAGES = ["/login", "/signup"];

/** Premium-only areas. Free users are sent to /upgrade. (APIs are separately
 *  enforced by the policy engine — this is the UI layer of defence in depth.) */
export const PREMIUM_PATHS = ["/onboarding", "/outreach", "/crm", "/activity"];

function isPremiumPath(pathname: string): boolean {
  return PREMIUM_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Reachable without a session. */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/api/auth") ||
    pathname === "/auth/reset"
  );
}

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // Already signed in → skip login/signup.
      if (isLoggedIn && AUTH_PAGES.includes(pathname)) {
        return Response.redirect(new URL("/compare", nextUrl));
      }

      if (isLoggedIn && isPremiumPath(pathname) && auth?.user?.tier !== "premium") {
        const url = new URL("/upgrade", nextUrl);
        url.searchParams.set("from", pathname);
        return Response.redirect(url);
      }

      if (isPublicPath(pathname) || isLoggedIn) return true;

      // API callers get a JSON 401 instead of an HTML redirect to /login.
      if (pathname.startsWith("/api/")) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      return false; // redirect to /login?callbackUrl=...
    },
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tier = user.tier;
        token.maskedInbox = user.maskedInbox;
        token.onboarded = user.onboarded;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.tier = token.tier ?? "free";
      session.user.maskedInbox = token.maskedInbox ?? "";
      session.user.onboarded = token.onboarded ?? false;
      return session;
    },
  },
  // Needed for `next start` / Docker on localhost. The app is only served on
  // known hosts for the demo; set AUTH_URL in production deployments.
  trustHost: true,
  providers: [], // providers added in auth.ts (full server-side config)
  // Absolute 8h lifetime: middleware.ts deliberately strips Auth.js's rolling
  // cookie refresh (see comment there).
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
};
