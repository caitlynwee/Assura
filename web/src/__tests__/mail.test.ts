import { generateMaskedAddress } from "@/lib/mail";

describe("generateMaskedAddress", () => {
  it("creates a stable Assura-local address for each user", () => {
    expect(generateMaskedAddress("user-123")).toBe("user-user123@relay.assura.local");
  });
});
