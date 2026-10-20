import { PolicyTier, type OutreachTemplate, type ThreadStatus } from "./types";

// ─── Auth session persistence ──────────────────────────────────────────────────

/**
 * Marker cookie recording the user's "Keep me signed in" choice.
 * - "1": persistent auth cookies (survive browser restart) — the default.
 * - "0": session-only auth cookies (cleared when the browser closes).
 *
 * It is read by the server client and edge middleware when (re)writing the
 * Supabase session cookies, so a refresh does not silently turn a
 * session-only login back into a persistent one. httpOnly + sameSite=lax.
 */
export const REMEMBER_COOKIE = "sb-remember";

// ─── Policy tiers ─────────────────────────────────────────────────────────────

export const TIER_LABELS: Record<PolicyTier, string> = {
  [PolicyTier.READ]: "Read",
  [PolicyTier.ADVISE]: "Advise / Draft",
  [PolicyTier.SEND]: "Send (approval required)",
  [PolicyTier.BLOCKED]: "Blocked — escalate to user",
};

// ─── Rate limits ──────────────────────────────────────────────────────────────

export const MAX_INSURERS_PER_OUTREACH = 5;

/** Days a deleted Plan Q&A chat stays in "Recently deleted" before it is purged. */
export const TRASH_RETENTION_DAYS = 30;

/** Maximum upload size for a user's own policy document PDF: 10 MB. */
export const MAX_POLICY_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_EMAILS_PER_USER_PER_DAY = 20;
export const FOLLOWUP_COOLDOWN_MS = 48 * 60 * 60 * 1000; // 48 hours

// ─── PII patterns (Singapore) ─────────────────────────────────────────────────

// NRIC: S/T/F/G/M + 7 digits + letter (case-insensitive)
export const NRIC_REGEX = /\b[STFGM]\d{7}[A-Z]\b/i;

// Singapore phone: 8-digit starting with 6/8/9, optional +65 prefix
export const SG_PHONE_REGEX =
  /(\+65[\s-]?)?(\(65\)[\s-]?)?[6|8|9]\d{3}[\s-]?\d{4}\b/g;

export const HEALTH_KEYWORDS: string[] = [
  "diagnosis",
  "diagnosed",
  "medical history",
  "medical condition",
  "pre-existing",
  "cancer",
  "diabetes",
  "hypertension",
  "heart disease",
  "stroke",
  "kidney disease",
  "liver disease",
  "mental health",
  "depression",
  "anxiety",
  "medication",
  "prescription",
  "surgery",
  "hospitalized",
  "hospitalisation",
  "treatment",
  "chemotherapy",
  "dialysis",
  "hiv",
  "aids",
  "asthma",
  "epilepsy",
];

export const INCOME_KEYWORDS: string[] = [
  "annual income",
  "monthly income",
  "salary",
  "net worth",
  "assets",
  "cpf",
  "cpf balance",
  "income tax",
  "noa",
];

// ─── AI disclosure footer ──────────────────────────────────────────────────────

export const AI_DISCLOSURE_FOOTER =
  "— Sent with the help of Assura, a personal insurance assistant, and reviewed and approved by me before sending.";

// ─── Thread statuses ──────────────────────────────────────────────────────────

export const THREAD_STATUSES: ThreadStatus[] = [
  "draft",
  "awaiting_approval",
  "sent",
  "replied",
  "info_received",
  "flagged",
  "closed",
];

export const THREAD_STATUS_LABELS: Record<ThreadStatus, string> = {
  draft: "Draft",
  awaiting_approval: "Awaiting Approval",
  sent: "Sent",
  replied: "Replied",
  info_received: "Info Received",
  flagged: "Flagged",
  closed: "Closed",
};

// ─── Outreach templates ───────────────────────────────────────────────────────

export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: "request_quote",
    label: "Request a Quote",
    description: "Ask for a personalised premium quote based on your profile.",
    promptHint:
      "Request a personalised critical illness insurance quote. Provide relevant profile details and ask for the premium, coverage amount, and any available riders.",
  },
  {
    id: "ask_exclusions",
    label: "Ask About Exclusions",
    description: "Clarify what conditions are not covered by the plan.",
    promptHint:
      "Ask the insurer to clarify the full list of exclusions, waiting periods, and any conditions that would affect eligibility for a critical illness plan.",
  },
  {
    id: "ask_riders",
    label: "Enquire About Riders",
    description: "Ask what optional add-ons are available.",
    promptHint:
      "Ask about optional riders that can be attached to the critical illness plan, including early-stage cancer, premium waiver, and multi-pay options.",
  },
  {
    id: "compare_plans",
    label: "Compare Plan Options",
    description: "Ask the insurer to outline their available CI plan tiers.",
    promptHint:
      "Ask the insurer to briefly outline the different critical illness plan options they offer, including key differences in coverage, premiums, and terms.",
  },
  {
    id: "follow_up",
    label: "Follow Up",
    description: "Send a polite follow-up on a previous enquiry.",
    promptHint:
      "Write a polite follow-up email referencing a previous enquiry and asking for an update or the information requested earlier.",
  },
];
