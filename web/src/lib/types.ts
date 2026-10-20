// ─── User ─────────────────────────────────────────────────────────────────────

import type { CountryOfOrigin } from "./countries";

export type UserTier = "free" | "premium";

export interface ConsentFlags {
  shareAge: boolean;
  shareGender: boolean;
  shareSmokerStatus: boolean;
  shareCoverageNeeds: boolean;
  shareBudgetRange: boolean;
  shareOccupation: boolean;
  shareHealthHistory: boolean;
  shareIncome: boolean;
}

/** Optional profile captured in settings/onboarding. Exact birthday and country
 *  remain private; outreach receives only explicitly consented fields. */
export interface UserProfile {
  /** Legacy age retained for profiles created before date-of-birth collection. */
  age?: number;
  dateOfBirth?: string;
  countryOfOrigin?: CountryOfOrigin;
  gender?: "male" | "female" | "prefer_not_to_say";
  smoker?: boolean;
  coverageNeeded?: number; // SGD
  monthlyBudget?: number; // SGD
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  tier: UserTier;
  maskedInbox: string;
  onboarded: boolean;
  consent: ConsentFlags;
  profile?: UserProfile;
  createdAt: string; // ISO 8601
  /** Supabase auth.users.id (uuid as text); undefined until linked. */
  authUid?: string;
}

/** User object safe to send to the client — never includes passwordHash. */
export type PublicUser = Omit<User, "passwordHash">;

// ─── Insurance Plans ──────────────────────────────────────────────────────────

export interface PremiumsByProfile {
  male_30_nonsmoker?: number;
  male_40_nonsmoker?: number;
  female_30_nonsmoker?: number;
  female_40_nonsmoker?: number;
  [key: string]: number | undefined;
}

export type CoverageTerm =
  | "whole_life"
  | "to_age_65"
  | "to_age_70"
  | "to_age_75"
  | "5_years"
  | "10_years"
  | "20_years"
  | "25_years";

export interface Plan {
  id: string;
  insurerId: string;
  insurerName: string;
  planName: string;
  category: "critical_illness";
  coverageAmount: number;
  premiums: PremiumsByProfile;
  premiumFrequency: "annual" | "monthly";
  coverageTerms: CoverageTerm[];
  illnessesCovered: number;
  earlyStageConditions: boolean;
  payoutType: "lump_sum" | "monthly_income" | "hybrid";
  keyBenefits: string[];
  exclusions: string[];
  sourceUrl: string;
  dataAsOf: string; // YYYY-MM-DD
  updatedBadge: boolean;
  changeNotes: string[];
  version: number;
  scrapedAt: string; // ISO 8601
}

// ─── Insurers ─────────────────────────────────────────────────────────────────

export type PersonaType = "helpful" | "slow" | "pushy" | "data_grabber" | "injector";

export interface Insurer {
  id: string;
  name: string;
  agentEmail: string;
  logo: string;
  persona: PersonaType;
  website: string;
}

// ─── Scraper Sources ──────────────────────────────────────────────────────────

export type SourceStatus = "pending" | "ok" | "changed" | "error" | "skipped";

export interface Source {
  id: string;
  insurerId: string;
  label: string;
  url: string;
  type: "product_page" | "pdf" | "mock";
  planIds: string[];
  etag: string | null;
  lastModified: string | null;
  contentHash: string | null;
  lastChecked: string | null;
  lastChanged: string | null;
  status: SourceStatus;
}

// ─── Email Threads / CRM ──────────────────────────────────────────────────────

export type ThreadStatus =
  | "draft"
  | "awaiting_approval"
  | "sent"
  | "replied"
  | "info_received"
  | "flagged"
  | "closed";

export interface ThreadMessage {
  id: string;
  direction: "outbound" | "inbound";
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: string; // ISO 8601
  aiGenerated: boolean;
  flagged: boolean;
  flagReason?: string;
}

export interface ExtractedQuote {
  annualPremium?: number;
  coverageAmount?: number;
  waitingPeriod?: string;
  exclusionsNoted?: string[];
  riderOptions?: string[];
  validUntil?: string;
  rawNotes?: string;
  extractedAt: string;
}

export interface Thread {
  id: string;
  userId: string;
  insurerId: string;
  insurerName: string;
  subject: string;
  status: ThreadStatus;
  messages: ThreadMessage[];
  extractedQuote: ExtractedQuote | null;
  riskFlags: string[];
  addedToComparison: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditEntry {
  timestamp: string;
  actor: string; // userId or "system"
  action: string;
  detail: Record<string, unknown>;
  prevHash: string; // SHA-256 of previous entry's JSON string; "0" for first entry
  hash: string; // SHA-256 of this entry's JSON string (sans the hash field)
}

// ─── Scraper Runs ─────────────────────────────────────────────────────────────

export interface ScraperRun {
  runId: string;
  trigger: "cron" | "manual";
  startedAt: string;
  finishedAt: string;
  sourcesChecked: number;
  sourcesChanged: number;
  errors: Array<{ sourceId: string; message: string }>;
}

// ─── Policy Engine ────────────────────────────────────────────────────────────

export enum PolicyTier {
  READ = 0,
  ADVISE = 1,
  SEND = 2,
  BLOCKED = 3,
}

export type PolicyOutcome = "allow" | "deny" | "escalate";

export interface PolicyDecision {
  outcome: PolicyOutcome;
  tier: PolicyTier;
  reason: string;
  action: string;
}

// ─── PII Blocker ──────────────────────────────────────────────────────────────

export interface PiiMatch {
  type: "nric" | "phone" | "health_keyword" | "income" | "real_email";
  value: string;
  index: number;
}

export interface BlockerResult {
  blocked: boolean;
  matches: PiiMatch[];
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: string;
}

export interface Citation {
  planId: string;
  planName: string;
  sourceUrl: string;
  excerpt: string;
}

// ─── Outreach ─────────────────────────────────────────────────────────────────

export interface OutreachTemplate {
  id: string;
  label: string;
  description: string;
  promptHint: string;
}

export interface DraftEmailRequest {
  insurerId: string;
  templateId: string;
  userContext: {
    age?: number;
    gender?: string;
    smoker?: boolean;
    coverageNeeded?: number;
    monthlyBudget?: number;
  };
}

export interface SendEmailRequest {
  threadId?: string; // if following up on existing thread
  insurerId: string;
  subject: string;
  body: string;
  userApproved: true; // must be explicitly set to true
}

// ─── API responses ────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code?: string;
}

export interface VerifyChainResult {
  valid: boolean;
  entries: number;
  brokenAt?: number;
}
