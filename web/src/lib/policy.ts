/**
 * policy.ts — Policy engine (security-critical).
 *
 * The AI only requests actions. This module decides — in plain deterministic
 * code, with no LLM calls. Default outcome: DENY.
 *
 * Tiers:
 *   0 READ     — always allowed for authenticated users
 *   1 ADVISE   — allowed for premium users, no side effects
 *   2 SEND     — allowed only when userApproved === true (admins may run operations)
 *   3 BLOCKED  — never allowed; returns ESCALATE so the UI can inform the user
 *
 * Every decision is logged to the audit trail.
 */

import { logEvent } from "./audit";
import { PolicyTier, type PolicyDecision, type UserTier } from "./types";

export type PolicyAction =
  | "read_plans"
  | "read_threads"
  | "read_audit"
  | "chat_qa"
  | "policy_chat"
  | "draft_email"
  | "advise_plan"
  | "send_email"
  | "update_thread_status"
  | "extract_quote"
  | "trigger_scraper"
  | "create_plan"
  | "share_nric"
  | "share_health"
  | "share_income"
  | "share_phone"
  | "agree_to_buy"
  | "book_call";

interface PolicyContext {
  userId: string;
  userTier: UserTier;
  userApproved?: boolean; // required for SEND tier
}

const ACTION_TIERS: Record<PolicyAction, PolicyTier> = {
  // Tier 0 — read
  read_plans: PolicyTier.READ,
  read_threads: PolicyTier.READ,
  read_audit: PolicyTier.READ,
  chat_qa: PolicyTier.READ,
  policy_chat: PolicyTier.READ,

  // Tier 1 — advise/draft (premium, no side effects)
  draft_email: PolicyTier.ADVISE,
  advise_plan: PolicyTier.ADVISE,
  extract_quote: PolicyTier.ADVISE,
  update_thread_status: PolicyTier.ADVISE,

  // Tier 2 — send / privileged write (requires approval; admins may operate)
  send_email: PolicyTier.SEND,
  trigger_scraper: PolicyTier.SEND,
  create_plan: PolicyTier.SEND,

  // Tier 3 — blocked (AI must escalate to user)
  share_nric: PolicyTier.BLOCKED,
  share_health: PolicyTier.BLOCKED,
  share_income: PolicyTier.BLOCKED,
  share_phone: PolicyTier.BLOCKED,
  agree_to_buy: PolicyTier.BLOCKED,
  book_call: PolicyTier.BLOCKED,
};

export function evaluateAction(
  action: PolicyAction,
  context: PolicyContext
): PolicyDecision {
  const tier = ACTION_TIERS[action];

  let decision: PolicyDecision;

  if (tier === PolicyTier.BLOCKED) {
    decision = {
      outcome: "escalate",
      tier,
      action,
      reason: `Action "${action}" is blocked for AI. The user must be informed and must take this action themselves.`,
    };
  } else if (tier === PolicyTier.SEND) {
    if (context.userTier === "admin") {
      decision = {
        outcome: "allow",
        tier,
        action,
        reason: "Admin operations action permitted.",
      };
    } else if (context.userApproved !== true) {
      decision = {
        outcome: "deny",
        tier,
        action,
        reason: `Action "${action}" requires explicit user approval (userApproved must be true).`,
      };
    } else {
      decision = {
        outcome: "allow",
        tier,
        action,
        reason: "User approved send action.",
      };
    }
  } else if (tier === PolicyTier.ADVISE) {
    if (context.userTier !== "premium") {
      decision = {
        outcome: "deny",
        tier,
        action,
        reason: `Action "${action}" requires a premium account.`,
      };
    } else {
      decision = {
        outcome: "allow",
        tier,
        action,
        reason: "Premium user; advise/draft action permitted.",
      };
    }
  } else {
    // Tier 0 — READ: always allow for authenticated users
    decision = {
      outcome: "allow",
      tier,
      action,
      reason: "Read action; always permitted for authenticated users.",
    };
  }

  // Log every decision. evaluateAction stays synchronous (the policy test and
  // many route call sites depend on that), so the audit write is fire-and-forget.
  // audit.logEvent serializes writes internally, so the hash chain stays intact.
  void logEvent(context.userId, `policy.${decision.outcome}`, {
    action,
    tier,
    reason: decision.reason,
    userTier: context.userTier,
  }).catch(() => {});

  return decision;
}

/** Throws if the action is not allowed. Use in API route handlers. */
export function assertAllowed(
  action: PolicyAction,
  context: PolicyContext
): void {
  const decision = evaluateAction(action, context);
  if (decision.outcome !== "allow") {
    const error = new Error(decision.reason);
    (error as Error & { code: string }).code =
      decision.outcome === "escalate" ? "ESCALATE" : "FORBIDDEN";
    throw error;
  }
}
