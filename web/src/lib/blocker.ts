/**
 * blocker.ts — Personal-data (PII) blocker.
 *
 * Scans outgoing email bodies for NRIC patterns, Singapore phone numbers,
 * health keywords, and income references. Blocks the send if any are found.
 *
 * Fail-closed: if the scan itself throws, treat as blocked.
 */

import { NRIC_REGEX, SG_PHONE_REGEX, HEALTH_KEYWORDS, INCOME_KEYWORDS } from "./constants";
import { logEvent } from "./audit";
import type { BlockerResult, PiiMatch } from "./types";

export function scanForPII(text: string): BlockerResult {
  const matches: PiiMatch[] = [];
  const lower = text.toLowerCase();

  // NRIC pattern
  const nricMatches = text.match(new RegExp(NRIC_REGEX.source, "gi"));
  if (nricMatches) {
    nricMatches.forEach((value) => {
      matches.push({ type: "nric", value, index: text.indexOf(value) });
    });
  }

  // Singapore phone numbers
  const phoneMatches = [...text.matchAll(new RegExp(SG_PHONE_REGEX.source, "g"))];
  phoneMatches.forEach((m) => {
    matches.push({
      type: "phone",
      value: m[0],
      index: m.index ?? 0,
    });
  });

  // Health keywords
  HEALTH_KEYWORDS.forEach((keyword) => {
    const idx = lower.indexOf(keyword.toLowerCase());
    if (idx !== -1) {
      matches.push({ type: "health_keyword", value: keyword, index: idx });
    }
  });

  // Income keywords
  INCOME_KEYWORDS.forEach((keyword) => {
    const idx = lower.indexOf(keyword.toLowerCase());
    if (idx !== -1) {
      matches.push({ type: "income", value: keyword, index: idx });
    }
  });

  return {
    blocked: matches.length > 0,
    matches,
  };
}

/**
 * Throws if PII is detected in the email body. Logs the attempt to the audit trail.
 * Use this before any outgoing send.
 */
export function blockIfNeeded(emailBody: string, userId: string): void {
  let result: BlockerResult;

  try {
    result = scanForPII(emailBody);
  } catch (err) {
    // Fail-closed: if scanning errors, block the send.
    // blockIfNeeded stays synchronous; the audit write is fire-and-forget
    // (audit.logEvent serializes writes internally so the chain stays intact).
    void logEvent(userId, "blocker.error", {
      error: String(err),
      blocked: true,
    }).catch(() => {});
    throw new Error("PII scan failed; send blocked as a precaution.");
  }

  if (result.blocked) {
    void logEvent(userId, "blocker.blocked", {
      matchCount: result.matches.length,
      matchTypes: [...new Set(result.matches.map((m) => m.type))],
    }).catch(() => {});
    const types = [...new Set(result.matches.map((m) => m.type))].join(", ");
    throw new Error(
      `Send blocked: detected personal data in email (${types}). Remove this information before sending.`
    );
  }
}
