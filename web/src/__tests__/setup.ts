/**
 * setup.ts — DB-backed test harness.
 *
 * Spins up an in-process PGlite (WASM Postgres) database, applies the committed
 * Drizzle migrations, loads the seed data, and injects the Drizzle instance into
 * the data layer via setDb(). No Docker or external Postgres is required, and
 * the database is real Postgres (bigserial, jsonb, FKs all behave as in prod).
 */

import path from "path";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/schema";
import { setDb } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pgliteClient: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let testDb: any;

const migrationsFolder = path.resolve(__dirname, "../../drizzle");
const seedDir = path.resolve(__dirname, "../../../seed");

/** Remove every row (in FK-safe order), then reload the seed data. */
export async function resetDatabase(): Promise<void> {
  await testDb.delete(schema.threadMessages);
  await testDb.delete(schema.threads);
  await testDb.delete(schema.sources);
  await testDb.delete(schema.plans);
  await testDb.delete(schema.auditEntries);
  await testDb.delete(schema.scraperRuns);
  await testDb.delete(schema.users);
  await testDb.delete(schema.insurers);
  await seedDatabase(testDb, seedDir);
}

beforeAll(async () => {
  // Import PGlite lazily (ESM-only package) under ts-jest/CommonJS.
  const { PGlite } = await import("@electric-sql/pglite");
  pgliteClient = new PGlite(); // in-memory
  testDb = drizzle(pgliteClient, { schema });

  await migrate(testDb, { migrationsFolder });
  await seedDatabase(testDb, seedDir);

  setDb(testDb);
});

afterAll(async () => {
  if (pgliteClient) {
    await pgliteClient.close();
  }
});
