import { resetDatabase } from "./setup";

jest.mock("@/lib/audit", () => ({
  logEvent: jest.fn(async () => {}),
}));

import { createUser } from "@/lib/users";
import { completeOnboarding } from "@/lib/onboarding";

const CONSENT = {
  shareAge: true,
  shareGender: true,
  shareSmokerStatus: false,
  shareCoverageNeeds: true,
  shareBudgetRange: true,
  shareOccupation: false,
  shareHealthHistory: false,
  shareIncome: false,
};

describe("completeOnboarding — admin is premium-or-better", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await resetDatabase();
  });

  it("allows an admin user to complete onboarding", async () => {
    await createUser({
      id: "user_admin_onboard",
      name: "Admin Onboard",
      email: "admin-onboard@example.com",
      password: "unused-password",
      tier: "admin",
    });

    const result = await completeOnboarding("user_admin_onboard", { consent: CONSENT });
    expect(result.ok).toBe(true);
  });

  it("allows a premium user to complete onboarding", async () => {
    await createUser({
      id: "user_premium_onboard",
      name: "Premium Onboard",
      email: "premium-onboard@example.com",
      password: "unused-password",
      tier: "premium",
    });

    const result = await completeOnboarding("user_premium_onboard", { consent: CONSENT });
    expect(result.ok).toBe(true);
  });

  it("still denies a free user with a 403", async () => {
    await createUser({
      id: "user_free_onboard",
      name: "Free Onboard",
      email: "free-onboard@example.com",
      password: "unused-password",
      tier: "free",
    });

    const result = await completeOnboarding("user_free_onboard", { consent: CONSENT });
    expect(result).toMatchObject({ ok: false, status: 403 });
  });
});
