/**
 * auth.config.ts — Edge-runtime-safe NextAuth configuration.
 *
 * No Node.js APIs (no fs, no process.cwd, no bcrypt).
 * Used by middleware.ts which runs on the Edge Runtime.
 * auth.ts extends this with the full Credentials provider.
 */

import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublic =
        nextUrl.pathname === "/" ||
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/api/auth");

      if (isPublic) return true;
      if (isLoggedIn) return true;

      return false; // redirect to /login
    },
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.tier = (user as any).tier;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.maskedInbox = (user as any).maskedInbox;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.onboarded = (user as any).onboarded;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).tier = token.tier;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).maskedInbox = token.maskedInbox;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).onboarded = token.onboarded;
      return session;
    },
  },
  providers: [], // providers added in auth.ts (full server-side config)
  session: { strategy: "jwt" },
};
