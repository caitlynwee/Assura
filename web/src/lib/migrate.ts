/**
 * migrate.ts — apply Drizzle migrations to the database at DATABASE_URL.
 * Invoked by `npm run db:migrate` (via tsx). Also used by the Docker
 * migrate+seed one-shot step.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

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
