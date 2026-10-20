/**
 * seed.ts — load typed demo fixtures into the database.
 *
 * Exposes seedDatabase(db) so both the `db:seed` CLI and the test harness can
 * reuse the exact same loader. It creates only the demo user; insurer, plan,
 * and source catalog records are discovered/populated by the scraper.
 */

import * as schema from "./schema";
import { seedUsers } from "./seed-data";
import type { Database } from "./db";

export async function seedDatabase(db: Database): Promise<void> {

  // ── users only — insurers/plans/sources are populated by the scraper ──
  if (seedUsers.length) {
    await db.insert(schema.users).values(
      seedUsers.map((u) => ({
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
  // Reset ONLY runtime/user data. The scraped catalog (insurers / plans /
  // sources) is EXPENSIVE to regenerate — each scrape costs Firecrawl tokens —
  // so reset must NEVER delete it. Clearing it here previously wiped scraped
  // plans on every `db:seed` RESET; do not re-add those deletes.
  await db.delete(schema.chatMessages);
  await db.delete(schema.chatConversations);
  await db.delete(schema.auditEntries);
  await db.delete(schema.scraperRuns);
  await db.delete(schema.threadMessages);
  await db.delete(schema.threads);
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

  // If RESET=1, clear ONLY runtime/user data, then re-seed users.
  // The scraped catalog (insurers / plans / sources) is intentionally PRESERVED
  // — regenerating it costs Firecrawl tokens + time. Do NOT delete it here.
  if (process.env.RESET === "1") {
    console.log("[seed] clearing runtime/user data (scraped catalog preserved) ...");
    await db.delete(schema.chatMessages);
    await db.delete(schema.chatConversations);
    await db.delete(schema.auditEntries);
    await db.delete(schema.scraperRuns);
    await db.delete(schema.threadMessages);
    await db.delete(schema.threads);
    await db.delete(schema.users);
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
