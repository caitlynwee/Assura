/**
 * audit.ts — Append-only hash-chain audit logger.
 *
 * Each line in audit.jsonl stores the SHA-256 hash of the previous line's
 * full JSON string. The first entry uses prevHash "0".
 *
 * verifyChain() re-reads the entire file and recomputes every hash to detect
 * any tampering. This is what the "Verify chain" button calls.
 */

import crypto from "crypto";
import { appendJSONL, readJSONL } from "./db";
import type { AuditEntry, VerifyChainResult } from "./types";

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf-8").digest("hex");
}

export function logEvent(
  actor: string,
  action: string,
  detail: Record<string, unknown>
): void {
  const existing = safeReadAuditLog();
  const prevHash =
    existing.length > 0 ? existing[existing.length - 1].hash : "0";

  // Build entry without the hash field first, then compute hash over it
  const partial: Omit<AuditEntry, "hash"> = {
    timestamp: new Date().toISOString(),
    actor,
    action,
    detail,
    prevHash,
  };

  const hash = sha256(JSON.stringify(partial));
  const entry: AuditEntry = { ...partial, hash };

  appendJSONL("audit.jsonl", entry);
}

export function verifyChain(): VerifyChainResult {
  const entries = safeReadAuditLog();

  if (entries.length === 0) {
    return { valid: true, entries: 0 };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Check prevHash linkage
    const expectedPrevHash = i === 0 ? "0" : entries[i - 1].hash;
    if (entry.prevHash !== expectedPrevHash) {
      return { valid: false, entries: entries.length, brokenAt: i };
    }

    // Re-compute hash and verify
    const { hash, ...partial } = entry;
    const recomputed = sha256(JSON.stringify(partial));
    if (recomputed !== hash) {
      return { valid: false, entries: entries.length, brokenAt: i };
    }
  }

  return { valid: true, entries: entries.length };
}

export function getAuditLog(): AuditEntry[] {
  return safeReadAuditLog();
}

function safeReadAuditLog(): AuditEntry[] {
  try {
    return readJSONL<AuditEntry>("audit.jsonl");
  } catch {
    return [];
  }
}
