#!/usr/bin/env bash
# reset.sh — Reset the database to seed state.
# Run from any directory; paths resolve relative to this script.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
WEB_DIR="$REPO_ROOT/web"

# Default to local dev Postgres; override with DATABASE_URL env var.
export DATABASE_URL="${DATABASE_URL:-postgres://postgres:dev@localhost:5432/assura}"
echo "Resetting database at $DATABASE_URL ..."

# Apply any pending migrations (idempotent).
cd "$WEB_DIR"
npx tsx src/lib/migrate.ts

# Truncate all tables and re-insert seed rows.
RESET=1 npx tsx src/lib/seed.ts

# Ensure the demo Supabase auth identity exists and re-link user_demo.auth_uid.
# RESET=1 above wipes auth_uid, so the demo identity must be re-linked.
# Early-returns (no throw) when Supabase keys are absent, so keyless resets pass.
npx tsx src/lib/seed-auth.ts

echo "Done. Database reset to seed state."
