/**
 * audit.ts — Append-only hash-chain audit logger (PostgreSQL-backed).
 *
 * Each audit row stores the SHA-256 hash of the previous row's full JSON
 * string. The first entry uses prevHash "0".
 *
 * verifyChain() re-reads every row in insertion order and recomputes every
 * hash to detect any tampering. This is what the "Verify chain" button calls.
 *
 * ── Byte-identical hashing (HIGHEST RISK) ────────────────────────────────────
 * The hash is computed over an object with the EXACT key order
 *   { timestamp, actor, action, detail, prevHash }
 * serialized with JSON.stringify (no replacer, no spacing). To guarantee the
 * recomputation in verifyChain is byte-identical to what logEvent produced, we
 * persist:
 *   - `detail` as the EXACT serialized JSON string used when hashing (TEXT), and
 *   - `timestamp` as the EXACT ISO string (TEXT).
 * verifyChain rebuilds the hashed string by splicing the stored `detail` text
 * back into the object literal in the same key order, so no re-serialization of
 * `detail` ever happens — the stored bytes are hashed verbatim.
 */

import crypto from "crypto";
import {
  getLastAuditHash,
  insertAuditEntry,
  getAuditRows,
  type AuditRow,
} from "./db";
import type { AuditEntry, VerifyChainResult } from "./types";

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf-8").digest("hex");
}

/**
 * Serialize the hashed "partial" object by splicing the exact `detailJson` text
 * in place, preserving key order timestamp,actor,action,detail,prevHash. This
 * mirrors JSON.stringify({ timestamp, actor, action, detail, prevHash }) while
 * guaranteeing `detail` is byte-for-byte the stored string.
 */
function serializePartial(
  timestamp: string,
  actor: string,
  action: string,
  detailJson: string,
  prevHash: string
): string {
  return (
    "{" +
    `"timestamp":${JSON.stringify(timestamp)},` +
    `"actor":${JSON.stringify(actor)},` +
    `"action":${JSON.stringify(action)},` +
    `"detail":${detailJson},` +
    `"prevHash":${JSON.stringify(prevHash)}` +
    "}"
  );
}

// Serialize all audit writes through a single promise chain. The hash chain
// reads the previous hash then inserts; interleaving concurrent writes (some of
// which are fire-and-forget from policy.ts / blocker.ts) would read a stale
// prevHash. This queue guarantees strict ordering regardless of await.
let writeQueue: Promise<void> = Promise.resolve();

export function logEvent(
  actor: string,
  action: string,
  detail: Record<string, unknown>
): Promise<void> {
  const run = writeQueue.then(() => writeEntry(actor, action, detail));
  // Keep the queue alive even if a write rejects, so later writes still run.
  writeQueue = run.catch(() => {});
  return run;
}

async function writeEntry(
  actor: string,
  action: string,
  detail: Record<string, unknown>
): Promise<void> {
  const prevHash = await getLastAuditHash();

  const timestamp = new Date().toISOString();
  // Exact serialized form of `detail` — this is the text that gets hashed AND
  // stored, so recomputation is guaranteed byte-identical.
  const detailJson = JSON.stringify(detail);

  // Build the hashed string with EXACT key order timestamp,actor,action,detail,prevHash.
  const serialized = serializePartial(
    timestamp,
    actor,
    action,
    detailJson,
    prevHash
  );
  const hash = sha256(serialized);

  await insertAuditEntry({
    timestamp,
    actor,
    action,
    detail: detailJson,
    prevHash,
    hash,
  });
}

export async function verifyChain(): Promise<VerifyChainResult> {
  const rows = await getAuditRows();

  if (rows.length === 0) {
    return { valid: true, entries: 0 };
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Check prevHash linkage
    const expectedPrevHash = i === 0 ? "0" : rows[i - 1].hash;
    if (row.prevHash !== expectedPrevHash) {
      return { valid: false, entries: rows.length, brokenAt: i };
    }

    // Re-compute hash over the stored text (verbatim detail) and compare.
    const serialized = serializePartial(
      row.timestamp,
      row.actor,
      row.action,
      row.detail,
      row.prevHash
    );
    const recomputed = sha256(serialized);
    if (recomputed !== row.hash) {
      return { valid: false, entries: rows.length, brokenAt: i };
    }
  }

  return { valid: true, entries: rows.length };
}

export async function getAuditLog(): Promise<AuditEntry[]> {
  const rows = await getAuditRows();
  return rows.map((row: AuditRow) => ({
    timestamp: row.timestamp,
    actor: row.actor,
    action: row.action,
    detail: JSON.parse(row.detail) as Record<string, unknown>,
    prevHash: row.prevHash,
    hash: row.hash,
  }));
}
