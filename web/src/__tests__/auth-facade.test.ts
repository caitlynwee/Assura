import "./setup"; // spins up PGlite + seeds user_demo (email demo@fineprint.local)
import { evaluateRoute } from "@/lib/auth-routing";

// ─── Control the Supabase server client the facade reads ──────────────────────
// auth() calls getServerClient().auth.getUser(). We stub that so we can drive
// the authUid / email resolution against the seeded PGlite user row.
let currentSupabaseUser: { id: string; email: string | null } | null = null;

jest.mock("@/lib/supabase/server", () => ({
  getServerClient: jest.fn(async () => ({
    auth: {
      async getUser() {
        return { data: { user: currentSupabaseUser }, error: null };
      },
    },
  })),
}));

// syncAuthMetadata (imported transitively by @/lib/auth) hits the admin client;
// keep it inert so the facade import resolves without Supabase keys.
jest.mock("@/lib/supabase/ensure-demo-user", () => ({
  syncAuthMetadata: jest.fn(async () => {}),
  ensureDemoAuthUser: jest.fn(async () => {}),
}));

import { auth } from "@/lib/auth";
import { getUserByAuthUid } from "@/lib/db";

const DEMO_EMAIL = "demo@fineprint.local";
const DEMO_UID = "00000000-0000-4000-8000-000000000001";

describe("auth() facade — Supabase session → app user mapping", () => {
  beforeEach(() => {
    currentSupabaseUser = null;
  });

  it("returns null when there is no Supabase user", async () => {
    currentSupabaseUser = null;
    expect(await auth()).toBeNull();
  });

  it("maps a Supabase user to the app row by email and back-fills auth_uid", async () => {
    // Seeded user_demo has auth_uid = null initially; resolve by email.
    currentSupabaseUser = { id: DEMO_UID, email: DEMO_EMAIL };

    const session = await auth();
    expect(session).not.toBeNull();
    expect(session!.user.id).toBe("user_demo");
    expect(session!.user.email).toBe(DEMO_EMAIL);
    expect(session!.user.tier).toBe("premium"); // app row is tier authority

    // The email-fallback path back-filled auth_uid, so the fast path now works.
    const linked = await getUserByAuthUid(DEMO_UID);
    expect(linked?.id).toBe("user_demo");
  });

  it("resolves by auth_uid on the fast path once linked", async () => {
    // After the previous test linked DEMO_UID, email can be absent.
    currentSupabaseUser = { id: DEMO_UID, email: null };

    const session = await auth();
    expect(session!.user.id).toBe("user_demo");
  });

  it("returns null when no app row matches the Supabase identity", async () => {
    currentSupabaseUser = { id: "unknown-uid", email: "nobody@example.com" };
    expect(await auth()).toBeNull();
  });
});

describe("evaluateRoute() — gating rules (pure)", () => {
  it("signed-out page → redirect /login", () => {
    expect(
      evaluateRoute({ pathname: "/crm", isLoggedIn: false, tier: "free" })
    ).toEqual({ type: "redirect", to: "/login" });
  });

  it("signed-out /api/* → json401", () => {
    expect(
      evaluateRoute({ pathname: "/api/crm/threads", isLoggedIn: false, tier: "free" })
    ).toEqual({ type: "json401" });
  });

  it("free-tier user on a premium path → redirect /upgrade?from=", () => {
    expect(
      evaluateRoute({ pathname: "/outreach", isLoggedIn: true, tier: "free" })
    ).toEqual({ type: "redirect", to: "/upgrade?from=%2Foutreach" });
  });

  it("premium user on a premium path → allow", () => {
    expect(
      evaluateRoute({ pathname: "/outreach", isLoggedIn: true, tier: "premium" })
    ).toEqual({ type: "allow" });
  });

  it("signed-in user on /login → redirect /compare", () => {
    expect(
      evaluateRoute({ pathname: "/login", isLoggedIn: true, tier: "free" })
    ).toEqual({ type: "redirect", to: "/compare" });
  });

  it("public path (home) → allow when signed-out", () => {
    expect(
      evaluateRoute({ pathname: "/", isLoggedIn: false, tier: "free" })
    ).toEqual({ type: "allow" });
  });

  it("internal callback path → allow when signed-out", () => {
    expect(
      evaluateRoute({ pathname: "/api/internal/outreach", isLoggedIn: false, tier: "free" })
    ).toEqual({ type: "allow" });
  });
});
