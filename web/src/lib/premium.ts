/**
 * premium.ts — Pure, LLM-free personalization helpers for plan comparison.
 *
 * Given a user's profile fields (age / gender / smoker) and a plan's open
 * `premiums` map, resolve the best-matching premium bucket with a graceful
 * fallback chain. Nothing here touches the network, the DOM, or an LLM — it is
 * pure data matching so it can be unit-tested in isolation.
 *
 * Figures are indicative annual SGD premiums sourced from public brochures.
 */

import type { UserProfile, PremiumsByProfile } from "@/lib/types";

/** Only the profile fields the compare page is allowed to pass to the client. */
export interface ComparePersonalProfile {
  age?: number;
  gender?: UserProfile["gender"];
  smoker?: boolean;
  monthlyBudget?: number; // monthly SGD
  coverageNeeded?: number; // SGD
}

export interface ResolvedPremium {
  premium: number | undefined;
  bucketKey: string | undefined;
  isExactMatch: boolean;
  matchedLabel: string;
}

/** Seed premium buckets are keyed at ages 30 and 40. */
export const AGE_BANDS = [30, 40] as const;

const BUCKET_KEY_RE = /^(male|female)_(\d+)_(smoker|nonsmoker)$/;

/** Parse a premiums map and return the sorted unique numeric age bands present. */
export function extractAgeBands(premiums: PremiumsByProfile): number[] {
  const bands = new Set<number>();
  for (const key of Object.keys(premiums)) {
    const m = BUCKET_KEY_RE.exec(key);
    if (m && premiums[key] !== undefined) bands.add(Number(m[2]));
  }
  return [...bands].sort((a, b) => a - b);
}

/**
 * Snap an age to the nearest available band. Ties round DOWN to the lower band
 * (so age 35 with bands [30, 40] → 30). Falls back to 30 when no bands exist.
 */
export function snapAgeToBand(age: number, availableBands: number[]): number {
  if (availableBands.length === 0) return 30;
  let best = availableBands[0];
  let bestDist = Math.abs(age - best);
  for (const band of availableBands) {
    const dist = Math.abs(age - band);
    // Strictly-less keeps the earlier (lower, since sorted asc) band on ties.
    if (dist < bestDist) {
      best = band;
      bestDist = dist;
    }
  }
  return best;
}

function capitalizeGender(gender: "male" | "female"): string {
  return gender === "male" ? "Male" : "Female";
}

function labelFor(gender: "male" | "female", band: number, smoker: boolean): string {
  return `${capitalizeGender(gender)}, ${band}, ${smoker ? "smoker" : "non-smoker"}`;
}

/** A gender is usable for personalization only when male or female. */
function isUsableGender(
  gender: ComparePersonalProfile["gender"]
): gender is "male" | "female" {
  return gender === "male" || gender === "female";
}

/** True when the profile has enough to personalize (numeric age + usable gender). */
export function hasUsableProfile(profile: ComparePersonalProfile | undefined): boolean {
  return (
    !!profile &&
    typeof profile.age === "number" &&
    Number.isFinite(profile.age) &&
    isUsableGender(profile.gender)
  );
}

/** First defined bucket by sorted key order (deterministic fallback). */
function firstAvailableBucket(
  premiums: PremiumsByProfile
): { key: string; value: number } | undefined {
  for (const key of Object.keys(premiums).sort()) {
    const value = premiums[key];
    if (typeof value === "number") return { key, value };
  }
  return undefined;
}

/**
 * Resolve the best-matching premium for a profile against a plan's premiums map.
 *
 * Fallback chain (first defined wins):
 *   1. exact: gender + snapped age band + smoker/nonsmoker  → isExactMatch: true
 *   2. same gender + snapped age band + nonsmoker            → isExactMatch: false
 *   3. male_30_nonsmoker (the seed default)                  → "default (M/30)"
 *   4. first available bucket by sorted key order            → "closest available"
 *   5. nothing available                                     → undefined / "not available"
 *
 * A missing/partial profile (no numeric age or non-usable gender) goes straight
 * to the default path (step 3 → 4 → 5), always with isExactMatch: false.
 */
export function resolvePremium(
  profile: ComparePersonalProfile | undefined,
  premiums: PremiumsByProfile
): ResolvedPremium {
  const p = profile ?? {};

  if (typeof p.age === "number" && Number.isFinite(p.age) && isUsableGender(p.gender)) {
    const gender = p.gender;
    const smoker = p.smoker === true;
    const band = snapAgeToBand(p.age, extractAgeBands(premiums));

    // 1. Exact match on gender + snapped age + smoker status.
    const exactKey = `${gender}_${band}_${smoker ? "smoker" : "nonsmoker"}`;
    const exactValue = premiums[exactKey];
    if (typeof exactValue === "number") {
      return {
        premium: exactValue,
        bucketKey: exactKey,
        isExactMatch: true,
        matchedLabel: labelFor(gender, band, smoker),
      };
    }

    // 2. Same gender + same age band, nonsmoker (covers "no smoker bucket seeded").
    const nonsmokerKey = `${gender}_${band}_nonsmoker`;
    const nonsmokerValue = premiums[nonsmokerKey];
    if (typeof nonsmokerValue === "number") {
      return {
        premium: nonsmokerValue,
        bucketKey: nonsmokerKey,
        isExactMatch: false,
        matchedLabel: `${labelFor(gender, band, false)} (closest available)`,
      };
    }
  }

  // 3. Seed default bucket: male, 30, non-smoker.
  const defaultValue = premiums.male_30_nonsmoker;
  if (typeof defaultValue === "number") {
    return {
      premium: defaultValue,
      bucketKey: "male_30_nonsmoker",
      isExactMatch: false,
      matchedLabel: "default (M/30)",
    };
  }

  // 4. First available bucket by sorted key order.
  const first = firstAvailableBucket(premiums);
  if (first) {
    return {
      premium: first.value,
      bucketKey: first.key,
      isExactMatch: false,
      matchedLabel: "closest available",
    };
  }

  // 5. No buckets at all.
  return {
    premium: undefined,
    bucketKey: undefined,
    isExactMatch: false,
    matchedLabel: "not available",
  };
}

/**
 * Convert a monthly budget to an annual figure. Plan premium buckets are annual
 * SGD, while UserProfile.monthlyBudget is a monthly SGD figure, so we scale the
 * budget up to annual (× 12) and compare like-for-like against annual premiums.
 */
export function annualBudgetFromMonthly(monthlyBudget: number): number {
  return monthlyBudget * 12;
}

/** True when a defined annual premium fits within the annualized monthly budget. */
export function isWithinBudget(
  premium: number | undefined,
  monthlyBudget: number | undefined
): boolean {
  if (premium === undefined || monthlyBudget === undefined) return false;
  return premium <= annualBudgetFromMonthly(monthlyBudget);
}

/** True when a plan's coverage amount meets (≥) the user's stated coverage need. */
export function meetsCoverageNeed(
  coverageAmount: number | undefined,
  coverageNeeded: number | undefined
): boolean {
  if (coverageAmount === undefined || coverageNeeded === undefined) return false;
  return coverageAmount >= coverageNeeded;
}
