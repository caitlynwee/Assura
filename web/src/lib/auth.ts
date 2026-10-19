/**
 * auth.ts — Full NextAuth.js v5 configuration (Node.js runtime only).
 *
 * Extends auth.config.ts with the Credentials provider.
 * This file uses Node.js APIs (bcrypt, fs via db.ts) — never import in middleware.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { readJSON } from "./db";
import { loginSchema } from "./validators";
import type { User } from "./types";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        let users: User[];
        try {
          users = readJSON<User[]>("users.json");
        } catch {
          return null;
        }

        const user = users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        );
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

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
