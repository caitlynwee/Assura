import { ageFromDateOfBirth, profileAge } from "@/lib/profile";
import { profileSchema } from "@/lib/validators";

describe("profile age", () => {
  it("derives age correctly before and on a birthday", () => {
    expect(ageFromDateOfBirth("1990-06-16", new Date(2026, 5, 15))).toBe(35);
    expect(ageFromDateOfBirth("1990-06-16", new Date(2026, 5, 16))).toBe(36);
  });

  it("falls back to age for legacy profiles and prefers birthday when available", () => {
    expect(profileAge({ age: 32 })).toBe(32);
    expect(profileAge({ age: 32, dateOfBirth: "1990-06-16" }, new Date(2026, 5, 16))).toBe(36);
  });

  it("rejects invalid calendar dates and birthdays outside the supported age range", () => {
    expect(profileSchema.safeParse({ dateOfBirth: "2000-02-30" }).success).toBe(false);
    expect(profileSchema.safeParse({ dateOfBirth: "2020-01-01" }).success).toBe(false);
    expect(profileSchema.safeParse({ dateOfBirth: "1900-01-01" }).success).toBe(false);
  });

  it("accepts only the currently supported countries of origin", () => {
    expect(profileSchema.safeParse({ countryOfOrigin: "Singapore" }).success).toBe(true);
    expect(profileSchema.safeParse({ countryOfOrigin: "China" }).success).toBe(true);
    expect(profileSchema.safeParse({ countryOfOrigin: "Malaysia" }).success).toBe(false);
  });
});
