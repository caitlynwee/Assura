/**
 * Client-side PII *preview* — mirrors lib/blocker.ts using the same patterns
 * from constants.ts so users see problems while typing.
 *
 * This is UX only. The authoritative check is server-side in
 * /api/outreach/send (blockIfNeeded), which blocks and writes to the audit chain.
 * (blocker.ts can't be imported here: it pulls in audit.ts → fs.)
 */

import { HEALTH_KEYWORDS, INCOME_KEYWORDS, NRIC_REGEX, SG_PHONE_REGEX } from "@/lib/constants";

export interface PiiHit {
  type: "NRIC" | "Phone" | "Health" | "Income";
  value: string;
}

export function previewPII(text: string): PiiHit[] {
  const hits: PiiHit[] = [];
  const lower = text.toLowerCase();

  for (const m of text.matchAll(new RegExp(NRIC_REGEX.source, "gi"))) {
    hits.push({ type: "NRIC", value: m[0] });
  }
  for (const m of text.matchAll(new RegExp(SG_PHONE_REGEX.source, "g"))) {
    hits.push({ type: "Phone", value: m[0] });
  }
  for (const k of HEALTH_KEYWORDS) {
    if (lower.includes(k.toLowerCase())) hits.push({ type: "Health", value: k });
  }
  for (const k of INCOME_KEYWORDS) {
    if (lower.includes(k.toLowerCase())) hits.push({ type: "Income", value: k });
  }
  return hits;
}
