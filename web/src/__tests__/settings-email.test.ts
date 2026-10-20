import { requestEmailChangeAction } from "@/app/_actions/settings";

const mockAuth = jest.fn();
const mockUpdateUser = jest.fn();
const mockLogEvent = jest.fn();

jest.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

jest.mock("@/lib/audit", () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}));

jest.mock("@/lib/supabase/server", () => ({
  getServerClient: async () => ({
    auth: { updateUser: (...args: unknown[]) => mockUpdateUser(...args) },
  }),
}));

describe("requestEmailChangeAction", () => {
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    mockAuth.mockResolvedValue({
      user: { id: "user_private", email: "old@example.com" },
    });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  afterAll(() => {
    if (previousSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
  });

  it("requests Supabase email verification and logs only a masked address", async () => {
    const result = await requestEmailChangeAction({ email: " New.Address@example.com " });

    expect(result).toEqual({
      ok: true,
      pendingEmail: "new.address@example.com",
    });
    expect(mockUpdateUser).toHaveBeenCalledWith(
      { email: "new.address@example.com" },
      { emailRedirectTo: "https://app.example.com/auth/callback" }
    );
    expect(mockLogEvent).toHaveBeenCalledWith("user_private", "auth.email_change_requested", {
      email: "ne*********@example.com",
    });
  });

  it("does not allow changing the shared demo account email", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user_demo", email: "demo@fineprint.local" },
    });

    expect(await requestEmailChangeAction({ email: "new@example.com" })).toEqual({
      ok: false,
      error: "The shared demo account email cannot be changed.",
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("rejects invalid addresses without calling Supabase", async () => {
    expect(await requestEmailChangeAction({ email: "bad address" })).toEqual({
      ok: false,
      error: "Enter a valid email address.",
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});
