/**
 * seed.ts — load seed/*.json into the database.
 *
 * Exposes seedDatabase(db) so both the `db:seed` CLI and the test harness can
 * reuse the exact same loader. Rows are inserted in FK-safe order:
 *   insurers → users → plans → sources → threads (+ thread_messages).
 * audit_entries and scraper_runs are intentionally left empty (runtime data).
 */

import fs from "fs";
import path from "path";
import * as schema from "./schema";
import type {
  Insurer,
  Plan,
  Source,
  Thread,
  User,
} from "./types";
import type { Database } from "./db";

function readSeed<T>(seedDir: string, file: string): T {
  const raw = fs.readFileSync(path.join(seedDir, file), "utf-8");
  return JSON.parse(raw) as T;
}

/** Resolve the repo-root seed/ directory from the web/ working dir. */
export function resolveSeedDir(): string {
  // When run from web/ (cwd), the seed dir is ../seed. Fall back to an env
  // override for containerized contexts.
  return (
    process.env.SEED_DIR ?? path.resolve(process.cwd(), "../seed")
  );
}

export async function seedDatabase(
  db: Database,
  seedDir: string = resolveSeedDir()
): Promise<void> {
  const insurers = readSeed<Insurer[]>(seedDir, "insurers.json");
  const users = readSeed<User[]>(seedDir, "users.json");
  const plans = readSeed<Plan[]>(seedDir, "plans.json");
  const sources = readSeed<Source[]>(seedDir, "sources.json");
  const threads = readSeed<Thread[]>(seedDir, "threads.json");

  // ── insurers ──
  if (insurers.length) {
    await db.insert(schema.insurers).values(
      insurers.map((i) => ({
        id: i.id,
        name: i.name,
        agentEmail: i.agentEmail,
        logo: i.logo,
        persona: i.persona,
        website: i.website,
      }))
    );
  }

  // ── users (ConsentFlags flattened to 8 booleans) ──
  if (users.length) {
    await db.insert(schema.users).values(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        passwordHash: u.passwordHash,
        name: u.name,
        tier: u.tier,
        maskedInbox: u.maskedInbox,
        onboarded: u.onboarded,
        shareAge: u.consent.shareAge,
        shareGender: u.consent.shareGender,
        shareSmokerStatus: u.consent.shareSmokerStatus,
        shareCoverageNeeds: u.consent.shareCoverageNeeds,
        shareBudgetRange: u.consent.shareBudgetRange,
        shareOccupation: u.consent.shareOccupation,
        shareHealthHistory: u.consent.shareHealthHistory,
        shareIncome: u.consent.shareIncome,
        createdAt: u.createdAt,
      }))
    );
  }

  // ── plans ──
  if (plans.length) {
    await db.insert(schema.plans).values(
      plans.map((p) => ({
        id: p.id,
        insurerId: p.insurerId,
        insurerName: p.insurerName,
        planName: p.planName,
        category: p.category,
        coverageAmount: p.coverageAmount,
        premiums: p.premiums,
        premiumFrequency: p.premiumFrequency,
        coverageTerms: p.coverageTerms,
        illnessesCovered: p.illnessesCovered,
        earlyStageConditions: p.earlyStageConditions,
        payoutType: p.payoutType,
        keyBenefits: p.keyBenefits,
        exclusions: p.exclusions,
        sourceUrl: p.sourceUrl,
        dataAsOf: p.dataAsOf,
        updatedBadge: p.updatedBadge,
        changeNotes: p.changeNotes,
        version: p.version,
        scrapedAt: p.scrapedAt,
      }))
    );
  }

  // ── sources ──
  if (sources.length) {
    await db.insert(schema.sources).values(
      sources.map((s) => ({
        id: s.id,
        insurerId: s.insurerId,
        label: s.label,
        url: s.url,
        type: s.type,
        planIds: s.planIds,
        etag: s.etag,
        lastModified: s.lastModified,
        contentHash: s.contentHash,
        lastChecked: s.lastChecked,
        lastChanged: s.lastChanged,
        status: s.status,
      }))
    );
  }

  // ── threads + thread_messages ──
  for (const t of threads) {
    await db.insert(schema.threads).values({
      id: t.id,
      userId: t.userId,
      insurerId: t.insurerId,
      insurerName: t.insurerName,
      subject: t.subject,
      status: t.status,
      extractedQuote: t.extractedQuote,
      riskFlags: t.riskFlags,
      addedToComparison: t.addedToComparison,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    });
    for (let i = 0; i < t.messages.length; i++) {
      const m = t.messages[i];
      await db.insert(schema.threadMessages).values({
        id: m.id,
        threadId: t.id,
        ordering: i,
        direction: m.direction,
        from: m.from,
        to: m.to,
        subject: m.subject,
        body: m.body,
        timestamp: m.timestamp,
        aiGenerated: m.aiGenerated,
        flagged: m.flagged,
        flagReason: m.flagReason ?? null,
      });
    }
  }
}

// ── CLI entrypoint (npm run db:seed) ──────────────────────────────────────────
async function main() {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const postgres = (await import("postgres")).default;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema });

  console.log("[seed] loading seed data ...");
  await seedDatabase(db);
  console.log("[seed] done.");

  await sql.end();
}

// Only run when invoked directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  main().catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
}
