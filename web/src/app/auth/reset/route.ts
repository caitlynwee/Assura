/**
 * GET /auth/reset — clears a session cookie whose user no longer exists
 * (e.g. after `seed/reset.sh`). Server components can't delete cookies, so
 * requireUser() redirects here instead of looping between /login and /compare.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/stripe";

export async function GET(request: Request) {
  void request;
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (/^(?:__Secure-)?sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name)) {
      cookieStore.delete(cookie.name);
    }
  }
  // Use the configured site origin so the redirect never leaks the container's
  // HOSTNAME=0.0.0.0 bind host back to the browser.
  return NextResponse.redirect(new URL("/login?error=session-expired", getSiteUrl()));
}
