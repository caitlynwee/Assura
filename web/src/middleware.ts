/**
 * middleware.ts — Edge middleware for auth protection.
 *
 * Uses the edge-safe auth config (no Node.js APIs).
 * Protects all routes under /(app) and /api (except /api/auth).
 */

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logos|.*\\.svg|.*\\.png|.*\\.ico).*)",
  ],
};
