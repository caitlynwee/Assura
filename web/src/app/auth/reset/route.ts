/**
 * GET /auth/reset — clears a session cookie whose user no longer exists
 * (e.g. after `seed/reset.sh`). Server components can't delete cookies, so
 * requireUser() redirects here instead of looping between /login and /compare.
 */

import { signOut } from "@/lib/auth";

export async function GET() {
  await signOut({ redirectTo: "/login" });
}
