import {
  isValidViewTier,
  resolveEffectiveViewTier,
  VIEW_COOKIE_NAME,
  VIEW_STORAGE_KEY,
} from "@/lib/view-mode";

describe("resolveEffectiveViewTier (cosmetic, admin-only)", () => {
  it("defaults to the real tier when no view is requested", () => {
    expect(resolveEffectiveViewTier("admin", null)).toBe("admin");
    expect(resolveEffectiveViewTier("admin", undefined)).toBe("admin");
    expect(resolveEffectiveViewTier("free", null)).toBe("free");
    expect(resolveEffectiveViewTier("premium", null)).toBe("premium");
  });

  it("lets a real admin preview any valid tier", () => {
    expect(resolveEffectiveViewTier("admin", "free")).toBe("free");
    expect(resolveEffectiveViewTier("admin", "premium")).toBe("premium");
    expect(resolveEffectiveViewTier("admin", "admin")).toBe("admin");
  });

  it("never lets a non-admin cosmetically upgrade (guard)", () => {
    expect(resolveEffectiveViewTier("free", "admin")).toBe("free");
    expect(resolveEffectiveViewTier("free", "premium")).toBe("free");
    expect(resolveEffectiveViewTier("premium", "admin")).toBe("premium");
    expect(resolveEffectiveViewTier("premium", "free")).toBe("premium");
  });

  it("falls back to the real tier for invalid/garbage requests", () => {
    expect(resolveEffectiveViewTier("admin", "superuser")).toBe("admin");
    expect(resolveEffectiveViewTier("admin", "")).toBe("admin");
    expect(resolveEffectiveViewTier("admin", "FREE")).toBe("admin");
  });
});

describe("isValidViewTier", () => {
  it("accepts the three valid tiers", () => {
    expect(isValidViewTier("free")).toBe(true);
    expect(isValidViewTier("premium")).toBe(true);
    expect(isValidViewTier("admin")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidViewTier("superuser")).toBe(false);
    expect(isValidViewTier("")).toBe(false);
    expect(isValidViewTier(null)).toBe(false);
    expect(isValidViewTier(undefined)).toBe(false);
    expect(isValidViewTier(42)).toBe(false);
  });
});

describe("view-mode constants", () => {
  it("exposes stable cookie/storage keys", () => {
    expect(VIEW_COOKIE_NAME).toBe("assura_view_as");
    expect(VIEW_STORAGE_KEY).toBe("assura:view-as");
  });
});
