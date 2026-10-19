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
  const hasSessionCookie = jar
    .getAll()
    .some((c) => /^(__Secure-)?authjs\.session-token/.test(c.name));
  redirect(hasSessionCookie ? "/auth/reset" : "/login");
}
