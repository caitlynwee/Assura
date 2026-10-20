/**
 * session.ts — Server-side helpers for pages and layouts (Node.js only).
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { findUserById, toPublicUser } from "./users";
import type { PublicUser } from "./types";

/** Fresh user record for the current session (no passwordHash), or null. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await findUserById(session.user.id);
  return user ? toPublicUser(user) : null;
}

/** Like getCurrentUser, but redirects when signed out. */
export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (user) return user;

  // A session cookie exists but its user is gone (e.g. data was reset):
  // clear it via a route handler, otherwise middleware still sees "signed in".
  const jar = await cookies();
  // Supabase cookie name is `sb-<project-ref>-auth-token`, optionally chunked
  // (`.0`, `.1`, …) and optionally `__Secure-` prefixed. Match ref-agnostically.
  const hasSessionCookie = jar
    .getAll()
    .some((c) => /^(__Secure-)?sb-[a-z0-9]+-auth-token(\.\d+)?$/.test(c.name));
  redirect(hasSessionCookie ? "/auth/reset" : "/login");
}

/** Like requireUser, but redirects non-admin users away from operations pages. */
export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireUser();
  if (user.tier !== "admin") redirect("/compare");
  return user;
}
