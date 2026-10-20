import { resetDatabase } from "./setup";

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => ({
    user: {
      id: "user_demo",
      name: "Demo User",
      email: "demo@assura.local",
      tier: "premium",
      maskedInbox: "",
      onboarded: true,
    },
  })),
  refreshSessionCookie: jest.fn(async () => {}),
}));

jest.mock("@/lib/audit", () => ({
  logEvent: jest.fn(async () => {}),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

import { findUserById, updateUser } from "@/lib/users";
import { saveSettingsAction, downgradeToFreeAction } from "@/app/_actions/settings";
import { auth, refreshSessionCookie } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { redirect } from "next/navigation";

describe("saveSettingsAction", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockReset();
    (auth as jest.Mock).mockResolvedValue({
      user: {
        id: "user_demo",
        name: "Demo User",
        email: "demo@assura.local",
        tier: "premium",
        maskedInbox: "",
        onboarded: true,
      },
    });
    await resetDatabase();
  });

  it("persists the display name and personal profile fields", async () => {
    const result = await saveSettingsAction({
      name: "Lee Guan Feng",
      profile: {
        dateOfBirth: "1993-04-15",
        countryOfOrigin: "Singapore",
        gender: "male",
        smoker: false,
        coverageNeeded: 200_000,
        monthlyBudget: 150,
      },
    });

    expect(result).toEqual({ ok: true });
    expect(await findUserById("user_demo")).toMatchObject({
      name: "Lee Guan Feng",
      profile: {
        dateOfBirth: "1993-04-15",
        countryOfOrigin: "Singapore",
        gender: "male",
        smoker: false,
        coverageNeeded: 200_000,
        monthlyBudget: 150,
      },
    });
  });

  it("rejects invalid personal information without changing the database", async () => {
    const result = await saveSettingsAction({
      name: "",
      profile: { age: 12 },
    });

    expect(result.ok).toBe(false);
    expect(await findUserById("user_demo")).toMatchObject({
      name: "Demo User",
      profile: {},
    });
  });

  it("rejects invalid or out-of-range birthdays", async () => {
    const result = await saveSettingsAction({
      name: "Demo User",
      profile: { dateOfBirth: "2020-02-30" },
    });

    expect(result.ok).toBe(false);
    expect(await findUserById("user_demo")).toMatchObject({ profile: {} });
  });

  it("downgrades a personal Premium account to Free and refreshes auth metadata", async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: {
        id: "user_demo",
        name: "Demo User",
        email: "person@example.com",
        tier: "premium",
        maskedInbox: "",
        onboarded: true,
      },
    });

    await downgradeToFreeAction();

    expect((await findUserById("user_demo"))?.tier).toBe("free");
    expect(logEvent).toHaveBeenCalledWith("user_demo", "user.tier_changed", {
      from: "premium",
      to: "free",
    });
    expect(refreshSessionCookie).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/compare?toast=downgraded");
  });

  it("keeps the shared demo account on Premium", async () => {
    await updateUser("user_demo", (user) => {
      user.tier = "premium";
    });
    (auth as jest.Mock).mockResolvedValueOnce({
      user: {
        id: "user_demo",
        name: "Demo User",
        email: "demo@assura.local",
        tier: "premium",
        maskedInbox: "",
        onboarded: true,
      },
    });

    await downgradeToFreeAction();

    expect((await findUserById("user_demo"))?.tier).toBe("premium");
    expect(redirect).toHaveBeenCalledWith("/settings?toast=downgrade-demo-blocked");
  });
});
