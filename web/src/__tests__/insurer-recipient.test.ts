import { getInsurerRecipientAddress } from "@/lib/insurer-recipient";

describe("getInsurerRecipientAddress", () => {
  it("uses the configured address when present", () => {
    expect(getInsurerRecipientAddress("aia", "  contact@aia.example  ")).toBe(
      "contact@aia.example",
    );
  });

  it("generates a deterministic local address when no contact is configured", () => {
    expect(getInsurerRecipientAddress("great-eastern", "")).toBe(
      "insurer-great-eastern@insurer.assura.local",
    );
  });

  it("normalizes insurer ids into safe local addresses", () => {
    expect(getInsurerRecipientAddress("AIA/China", " ")).toBe(
      "insurer-aia-china@insurer.assura.local",
    );
  });

  it("rejects an empty insurer id when no contact is configured", () => {
    expect(() => getInsurerRecipientAddress("!!!", "")).toThrow(
      "Cannot create a simulated email address",
    );
  });
});
