/**
 * migrate.ts — apply Drizzle migrations to the database at DATABASE_URL.
 * Invoked by `npm run db:migrate` (via tsx). Also used by the Docker
 * migrate+seed one-shot step.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "path";

async function waitForPostgres(url: string, maxAttempts = 30): Promise<void> {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const sql = postgres(url, { max: 1, connect_timeout: 5 });
      await sql`SELECT 1`;
      await sql.end();
      return;
    } catch {
      console.log(`[migrate] postgres not ready (attempt ${i}/${maxAttempts}), retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Could not connect to postgres after 30 attempts.");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  await waitForPostgres(url);

  // `max: 1` — migrations must run on a single connection, sequentially.
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);

  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  console.log(`[migrate] applying migrations from ${migrationsFolder} ...`);
  await migrate(db, { migrationsFolder });
  console.log("[migrate] done.");

  await sql.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
