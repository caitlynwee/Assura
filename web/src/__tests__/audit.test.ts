import { testDb } from "./setup";
import { eq } from "drizzle-orm";
import { logEvent, verifyChain } from "@/lib/audit";
import * as schema from "@/lib/schema";

beforeEach(async () => {
  // Start every test from an empty audit chain.
  await testDb.delete(schema.auditEntries);
});

describe("Hash-chain audit log", () => {
  it("verifies an empty chain as valid", async () => {
    const result = await verifyChain();
    expect(result.valid).toBe(true);
    expect(result.entries).toBe(0);
  });

  it("logs events and verifies the chain", async () => {
    await logEvent("user_demo", "test.action", { detail: "first" });
    await logEvent("user_demo", "test.action", { detail: "second" });
    await logEvent("user_demo", "test.action", { detail: "third" });

    const result = await verifyChain();
    expect(result.valid).toBe(true);
    expect(result.entries).toBe(3);
  });

  it("detects a tampered entry", async () => {
    await logEvent("user_demo", "test.action", { detail: "original" });

    // Tamper: mutate the stored row (change action, keep the original hash).
    const rows = await testDb
      .select()
      .from(schema.auditEntries)
      .orderBy(schema.auditEntries.id);
    const first = rows[0];
    await testDb
      .update(schema.auditEntries)
      .set({ action: "tampered.action" })
      .where(eq(schema.auditEntries.id, first.id));

    const result = await verifyChain();
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(0);
  });
});
