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
import type { User } from "./types";
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
  const users = readSeed<User[]>(seedDir, "users.json");

  // ── users only — insurers/plans/sources are populated by the scraper ──
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
    ).onConflictDoNothing();
  }
}

/**
 * Truncate all tables in reverse FK order, then re-seed.
 * Used by seed/reset.sh to reset the database to a clean demo state.
 */
export async function resetDatabase(db: Database): Promise<void> {
  // Reverse FK order: children before parents. Plans/sources/insurers are
  // left for the scraper to repopulate — only runtime data is cleared.
  await db.delete(schema.auditEntries);
  await db.delete(schema.scraperRuns);
  await db.delete(schema.threadMessages);
  await db.delete(schema.threads);
  await db.delete(schema.sources);
  await db.delete(schema.plans);
  await db.delete(schema.insurers);
  await db.delete(schema.users);
  await seedDatabase(db);
}

// ── CLI entrypoint (npm run db:seed) ──────────────────────────────────────────
async function main() {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const postgres = (await import("postgres")).default;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
  const sql = postgres(url, { max: 1, ssl: isLocal ? false : "require" });
  const db = drizzle(sql, { schema });

  // If RESET=1, truncate first (idempotent re-seed for dev/demo reset).
  if (process.env.RESET === "1") {
    console.log("[seed] truncating tables ...");
    await db.delete(schema.auditEntries);
    await db.delete(schema.scraperRuns);
    await db.delete(schema.threadMessages);
    await db.delete(schema.threads);
    await db.delete(schema.sources);
    await db.delete(schema.plans);
    await db.delete(schema.users);
    await db.delete(schema.insurers);
  }

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
