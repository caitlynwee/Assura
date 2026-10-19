/**
 * middleware.ts — Edge middleware for auth gating (Supabase Auth).
 *
 * Reads the Supabase session from the request cookies via @supabase/ssr and
 * verifies the access-token signature LOCALLY with jose (HS256 against
 * SUPABASE_JWT_SECRET) — it deliberately does NOT call supabase.auth.getUser(),
 * which would be a per-request network round-trip to the Supabase Auth server.
 * Local verification closes the forgery gap (getSession() alone trusts the
 * cookie) while keeping edge gating purely local-crypto (no DB, no network).
 *
 * `tier`/`onboarded` are read from the verified token's app_metadata claim and
 * fed to the pure evaluateRoute() rules in auth-routing.ts, reproducing every
 * previous gating rule. Refreshed Supabase cookies are written back onto the
 * response via the ssr setAll callback.
 *
 * Keyless-safe: if Supabase env or the JWT secret is absent, every request is
 * treated as signed-out, so `next build`'s route analysis never crashes.
 *
 * Edge runtime — imports only @supabase/ssr, jose, next/server, and the pure
 * edge-safe auth-routing module. NEVER import db.ts / next-auth / next/headers.
 */

import { createServerClient } from "@supabase/ssr";
import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { evaluateRoute } from "@/lib/auth-routing";
import type { UserTier } from "@/lib/types";

interface EdgeSession {
  isLoggedIn: boolean;
  tier: UserTier;
}

const SIGNED_OUT: EdgeSession = { isLoggedIn: false, tier: "free" };

export default async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const jwtSecret = process.env.SUPABASE_JWT_SECRET?.trim();

  let session = SIGNED_OUT;

  if (url && anonKey && jwtSecret) {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options);
          }
        },
      },
    });

    // Local cookie decode (no network). getUser() is intentionally NOT used.
    const {
      data: { session: sbSession },
    } = await supabase.auth.getSession();

    if (sbSession?.access_token) {
      session = await verifyAccessToken(sbSession.access_token, jwtSecret);
    }
  }

  const action = evaluateRoute({
    pathname: req.nextUrl.pathname,
    isLoggedIn: session.isLoggedIn,
    tier: session.tier,
  });

  switch (action.type) {
    case "allow":
      return res;
    case "json401":
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    case "redirect": {
      const to = new URL(action.to, req.nextUrl);
      return NextResponse.redirect(to);
    }
  }
}

/** Verify the access-token signature locally (HS256) and extract tier. */
async function verifyAccessToken(
  accessToken: string,
  jwtSecret: string
): Promise<EdgeSession> {
  try {
    const key = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(accessToken, key, {
      algorithms: ["HS256"],
    });
    const appMetadata = (payload.app_metadata ?? {}) as { tier?: string };
    const tier: UserTier = appMetadata.tier === "premium" ? "premium" : "free";
    return { isLoggedIn: true, tier };
  } catch {
    // Expired / forged / wrong-algorithm tokens → treat as signed-out.
    return SIGNED_OUT;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logos|.*\\.svg|.*\\.png|.*\\.ico).*)",
  ],
};
