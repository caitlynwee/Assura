import { scanForPII } from "@/lib/blocker";

describe("PII blocker", () => {
  it("detects NRIC patterns", () => {
    const result = scanForPII("My NRIC is S1234567A.");
    expect(result.blocked).toBe(true);
    expect(result.matches.some((m) => m.type === "nric")).toBe(true);
  });

  it("detects Singapore phone numbers", () => {
    const result = scanForPII("Call me at 91234567.");
    expect(result.blocked).toBe(true);
    expect(result.matches.some((m) => m.type === "phone")).toBe(true);
  });

  it("detects health keywords", () => {
    const result = scanForPII("I was diagnosed with cancer last year.");
    expect(result.blocked).toBe(true);
    expect(result.matches.some((m) => m.type === "health_keyword")).toBe(true);
  });

  it("does not block clean text", () => {
    const result = scanForPII(
      "I am interested in learning more about your critical illness plans."
    );
    expect(result.blocked).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it("detects +65 prefixed phone", () => {
    const result = scanForPII("Contact me at +65 8123 4567.");
    expect(result.blocked).toBe(true);
  });
});
