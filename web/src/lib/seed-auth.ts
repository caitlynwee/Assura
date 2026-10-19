/**
 * seed-auth.ts — CLI entrypoint (npm run db:seed-auth).
 *
 * Ensures the demo@fineprint.local Supabase identity exists and links it to the
 * seeded user_demo app row. Safe to re-run; exits 0 even when Supabase keys are
 * absent (ensureDemoAuthUser early-returns with a warning), so keyless
 * seed/reset.sh and `docker compose up` still succeed.
 *
 * Run order matters: migrate → seed (truncate + reload) → seed-auth, because a
 * RESET=1 re-seed wipes user_demo.auth_uid, so this must re-link every reset.
 */

import { ensureDemoAuthUser } from "./supabase/ensure-demo-user";

async function main() {
  await ensureDemoAuthUser();
  console.log("[seed-auth] done.");
}

// Only run when invoked directly (not when imported).
if (process.argv[1] && process.argv[1].endsWith("seed-auth.ts")) {
  main().catch((err) => {
    console.error("[seed-auth] failed:", err);
    process.exit(1);
  });
}
