/**
 * auth.ts — Full NextAuth.js v5 configuration (Node.js runtime only).
 *
 * Extends auth.config.ts with:
 *  - Credentials provider (bcrypt against users.json)
 *  - Brute-force throttle: 5 failed attempts per email per 15 min
 *  - Audit-chain events for login success / failure / lockout
 *  - A jwt callback that re-reads the user on every server-side request, so
 *    tier / onboarding changes apply immediately and deleted users are logged out.
 *    Call `refreshSessionCookie()` after changing tier/onboarding so the edge
 *    middleware (which can't read the DB) also sees the new values.
 *
 * This file uses Node.js APIs (bcrypt, fs via db.ts) — never import in middleware.
 */

import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { loginSchema } from "./validators";
import { findUserByEmail, findUserById } from "./users";
import { logEvent } from "./audit";
import { maskEmail } from "./utils";

// ─── Login throttle (in-memory; fine for a single-process demo) ──────────────

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const failedAttempts = new Map<string, number[]>();

function recentFailures(key: string): number[] {
  const cutoff = Date.now() - LOCKOUT_WINDOW_MS;
  const list = (failedAttempts.get(key) ?? []).filter((t) => t > cutoff);
  failedAttempts.set(key, list);
  return list;
}

export class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

// Compared against when the email is unknown, so response timing doesn't
// reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync("assura-timing-equaliser", 10);

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      if (!token.userId) return null;

      // Always reflect the latest stored state (tier upgrades, onboarding).
      const fresh = findUserById(token.userId);
      if (!fresh) return null; // user removed (e.g. seed reset) → sign out

      token.name = fresh.name;
      token.email = fresh.email;
      token.tier = fresh.tier;
      token.maskedInbox = fresh.maskedInbox;
      token.onboarded = fresh.onboarded;
      return token;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const { password } = parsed.data;

        if (recentFailures(email).length >= MAX_FAILED_ATTEMPTS) {
          logEvent("system", "auth.login.locked", { email: maskEmail(email) });
          throw new RateLimitedSignin();
        }

        const user = findUserByEmail(email);
        const valid = await bcrypt.compare(
          password,
          user?.passwordHash ?? DUMMY_HASH
        );

        if (!user || !valid) {
          recentFailures(email).push(Date.now());
          logEvent("system", "auth.login.failed", { email: maskEmail(email) });
          return null;
        }

        failedAttempts.delete(email);
        logEvent(user.id, "auth.login.success", {});

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier,
          maskedInbox: user.maskedInbox,
          onboarded: user.onboarded,
        };
      },
    }),
  ],
});

/** Re-issue the session cookie from the latest user record (server actions / route handlers only). */
export async function refreshSessionCookie(): Promise<void> {
  await unstable_update({ user: {} });
}
