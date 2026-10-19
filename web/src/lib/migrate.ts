/**
 * migrate.ts — apply Drizzle migrations to the database at DATABASE_URL.
 * Invoked by `npm run db:migrate` (via tsx). Also used by the Docker
 * migrate+seed one-shot step.
 */

import { setDefaultResultOrder } from "node:dns";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "path";

// Force IPv4 DNS — Docker containers on macOS get IPv6 addresses for Supabase
// hostnames which are unreachable inside the Docker network bridge.
setDefaultResultOrder("ipv4first");

function pgOptions(url: string) {
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
  return { max: 1, ssl: isLocal ? false : ("require" as const) };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  const sql = postgres(url, pgOptions(url));
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
