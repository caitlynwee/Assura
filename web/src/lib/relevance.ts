/**
 * relevance.ts — Which plans match the signed-in user's profile, and why.
 *
 * Pure, deterministic, LLM-free (same spirit as premium.ts): every decision is
 * a plain rule the user can read back, so the Compare page can say exactly why
 * a plan is shown or hidden. This is a factual filter, never a recommendation.
 *
 * A rule only runs when the profile has the field it needs, so a partly filled
 * profile filters on what it has, and an empty one filters on nothing.
 *
 * Rules:
 *   budget   — the plan's annual premium for the user's bucket (age band,
 *              gender, smoker) is within monthlyBudget × 12
 *   coverage — the plan's sum assured meets coverageNeeded
 *   age      — at least one of the plan's coverage terms still runs for
 *              MIN_YEARS_OF_COVER more years at the user's age
 *
 * Smokers: brochures rarely publish smoker rates. When a plan has none for the
 * user, the non-smoker rate is used and flagged (`smokerRateMissing`) so the UI
 * can say smokers usually pay more — we never invent a smoker price.
 */

import type { CoverageTerm, Plan } from "./types";
import {
  annualBudgetFromMonthly,
  hasUsableProfile,
  isWithinBudget,
  meetsCoverageNeed,
  resolvePremium,
  type ComparePersonalProfile,
} from "./premium";

/** A term that ends sooner than this many years from now doesn't count. */
export const MIN_YEARS_OF_COVER = 5;

export type RelevanceRule = "budget" | "coverage" | "age";

export interface RelevanceCheck {
  rule: RelevanceRule;
  passed: boolean;
  /** Short, factual reason shown to the user. */
  label: string;
}

export interface PlanRelevance {
  /** True when every applicable check passed (or none applied). */
  relevant: boolean;
  checks: RelevanceCheck[];
  /** Annual premium used for the budget check, if any. */
  premium: number | undefined;
  /** The user smokes but this plan publishes no smoker rate for them. */
  smokerRateMissing: boolean;
}

const sgd = (n: number) =>
  `S$${n.toLocaleString("en-SG", { maximumFractionDigits: 0 })}`;

/** Years of cover a term gives someone of `age`, or Infinity for whole life. */
export function yearsOfCover(term: CoverageTerm, age: number): number {
  if (term === "whole_life") return Infinity;
  const toAge = /^to_age_(\d+)$/.exec(term);
  if (toAge) return Number(toAge[1]) - age;
  const fixed = /^(\d+)_years$/.exec(term);
  if (fixed) return Number(fixed[1]);
  return 0;
}

/** Which profile fields can drive filtering (labels for the UI summary). */
export function activeCriteria(profile: ComparePersonalProfile | undefined): RelevanceRule[] {
  if (!profile) return [];
  const rules: RelevanceRule[] = [];
  if (typeof profile.monthlyBudget === "number" && profile.monthlyBudget > 0) rules.push("budget");
  if (typeof profile.coverageNeeded === "number" && profile.coverageNeeded > 0) rules.push("coverage");
  if (typeof profile.age === "number" && Number.isFinite(profile.age)) rules.push("age");
  return rules;
}

export function assessPlan(
  plan: Pick<Plan, "premiums" | "coverageAmount" | "coverageTerms">,
  profile: ComparePersonalProfile | undefined
): PlanRelevance {
  const rules = activeCriteria(profile);
  const resolved = resolvePremium(profile, plan.premiums);
  const checks: RelevanceCheck[] = [];

  const smokerRateMissing =
    profile?.smoker === true &&
    hasUsableProfile(profile) &&
    !(resolved.bucketKey ?? "").endsWith("_smoker");

  if (rules.includes("budget")) {
    const budget = profile!.monthlyBudget!;
    const passed = isWithinBudget(resolved.premium, budget);
    checks.push({
      rule: "budget",
      passed,
      label:
        resolved.premium === undefined
          ? "no published premium"
          : passed
            ? `within your ${sgd(budget)}/mo budget`
            : `over your ${sgd(budget)}/mo budget (${sgd(
                Math.round(resolved.premium / 12)
              )}/mo vs ${sgd(budget)}/mo)`,
    });
  }

  if (rules.includes("coverage")) {
    const need = profile!.coverageNeeded!;
    // 0 / missing = the brochure doesn't state a sum assured: unknown, not "too small".
    const unknown = !plan.coverageAmount;
    const passed = !unknown && meetsCoverageNeed(plan.coverageAmount, need);
    checks.push({
      rule: "coverage",
      passed,
      label: unknown
        ? "coverage amount not published"
        : passed
          ? `meets your ${sgd(need)} coverage need`
          : `below your ${sgd(need)} coverage need`,
    });
  }

  if (rules.includes("age")) {
    const age = profile!.age!;
    const best = Math.max(0, ...plan.coverageTerms.map((t) => yearsOfCover(t, age)));
    const passed = best >= MIN_YEARS_OF_COVER;
    checks.push({
      rule: "age",
      passed,
      label: passed
        ? best === Infinity
          ? "lifelong cover at your age"
          : `covers you for ${best}+ years at age ${age}`
        : `cover ends within ${MIN_YEARS_OF_COVER} years at age ${age}`,
    });
  }

  return {
    relevant: checks.every((c) => c.passed),
    checks,
    premium: resolved.premium,
    smokerRateMissing,
  };
}

/** Annual budget helper re-exported for summary text. */
export { annualBudgetFromMonthly };
