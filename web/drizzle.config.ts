import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config — single source of truth for migrations.
 * Schema lives in src/lib/schema.ts; generated SQL goes to ./drizzle.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/assura",
  },
});
