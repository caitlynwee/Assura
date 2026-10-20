const mockListUsers = jest.fn();
const mockUpdateUserById = jest.fn();
const mockCreateUser = jest.fn();
const mockLinkAuthUid = jest.fn();
const mockGetUserById = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    auth: {
      admin: {
        listUsers: (...args: unknown[]) => mockListUsers(...args),
        updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
        createUser: (...args: unknown[]) => mockCreateUser(...args),
      },
    },
  }),
}));

jest.mock("@/lib/db", () => ({
  linkAuthUid: (...args: unknown[]) => mockLinkAuthUid(...args),
  getUserById: (...args: unknown[]) => mockGetUserById(...args),
}));

import {
  ensureDemoAuthUser,
  ensureTeamAuthUsers,
  syncAuthMetadata,
} from "@/lib/supabase/ensure-demo-user";

/** Return the single users list as an empty-first page then a match page. */
function queueListUsersPages(...pages: unknown[][]): void {
  for (const users of pages) {
    mockListUsers.mockResolvedValueOnce({ data: { users }, error: null });
  }
}

describe("ensureDemoAuthUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateUserById.mockResolvedValue({ error: null });
    mockCreateUser.mockResolvedValue({ data: { user: { id: "new-demo-uid" } }, error: null });
    mockLinkAuthUid.mockResolvedValue(undefined);
    // DB row for the demo user is premium (not admin).
    mockGetUserById.mockResolvedValue({
      id: "user_demo",
      tier: "premium",
      onboarded: true,
      authUid: "legacy-demo-uid",
    });
  });

  it("rebrands the legacy Supabase demo identity in place (premium derived from DB)", async () => {
    // First lookup (DEMO_EMAIL) empty; second (LEGACY_DEMO_EMAIL) matches.
    queueListUsersPages(
      [],
      [{ id: "legacy-demo-uid", email: "demo@fineprint.local", app_metadata: {} }]
    );

    await ensureDemoAuthUser();

    expect(mockUpdateUserById).toHaveBeenCalledWith("legacy-demo-uid", {
      email: "demo@assura.local",
      password: "demo1234",
      email_confirm: true,
      app_metadata: {
        tier: "premium",
        onboarded: true,
        appUserId: "user_demo",
      },
    });
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockLinkAuthUid).toHaveBeenCalledWith("user_demo", "legacy-demo-uid");
  });

  it("preserves admin when the demo DB row is admin (never downgrades)", async () => {
    mockGetUserById.mockResolvedValue({
      id: "user_demo",
      tier: "admin",
      onboarded: true,
      authUid: "legacy-demo-uid",
    });
    queueListUsersPages(
      [{ id: "legacy-demo-uid", email: "demo@assura.local", app_metadata: { tier: "premium" } }]
    );

    await ensureDemoAuthUser();

    expect(mockUpdateUserById).toHaveBeenCalledWith(
      "legacy-demo-uid",
      expect.objectContaining({
        app_metadata: expect.objectContaining({ tier: "admin" }),
      })
    );
  });
});

describe("ensureTeamAuthUsers", () => {
  const TEAM = ["jeff", "caitlyn", "marcus", "dominic"];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateUserById.mockResolvedValue({ error: null });
    mockCreateUser.mockImplementation(async () => ({
      data: { user: { id: "new-uid" } },
      error: null,
    }));
    mockLinkAuthUid.mockResolvedValue(undefined);
  });

  /** Make every slug resolve as an existing Supabase identity with given app_metadata. */
  function existingIdentityFor(slug: string, appMetadata: Record<string, unknown>) {
    return [{ id: `${slug}-uid`, email: `${slug}@assura.local`, app_metadata: appMetadata }];
  }

  it("preserves admin for a team member whose DB tier is admin (re-seed does not downgrade)", async () => {
    // Each team member's listUsers lookup returns their existing identity.
    for (const slug of TEAM) {
      queueListUsersPages(existingIdentityFor(slug, { tier: "premium" }));
    }
    mockGetUserById.mockImplementation(async (id: string) =>
      id === "user_jeff"
        ? { id, tier: "admin", onboarded: true, authUid: "jeff-uid" }
        : { id, tier: "premium", onboarded: true, authUid: `${id}-uid` }
    );

    await ensureTeamAuthUsers();

    const jeffCall = mockUpdateUserById.mock.calls.find((c) => c[0] === "jeff-uid");
    expect(jeffCall).toBeDefined();
    expect(jeffCall![1].app_metadata.tier).toBe("admin");
  });

  it("keeps a non-admin team account premium", async () => {
    for (const slug of TEAM) {
      queueListUsersPages(existingIdentityFor(slug, { tier: "premium" }));
    }
    mockGetUserById.mockImplementation(async (id: string) => ({
      id,
      tier: "premium",
      onboarded: true,
      authUid: `${id}-uid`,
    }));

    await ensureTeamAuthUsers();

    const caitlynCall = mockUpdateUserById.mock.calls.find((c) => c[0] === "caitlyn-uid");
    expect(caitlynCall).toBeDefined();
    expect(caitlynCall![1].app_metadata.tier).toBe("premium");
  });

  it("preserves an existing admin JWT even if the DB lookup returns null (fresh-DB race)", async () => {
    for (const slug of TEAM) {
      queueListUsersPages(
        existingIdentityFor(slug, slug === "jeff" ? { tier: "admin" } : { tier: "premium" })
      );
    }
    mockGetUserById.mockResolvedValue(null);

    await ensureTeamAuthUsers();

    const jeffCall = mockUpdateUserById.mock.calls.find((c) => c[0] === "jeff-uid");
    expect(jeffCall).toBeDefined();
    expect(jeffCall![1].app_metadata.tier).toBe("admin");
  });

  it("falls back to premium for a fresh DB with no existing identity or app row", async () => {
    // No existing identities: every lookup returns an empty page.
    for (let i = 0; i < TEAM.length; i += 1) {
      queueListUsersPages([]);
    }
    mockGetUserById.mockResolvedValue(null);

    await ensureTeamAuthUsers();

    expect(mockCreateUser).toHaveBeenCalled();
    for (const call of mockCreateUser.mock.calls) {
      expect(call[0].app_metadata.tier).toBe("premium");
    }
  });
});

describe("syncAuthMetadata", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateUserById.mockResolvedValue({ error: null });
  });

  it("writes the DB tier and preserves admin", async () => {
    mockGetUserById.mockResolvedValue({
      id: "user_jeff",
      tier: "admin",
      onboarded: true,
      authUid: "jeff-uid",
    });

    await syncAuthMetadata("user_jeff");

    expect(mockUpdateUserById).toHaveBeenCalledWith("jeff-uid", {
      app_metadata: { tier: "admin", onboarded: true, appUserId: "user_jeff" },
    });
  });

  it("writes the DB tier for a non-admin user (no spurious admin)", async () => {
    mockGetUserById.mockResolvedValue({
      id: "user_demo",
      tier: "premium",
      onboarded: true,
      authUid: "demo-uid",
    });

    await syncAuthMetadata("user_demo");

    expect(mockUpdateUserById).toHaveBeenCalledWith("demo-uid", {
      app_metadata: { tier: "premium", onboarded: true, appUserId: "user_demo" },
    });
  });

  it("is a no-op when the app user has no linked auth_uid", async () => {
    mockGetUserById.mockResolvedValue({
      id: "user_unlinked",
      tier: "premium",
      onboarded: false,
      authUid: undefined,
    });

    await syncAuthMetadata("user_unlinked");

    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });
});
