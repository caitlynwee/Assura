import { activeCriteria, assessPlan, yearsOfCover, MIN_YEARS_OF_COVER } from "@/lib/relevance";
import type { CoverageTerm, PremiumsByProfile } from "@/lib/types";

const PREMIUMS: PremiumsByProfile = {
  male_30_nonsmoker: 1200, // S$100/mo
  male_40_nonsmoker: 2100,
  female_30_nonsmoker: 960, // S$80/mo
  female_40_nonsmoker: 1750,
};

function plan(over: { coverageAmount?: number; coverageTerms?: CoverageTerm[]; premiums?: PremiumsByProfile } = {}) {
  return {
    coverageAmount: over.coverageAmount ?? 200_000,
    coverageTerms: over.coverageTerms ?? (["to_age_70"] as CoverageTerm[]),
    premiums: over.premiums ?? PREMIUMS,
  };
}

describe("activeCriteria", () => {
  it("only uses the fields the user filled in", () => {
    expect(activeCriteria(undefined)).toEqual([]);
    expect(activeCriteria({})).toEqual([]);
    expect(activeCriteria({ monthlyBudget: 100 })).toEqual(["budget"]);
    expect(activeCriteria({ age: 30, coverageNeeded: 150_000 })).toEqual(["coverage", "age"]);
  });

  it("ignores zero budget / coverage", () => {
    expect(activeCriteria({ monthlyBudget: 0, coverageNeeded: 0 })).toEqual([]);
  });
});

describe("yearsOfCover", () => {
  it("handles every term shape", () => {
    expect(yearsOfCover("whole_life", 50)).toBe(Infinity);
    expect(yearsOfCover("to_age_65", 30)).toBe(35);
    expect(yearsOfCover("to_age_65", 62)).toBe(3);
    expect(yearsOfCover("20_years", 60)).toBe(20);
  });
});

describe("assessPlan", () => {
  it("with no profile, every plan is relevant and nothing is checked", () => {
    const r = assessPlan(plan(), undefined);
    expect(r.relevant).toBe(true);
    expect(r.checks).toEqual([]);
  });

  it("budget: uses the premium for the user's own bucket (annual vs monthly × 12)", () => {
    // Female 30 pays 960/yr = 80/mo → fits 80/mo; male 30 pays 1200/yr → doesn't.
    expect(assessPlan(plan(), { age: 30, gender: "female", monthlyBudget: 80 }).relevant).toBe(true);
    const male = assessPlan(plan(), { age: 30, gender: "male", monthlyBudget: 80 });
    expect(male.relevant).toBe(false);
    expect(male.checks[0]).toMatchObject({ rule: "budget", passed: false });
    expect(male.checks[0].label).toMatch(/over your S\$80\/mo budget/);
  });

  it("budget: older users are priced on their age band", () => {
    // Age 40 male = 2100/yr = 175/mo → over a 150/mo budget.
    expect(assessPlan(plan(), { age: 40, gender: "male", monthlyBudget: 150 }).relevant).toBe(false);
    expect(assessPlan(plan(), { age: 30, gender: "male", monthlyBudget: 150 }).relevant).toBe(true);
  });

  it("coverage: plan must meet the stated need", () => {
    expect(assessPlan(plan({ coverageAmount: 100_000 }), { coverageNeeded: 150_000 }).relevant).toBe(false);
    expect(assessPlan(plan({ coverageAmount: 200_000 }), { coverageNeeded: 150_000 }).relevant).toBe(true);
  });

  it("coverage: an unpublished sum assured is 'not stated', not 'too small'", () => {
    const r = assessPlan(plan({ coverageAmount: 0 }), { coverageNeeded: 150_000 });
    expect(r.relevant).toBe(false);
    expect(r.checks[0]).toMatchObject({ rule: "coverage", passed: false, label: "coverage amount not published" });
  });

  it(`age: some term must still run ${MIN_YEARS_OF_COVER}+ years`, () => {
    const to65 = plan({ coverageTerms: ["to_age_65"] });
    expect(assessPlan(to65, { age: 62 }).relevant).toBe(false);
    expect(assessPlan(to65, { age: 50 }).relevant).toBe(true);
    // Any one good term is enough.
    expect(assessPlan(plan({ coverageTerms: ["to_age_65", "whole_life"] }), { age: 62 }).relevant).toBe(true);
  });

  it("every applicable rule must pass", () => {
    const r = assessPlan(plan({ coverageAmount: 100_000 }), {
      age: 30,
      gender: "male",
      monthlyBudget: 200,
      coverageNeeded: 150_000,
    });
    expect(r.relevant).toBe(false);
    expect(r.checks.map((c) => [c.rule, c.passed])).toEqual([
      ["budget", true],
      ["coverage", false],
      ["age", true],
    ]);
  });

  it("smoker with no published smoker rate: falls back to non-smoker rate and flags it", () => {
    const r = assessPlan(plan(), { age: 30, gender: "male", smoker: true, monthlyBudget: 100 });
    expect(r.smokerRateMissing).toBe(true);
    expect(r.premium).toBe(1200);
  });

  it("smoker with a published smoker rate: uses it, no flag", () => {
    const r = assessPlan(plan({ premiums: { ...PREMIUMS, male_30_smoker: 1800 } }), {
      age: 30,
      gender: "male",
      smoker: true,
      monthlyBudget: 100,
    });
    expect(r.smokerRateMissing).toBe(false);
    expect(r.premium).toBe(1800);
    expect(r.relevant).toBe(false); // 150/mo > 100/mo
  });

  it("non-smokers are never flagged", () => {
    expect(assessPlan(plan(), { age: 30, gender: "male", smoker: false }).smokerRateMissing).toBe(false);
  });
});
