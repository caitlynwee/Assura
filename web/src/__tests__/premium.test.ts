import {
  resolvePremium,
  snapAgeToBand,
  extractAgeBands,
  annualBudgetFromMonthly,
  isWithinBudget,
  meetsCoverageNeed,
  hasUsableProfile,
  type ComparePersonalProfile,
} from "@/lib/premium";
import type { PremiumsByProfile } from "@/lib/types";

// A representative plan with the seed shape: both age bands, nonsmoker only.
const SEED_PREMIUMS: PremiumsByProfile = {
  male_30_nonsmoker: 1000,
  male_40_nonsmoker: 1500,
  female_30_nonsmoker: 900,
  female_40_nonsmoker: 1400,
};

describe("extractAgeBands / snapAgeToBand", () => {
  it("extracts the sorted unique age bands present", () => {
    expect(extractAgeBands(SEED_PREMIUMS)).toEqual([30, 40]);
  });

  it("snaps to the nearest band and rounds ties down", () => {
    expect(snapAgeToBand(29, [30, 40])).toBe(30);
    expect(snapAgeToBand(41, [30, 40])).toBe(40);
    expect(snapAgeToBand(35, [30, 40])).toBe(30); // tie → lower band
  });

  it("falls back to 30 when no bands exist", () => {
    expect(snapAgeToBand(50, [])).toBe(30);
  });
});

describe("resolvePremium — exact match", () => {
  it("returns the exact bucket for male/30/non-smoker", () => {
    const r = resolvePremium({ age: 30, gender: "male", smoker: false }, SEED_PREMIUMS);
    expect(r.premium).toBe(1000);
    expect(r.bucketKey).toBe("male_30_nonsmoker");
    expect(r.isExactMatch).toBe(true);
    expect(r.matchedLabel).toContain("Male, 30, non-smoker");
  });
});

describe("resolvePremium — age snapping", () => {
  it("snaps age 29 to the 30 band", () => {
    const r = resolvePremium({ age: 29, gender: "male", smoker: false }, SEED_PREMIUMS);
    expect(r.bucketKey).toBe("male_30_nonsmoker");
    expect(r.premium).toBe(1000);
    expect(r.isExactMatch).toBe(true);
  });

  it("snaps age 41 to the 40 band", () => {
    const r = resolvePremium({ age: 41, gender: "male", smoker: false }, SEED_PREMIUMS);
    expect(r.bucketKey).toBe("male_40_nonsmoker");
    expect(r.premium).toBe(1500);
    expect(r.isExactMatch).toBe(true);
  });
});

describe("resolvePremium — smoker status", () => {
  it("returns the exact smoker bucket when present", () => {
    const withSmoker: PremiumsByProfile = { ...SEED_PREMIUMS, male_30_smoker: 1300 };
    const r = resolvePremium({ age: 30, gender: "male", smoker: true }, withSmoker);
    expect(r.bucketKey).toBe("male_30_smoker");
    expect(r.premium).toBe(1300);
    expect(r.isExactMatch).toBe(true);
  });

  it("falls back to same gender/age nonsmoker when no smoker bucket exists", () => {
    const r = resolvePremium({ age: 30, gender: "male", smoker: true }, SEED_PREMIUMS);
    expect(r.bucketKey).toBe("male_30_nonsmoker");
    expect(r.premium).toBe(1000);
    expect(r.isExactMatch).toBe(false);
    expect(r.matchedLabel).toContain("closest available");
  });
});

describe("resolvePremium — gender", () => {
  it("resolves the female bucket for a female profile", () => {
    const r = resolvePremium({ age: 40, gender: "female", smoker: false }, SEED_PREMIUMS);
    expect(r.bucketKey).toBe("female_40_nonsmoker");
    expect(r.premium).toBe(1400);
    expect(r.isExactMatch).toBe(true);
    expect(r.matchedLabel).toContain("Female, 40, non-smoker");
  });
});

