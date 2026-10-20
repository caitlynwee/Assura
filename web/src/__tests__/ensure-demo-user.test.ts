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

import { ensureDemoAuthUser } from "@/lib/supabase/ensure-demo-user";

describe("ensureDemoAuthUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListUsers
      .mockResolvedValueOnce({ data: { users: [] }, error: null })
      .mockResolvedValueOnce({
        data: { users: [{ id: "legacy-demo-uid", email: "demo@fineprint.local" }] },
        error: null,
      });
    mockUpdateUserById.mockResolvedValue({ error: null });
    mockCreateUser.mockResolvedValue({ data: { user: { id: "new-demo-uid" } }, error: null });
    mockLinkAuthUid.mockResolvedValue(undefined);
  });

  it("rebrands the legacy Supabase demo identity in place", async () => {
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
});
