/**
 * schema.ts — SINGLE source of truth for the PostgreSQL schema (Drizzle ORM).
 *
 * Drizzle OWNS the schema and migrations. The Python scraper (SQLAlchemy) only
 * MAPS to the tables created here — it never issues DDL.
 *
 * Column-naming decision: columns are snake_case in the database; Drizzle field
 * names stay camelCase (matching web/src/lib/types.ts) via explicit column-name
 * aliases. This gives the TS side camelCase objects and the Python side clean
 * snake_case column names to map 1:1.
 *
 * Text primary keys are intentional — ids are human-readable slugs
 * (e.g. "aia", "user_demo", "aia_ci_power") that come straight from the seed.
 */

import {
  pgTable,
  text,
  boolean,
  integer,
  jsonb,
  bigserial,
} from "drizzle-orm/pg-core";

// ─── users ──────────────────────────────────────────────────────────────────
// ConsentFlags is flattened to 8 boolean columns (queryable, matches flat seed).
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  tier: text("tier").notNull(), // 'free' | 'premium'
  maskedInbox: text("masked_inbox").notNull(),
  onboarded: boolean("onboarded").notNull(),
  // ConsentFlags (8 booleans)
  shareAge: boolean("share_age").notNull(),
  shareGender: boolean("share_gender").notNull(),
  shareSmokerStatus: boolean("share_smoker_status").notNull(),
  shareCoverageNeeds: boolean("share_coverage_needs").notNull(),
  shareBudgetRange: boolean("share_budget_range").notNull(),
  shareOccupation: boolean("share_occupation").notNull(),
  shareHealthHistory: boolean("share_health_history").notNull(),
  shareIncome: boolean("share_income").notNull(),
  createdAt: text("created_at").notNull(), // ISO 8601 string
});

// ─── insurers ─────────────────────────────────────────────────────────────────
export const insurers = pgTable("insurers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  agentEmail: text("agent_email").notNull(),
  logo: text("logo").notNull(),
  persona: text("persona").notNull(), // PersonaType
  website: text("website").notNull(),
  country: text("country").notNull(),
});

// ─── plans ────────────────────────────────────────────────────────────────────
export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  insurerId: text("insurer_id")
    .notNull()
    .references(() => insurers.id),
  insurerName: text("insurer_name").notNull(),
  planName: text("plan_name").notNull(),
  category: text("category").notNull(),
  coverageAmount: integer("coverage_amount").notNull(),
  // PremiumsByProfile allows arbitrary extra numeric keys → jsonb preserves them.
  premiums: jsonb("premiums").notNull(),
  premiumFrequency: text("premium_frequency").notNull(),
  coverageTerms: jsonb("coverage_terms").notNull(), // CoverageTerm[]
  illnessesCovered: integer("illnesses_covered").notNull(),
  earlyStageConditions: boolean("early_stage_conditions").notNull(),
  payoutType: text("payout_type").notNull(),
  keyBenefits: jsonb("key_benefits").notNull(), // string[]
  exclusions: jsonb("exclusions").notNull(), // string[]
  sourceUrl: text("source_url").notNull(),
  dataAsOf: text("data_as_of").notNull(), // YYYY-MM-DD
  updatedBadge: boolean("updated_badge").notNull(),
  changeNotes: jsonb("change_notes").notNull(), // string[]
  version: integer("version").notNull(),
  scrapedAt: text("scraped_at").notNull(), // ISO 8601
  country: text("country").notNull(),
});

// ─── sources ────────────────────────────────────────────────────────────────
export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  insurerId: text("insurer_id")
    .notNull()
    .references(() => insurers.id),
  label: text("label").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull(), // 'product_page' | 'pdf' | 'mock'
  planIds: jsonb("plan_ids").notNull(), // string[]
  etag: text("etag"),
  lastModified: text("last_modified"),
  contentHash: text("content_hash"),
  lastChecked: text("last_checked"),
  lastChanged: text("last_changed"),
  status: text("status").notNull(), // SourceStatus
  country: text("country").notNull(),
});

// ─── threads ──────────────────────────────────────────────────────────────────
export const threads = pgTable("threads", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  insurerId: text("insurer_id")
    .notNull()
    .references(() => insurers.id),
  insurerName: text("insurer_name").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull(), // ThreadStatus
  // ExtractedQuote | null — read/written as a unit, so jsonb (nullable) is fine.
  extractedQuote: jsonb("extracted_quote"),
  riskFlags: jsonb("risk_flags").notNull(), // string[]
  addedToComparison: boolean("added_to_comparison").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ─── thread_messages ──────────────────────────────────────────────────────────
// Child table of threads. `ordering` gives a stable append order so that
// "last outbound by timestamp" logic in mail.ts stays deterministic.
export const threadMessages = pgTable("thread_messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id")
    .notNull()
    .references(() => threads.id),
  ordering: integer("ordering").notNull(),
  direction: text("direction").notNull(), // 'outbound' | 'inbound'
  from: text("from").notNull(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  timestamp: text("timestamp").notNull(), // ISO 8601
  aiGenerated: boolean("ai_generated").notNull(),
  flagged: boolean("flagged").notNull(),
  flagReason: text("flag_reason"),
});

// ─── scraper_runs ─────────────────────────────────────────────────────────────
export const scraperRuns = pgTable("scraper_runs", {
  runId: text("run_id").primaryKey(),
  trigger: text("trigger").notNull(), // 'cron' | 'manual'
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at").notNull(),
  sourcesChecked: integer("sources_checked").notNull(),
  sourcesChanged: integer("sources_changed").notNull(),
  errors: jsonb("errors").notNull(), // Array<{ sourceId, message }>
});

// ─── audit_entries — HIGHEST-RISK table (hash chain) ──────────────────────────
//
// The audit hash chain is computed as:
//   partial = { timestamp, actor, action, detail, prevHash }   (EXACT key order)
//   hash    = sha256(JSON.stringify(partial))
//
// Fidelity rules (do NOT change these column types):
//   - `detail` is stored as TEXT holding the EXACT serialized JSON string used
//     when hashing. jsonb would reorder keys and renormalize whitespace/numbers,
//     which would break byte-identical recomputation in verifyChain().
//   - `timestamp` is stored as TEXT holding the exact ISO string
//     (e.g. "2026-10-01T00:00:00.000Z"). timestamptz would re-render the value
//     and could change millisecond/`Z` formatting, breaking the chain.
//   - `id` is a monotonic bigserial used purely for insertion ordering; the
//     chain is read ORDER BY id ASC and the newest prevHash is read ORDER BY
//     id DESC LIMIT 1.
export const auditEntries = pgTable("audit_entries", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  timestamp: text("timestamp").notNull(), // exact ISO text — NOT timestamptz
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull(), // exact serialized JSON string — NOT jsonb
  prevHash: text("prev_hash").notNull(),
  hash: text("hash").notNull(),
});
