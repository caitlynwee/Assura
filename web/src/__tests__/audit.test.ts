import "./setup";
import fs from "fs";
import path from "path";
import { logEvent, verifyChain } from "@/lib/audit";

// Use the test data dir from setup
const getAuditPath = () =>
  path.join(process.env.DATA_DIR_OVERRIDE!, "audit.jsonl");

beforeEach(() => {
  fs.writeFileSync(getAuditPath(), ""); // reset before each test
});

describe("Hash-chain audit log", () => {
  it("verifies an empty chain as valid", () => {
    const result = verifyChain();
    expect(result.valid).toBe(true);
    expect(result.entries).toBe(0);
  });

  it("logs events and verifies the chain", () => {
    logEvent("user_demo", "test.action", { detail: "first" });
    logEvent("user_demo", "test.action", { detail: "second" });
    logEvent("user_demo", "test.action", { detail: "third" });

    const result = verifyChain();
    expect(result.valid).toBe(true);
    expect(result.entries).toBe(3);
  });

  it("detects a tampered entry", () => {
    logEvent("user_demo", "test.action", { detail: "original" });

    // Tamper: overwrite the file with corrupted content
    const raw = fs.readFileSync(getAuditPath(), "utf-8");
    const lines = raw.trim().split("\n");
    const entry = JSON.parse(lines[0]);
    entry.action = "tampered.action"; // change action but keep original hash
    fs.writeFileSync(getAuditPath(), JSON.stringify(entry) + "\n");

    const result = verifyChain();
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(0);
  });
});
