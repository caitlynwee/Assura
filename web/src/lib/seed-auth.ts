/**
 * seed-auth.ts — CLI entrypoint (npm run db:seed-auth).
 *
 * Ensures the demo@assura.local Supabase identity exists and links it to the
 * seeded user_demo app row. It upgrades the legacy demo@fineprint.local
 * identity in place when found. Safe to re-run; exits 0 even when Supabase
 * keys are absent (ensureDemoAuthUser early-returns with a warning), so
 * keyless seed/reset.sh and `docker compose up` still succeed.
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
  main()
    .then(() => {
      // Exit explicitly: the Supabase admin client / DB connection opened by
      // ensureDemoAuthUser can keep the event loop alive, which would hang this
      // one-shot container and block web/scraper (they depend_on it completing).
      process.exit(0);
    })
    .catch((err) => {
      console.error("[seed-auth] failed:", err);
      process.exit(1);
    });
}
