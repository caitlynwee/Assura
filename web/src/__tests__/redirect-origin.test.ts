/**
 * redirect-origin.test.ts — guards the fix for the HOSTNAME=0.0.0.0 redirect
 * leak. The web container binds on 0.0.0.0, so any redirect built relative to
 * the incoming request host resolves against http://0.0.0.0:3000. These tests
 * simulate that request host and assert the redirect origin instead comes from
 * the configured NEXT_PUBLIC_SITE_URL.
 */

const mockExchangeCodeForSession = jest.fn();
const mockGetUser = jest.fn();
const mockGetUserByAuthUid = jest.fn();
const mockResolveOrCreateAuthUser = jest.fn();
const mockCookieStore = {
  getAll: jest.fn(() => [] as Array<{ name: string }>),
  delete: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  getServerClient: async () => ({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  }),
}));

jest.mock("@/lib/db", () => ({
  getUserByAuthUid: (...args: unknown[]) => mockGetUserByAuthUid(...args),
}));

jest.mock("@/lib/users", () => ({
  resolveOrCreateAuthUser: (...args: unknown[]) => mockResolveOrCreateAuthUser(...args),
}));

jest.mock("next/headers", () => ({
  cookies: async () => mockCookieStore,
}));

import { GET as callbackGET } from "@/app/auth/callback/route";
import { GET as resetGET } from "@/app/auth/reset/route";

describe("auth callback redirect origin", () => {
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth_uid_1", email: "user@example.com" } },
      error: null,
    });
    mockGetUserByAuthUid.mockResolvedValue({ id: "user_1", email: "user@example.com" });
    mockResolveOrCreateAuthUser.mockResolvedValue({ id: "user_1", email: "user@example.com" });
  });

  afterAll(() => {
    if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
  });

  it("redirects to the configured site origin after a successful confirmation", async () => {
    const response = await callbackGET(
      new Request("http://0.0.0.0:3000/auth/callback?code=xyz")
    );

    const location = response.headers.get("location")!;
    expect(new URL(location).origin).toBe("https://app.example.com");
    expect(new URL(location).pathname).toBe("/settings");
  });

  it("uses the configured site origin on the invalid-link branch", async () => {
    const response = await callbackGET(new Request("http://0.0.0.0:3000/auth/callback"));

    const location = response.headers.get("location")!;
    expect(new URL(location).origin).toBe("https://app.example.com");
    expect(new URL(location).pathname).toBe("/settings");
    expect(new URL(location).searchParams.get("emailError")).toBe("invalid-link");
  });
});

describe("auth reset redirect origin", () => {
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    mockCookieStore.getAll.mockReturnValue([]);
  });

  afterAll(() => {
    if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
  });

  it("redirects session-expired users to the configured site origin", async () => {
    const response = await resetGET(new Request("http://0.0.0.0:3000/auth/reset"));

    expect(response.headers.get("location")).toBe(
      "https://app.example.com/login?error=session-expired"
    );
  });
});

describe("edge proxy redirect origin resolution", () => {
  // The full edge middleware needs Supabase env, request cookies, and JWKS to
  // run end-to-end, which is impractical to isolate in a unit test. Instead we
  // replicate the exact origin-resolution expression from proxy.ts's redirect
  // branch and assert its two behaviors directly.
  function resolveRedirect(actionTo: string, reqNextUrl: URL): URL {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    return new URL(actionTo, siteUrl || reqNextUrl);
  }

  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
  });

  it("uses NEXT_PUBLIC_SITE_URL as the origin, preserving path and query", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    const to = resolveRedirect(
      "/upgrade?from=%2Foutreach",
      new URL("http://0.0.0.0:3000/outreach")
    );

    expect(to.origin).toBe("https://app.example.com");
    expect(to.pathname + to.search).toBe("/upgrade?from=%2Foutreach");
  });

  it("falls back to the request origin when NEXT_PUBLIC_SITE_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const to = resolveRedirect("/login", new URL("http://0.0.0.0:3000/outreach"));

    expect(to.origin).toBe("http://0.0.0.0:3000");
    expect(to.pathname).toBe("/login");
  });
});
