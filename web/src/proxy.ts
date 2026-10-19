/**
 * middleware.ts — Edge middleware for auth gating (Supabase Auth).
 *
 * Reads the Supabase session from the request cookies via @supabase/ssr and
 * verifies the access-token signature LOCALLY with jose against Supabase's
 * published JWKS (asymmetric ES256/RS256) — it deliberately does NOT call
 * supabase.auth.getUser(), which would be a per-request network round-trip to
 * the Supabase Auth server. The JWKS is fetched once and cached in-process by
 * jose's createRemoteJWKSet, so steady-state verification is local crypto only.
 * This matches projects using asymmetric JWT signing keys (ECC P-256 / ES256);
 * there is no shared HS256 secret for such projects.
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
import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { evaluateRoute } from "@/lib/auth-routing";
import type { UserTier } from "@/lib/types";

interface EdgeSession {
  isLoggedIn: boolean;
  tier: UserTier;
}

const SIGNED_OUT: EdgeSession = { isLoggedIn: false, tier: "free" };

// Cache the JWKS getter per Supabase URL across requests (jose caches the
// fetched keys internally, so this avoids refetching on every request).
let jwksUrl: string | null = null;
let jwks: JWTVerifyGetKey | null = null;

function getJwks(supabaseUrl: string): JWTVerifyGetKey {
  if (!jwks || jwksUrl !== supabaseUrl) {
    jwksUrl = supabaseUrl;
    jwks = createRemoteJWKSet(
      new URL(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`)
    );
  }
  return jwks;
}

export default async function proxy(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  let session = SIGNED_OUT;

  if (url && anonKey) {
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
      session = await verifyAccessToken(sbSession.access_token, getJwks(url));
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

/**
 * Verify the access-token signature locally against Supabase's JWKS
 * (asymmetric ES256/RS256) and extract tier. Returns signed-out on any failure
 * (expired / forged / unreachable JWKS).
 */
async function verifyAccessToken(
  accessToken: string,
  keys: JWTVerifyGetKey
): Promise<EdgeSession> {
  try {
    const { payload } = await jwtVerify(accessToken, keys, {
      algorithms: ["ES256", "RS256"],
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
