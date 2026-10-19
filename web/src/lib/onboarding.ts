/**
 * onboarding.ts — Save a user's outreach profile + consent (Node.js only).
 *
 * Shared by the onboarding server action and PATCH /api/onboarding.
 * Tier-3 fields (health history, income) are forced to false regardless of
 * input: the policy engine never lets the AI share them.
 */

import { z } from "zod";
import { onboardingSchema } from "./validators";
import { updateUser } from "./users";
import { generateMaskedAddress } from "./mail";
import { logEvent } from "./audit";
import type { User } from "./types";

export type OnboardingInput = z.input<typeof onboardingSchema>;

export type OnboardingResult =
  | { ok: true; maskedInbox: string }
  | { ok: false; error: string; status: number };

export function completeOnboarding(
  userId: string,
  input: unknown
): OnboardingResult {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some fields are invalid. Please check the form.", status: 400 };
  }

  const consent = {
    ...parsed.data.consent,
    shareHealthHistory: false, // Tier 3 — blocked
    shareIncome: false, // Tier 3 — blocked
  };

  let notPremium = false;
  const updated = updateUser(userId, (u: User) => {
    if (u.tier !== "premium") {
      notPremium = true;
      return;
    }
    u.consent = consent;
    if (parsed.data.profile) u.profile = parsed.data.profile;
    u.onboarded = true;
    if (!u.maskedInbox) u.maskedInbox = generateMaskedAddress(userId);
  });

  if (!updated) return { ok: false, error: "User not found.", status: 404 };
  if (notPremium) {
    logEvent(userId, "policy.deny", { action: "onboarding", reason: "requires premium" });
    return { ok: false, error: "Outreach setup is a Premium feature.", status: 403 };
  }

  logEvent(userId, "user.onboarded", {
    consentFields: Object.entries(consent)
      .filter(([, v]) => v)
      .map(([k]) => k),
    profileFields: Object.keys(parsed.data.profile ?? {}),
  });

  return { ok: true, maskedInbox: updated.maskedInbox };
}