describe("resolvePremium — missing / non-usable profile", () => {
  it("falls back to the default (M/30) for prefer_not_to_say", () => {
    const r = resolvePremium(
      { age: 35, gender: "prefer_not_to_say", smoker: false },
      SEED_PREMIUMS
    );
    expect(r.bucketKey).toBe("male_30_nonsmoker");
    expect(r.premium).toBe(1000);
    expect(r.isExactMatch).toBe(false);
    expect(r.matchedLabel).toBe("default (M/30)");
  });

  it("falls back to the default when the profile is empty", () => {
    const r = resolvePremium({}, SEED_PREMIUMS);
    expect(r.bucketKey).toBe("male_30_nonsmoker");
    expect(r.isExactMatch).toBe(false);
    expect(r.matchedLabel).toBe("default (M/30)");
  });

  it("falls back to the default when profile is undefined", () => {
    const r = resolvePremium(undefined, SEED_PREMIUMS);
    expect(r.bucketKey).toBe("male_30_nonsmoker");
    expect(r.premium).toBe(1000);
  });
});

describe("resolvePremium — missing buckets", () => {
  it("lands on male_30_nonsmoker when the exact bucket is absent but default exists", () => {
    const partial: PremiumsByProfile = {
      male_30_nonsmoker: 1000,
      female_40_nonsmoker: 1400,
    };
    // male/40 profile: no male_40_nonsmoker, no exact → default M/30.
    const r = resolvePremium({ age: 40, gender: "male", smoker: false }, partial);
    expect(r.premium).toBeDefined();
    expect(r.bucketKey).toBe("male_30_nonsmoker");
    expect(r.isExactMatch).toBe(false);
  });

  it("uses the first available bucket when no default exists", () => {
    const noDefault: PremiumsByProfile = { female_40_nonsmoker: 1400 };
    // male/30 profile: no exact, no nonsmoker for male, no default → first available.
    const r = resolvePremium({ age: 30, gender: "male", smoker: false }, noDefault);
    expect(r.premium).toBe(1400);
    expect(r.bucketKey).toBe("female_40_nonsmoker");
    expect(r.isExactMatch).toBe(false);
    expect(r.matchedLabel).toBe("closest available");
  });

  it("returns undefined for an empty premiums map", () => {
    const r = resolvePremium({ age: 30, gender: "male", smoker: false }, {});
    expect(r.premium).toBeUndefined();
    expect(r.bucketKey).toBeUndefined();
    expect(r.isExactMatch).toBe(false);
    expect(r.matchedLabel).toBe("not available");
  });
});

describe("budget conversion", () => {
  it("annualizes a monthly budget (× 12)", () => {
    expect(annualBudgetFromMonthly(200)).toBe(2400);
  });

  it("compares an annual premium against the annualized budget", () => {
    expect(isWithinBudget(2400, 200)).toBe(true); // exactly on budget
    expect(isWithinBudget(2401, 200)).toBe(false); // just over
    expect(isWithinBudget(1000, 200)).toBe(true); // comfortably under
  });

  it("returns false when premium or budget is missing", () => {
    expect(isWithinBudget(undefined, 200)).toBe(false);
    expect(isWithinBudget(1000, undefined)).toBe(false);
  });
});

describe("meetsCoverageNeed", () => {
  it("is true when coverage meets or exceeds the need", () => {
    expect(meetsCoverageNeed(100000, 100000)).toBe(true);
    expect(meetsCoverageNeed(150000, 100000)).toBe(true);
  });

  it("is false when coverage is below the need", () => {
    expect(meetsCoverageNeed(99999, 100000)).toBe(false);
  });

  it("is false when either value is missing", () => {
    expect(meetsCoverageNeed(100000, undefined)).toBe(false);
    expect(meetsCoverageNeed(undefined, 100000)).toBe(false);
  });
});

describe("hasUsableProfile", () => {
  it("is true only with a numeric age and usable gender", () => {
    expect(hasUsableProfile({ age: 30, gender: "male" })).toBe(true);
    expect(hasUsableProfile({ age: 30, gender: "female" })).toBe(true);
  });

  it("is false for missing/partial/non-usable profiles", () => {
    expect(hasUsableProfile(undefined)).toBe(false);
    expect(hasUsableProfile({})).toBe(false);
    expect(hasUsableProfile({ gender: "male" } as ComparePersonalProfile)).toBe(false);
    expect(hasUsableProfile({ age: 30 } as ComparePersonalProfile)).toBe(false);
    expect(hasUsableProfile({ age: 30, gender: "prefer_not_to_say" })).toBe(false);
  });
});
