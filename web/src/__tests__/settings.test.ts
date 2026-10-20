import { resetDatabase } from "./setup";

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => ({
    user: {
      id: "user_demo",
      name: "Demo User",
      email: "demo@fineprint.local",
      tier: "premium",
      maskedInbox: "",
      onboarded: true,
    },
  })),
}));

jest.mock("@/lib/audit", () => ({
  logEvent: jest.fn(async () => {}),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

import { findUserById } from "@/lib/users";
import { saveSettingsAction } from "@/app/_actions/settings";

describe("saveSettingsAction", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("persists the display name and personal profile fields", async () => {
    const result = await saveSettingsAction({
      name: "Lee Guan Feng",
      profile: {
        age: 32,
        gender: "male",
        smoker: false,
        coverageNeeded: 200_000,
        monthlyBudget: 150,
        occupation: "Engineer",
      },
    });

    expect(result).toEqual({ ok: true });
    expect(await findUserById("user_demo")).toMatchObject({
      name: "Lee Guan Feng",
      profile: {
        age: 32,
        gender: "male",
        smoker: false,
        coverageNeeded: 200_000,
        monthlyBudget: 150,
        occupation: "Engineer",
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
});
