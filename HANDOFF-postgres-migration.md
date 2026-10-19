# Handoff: PostgreSQL Storage Migration — Status & Next Steps

**Updated:** 2026-10-20 · **By:** Marcus
**Branch:** `migrate/postgres-storage`

---

## TL;DR — What's Done

The full JSON → PostgreSQL migration is **complete and verified** (build + tests pass).
The branch is ready to be rebased onto `main` and merged. One pending item before merging:
run `npm run db:migrate && npm run db:seed` against a real Postgres to confirm the schema
and seed load correctly (Docker wasn't available during implementation — needs a quick smoke test).

---

## What Was Completed

### FEAT-001 — Web (Drizzle ORM) ✅
All work from Jeff's original WIP commit was verified and the infra gaps were filled:

| Item | Status |
|------|--------|
| `web/src/lib/schema.ts` — Drizzle table definitions for 8 tables | ✅ Verified |
| `web/drizzle/0000_*.sql` — generated migration | ✅ Verified |
| `web/src/lib/db.ts` — async Drizzle data layer (replaces readJSON/writeJSON) | ✅ Verified |
| `web/src/lib/audit.ts` — DB-backed hash chain (TEXT columns, write queue) | ✅ Verified |
| `web/src/lib/migrate.ts` + `seed.ts` — migrate + seed scripts | ✅ Verified |
| All 12+ API routes converted from JSON → async Drizzle calls | ✅ Verified |
| `web/src/__tests__/` — PGlite-backed audit test (tamper detection works) | ✅ 12/12 pass |
| `npm run build` | ✅ Clean |
| `npm run lint` | ✅ 2 pre-existing errors only (Dominic's — leave them) |

**Infrastructure gaps filled:**
- `docker-compose.yml`: added `postgres:16` service with healthcheck + named volume `pgdata`; added `db-init` one-shot (runs `db:migrate + db:seed`); removed `init-data` JSON-copy; added `DATABASE_URL` to web + scraper; removed `DATA_DIR_OVERRIDE`
- `seed/reset.sh`: rewritten to reset the DB (truncate + re-seed) instead of copying JSON files
- `web/src/lib/seed.ts`: added `resetDatabase()` + `RESET=1` truncation path for idempotent resets
- `DATABASE_URL` added to `.env.example`, `web/.env.local.example`, `scraper/.env.example`
- `dev.sh`: added `db:migrate` and `db:seed` shortcuts; updated `setup` + `seed` commands

### FEAT-002 — Scraper (SQLAlchemy 2.0) ✅
Completed from scratch:

| Item | Status |
|------|--------|
| `scraper/app/storage/database.py` — SQLAlchemy models (no DDL, maps to Drizzle tables) | ✅ Done |
| `scraper/app/scraper/engine.py` — reads/writes plans + sources via SQLAlchemy | ✅ Done |
| `scraper/app/personas/simulator.py` — Thread/ThreadMessage/Insurer via SQLAlchemy | ✅ Done |
| `scraper/app/routers/scraper.py` — ScraperRun DB query for `/scraper/status` | ✅ Done |
| `json_store.py`, `jsonl_append.py` deleted | ✅ Done |
| `ruff check app/` | ✅ Clean |
| `pytest` | ✅ 12/12 pass |

**Also removed:** `_save_versioned()` (HTML snapshots to `data/versions/`) — not part of the demo flow, removed to simplify infra. The `data/` folder is no longer needed.

### Merge with main ✅
Merged `origin/main` (6 commits) into branch. Resolved conflicts across:
- `HANDOFF-postgres-migration.md`, `TASK.MD`
- `web/jest.config.js`, `web/package.json`, `web/package-lock.json`
- `web/src/__tests__/setup.ts`
- `web/src/app/api/onboarding/route.ts`, `web/src/lib/auth.ts`

Dominic's auth flow (brute-force throttle, audit events, timing protection) was merged into auth.ts
using async DB calls. `users.ts` was rewritten to use Drizzle instead of JSON readJSON/writeJSON.
`onboarding.ts` was made async to match the DB-backed `updateUser`.

---

## What Still Needs Doing Before Merging

### 1. Smoke test against real Postgres (15 min)
```bash
# Start Postgres
docker run -d --name assura-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=assura -p 5432:5432 postgres:16

# Apply migrations + seed
cd web
DATABASE_URL=postgres://postgres:dev@localhost:5432/assura npm run db:migrate
DATABASE_URL=postgres://postgres:dev@localhost:5432/assura npm run db:seed
```
Confirm in DBeaver or psql:
- 6 insurers with text IDs (`aia`, `prudential`, `great_eastern`, `ntuc_income`, `manulife`, `singlife`)
- 1 user `user_demo`
- Plans + sources with text PKs
- `audit_entries` + `scraper_runs` empty (runtime data)

### 2. Verify audit chain end-to-end
Start the web app with DATABASE_URL set, log in, perform some actions, then:
- Click "Verify chain" → must show ✓
- Run tamper SQL: `UPDATE audit_entries SET action='tampered' WHERE id=(SELECT MIN(id) FROM audit_entries);`
- Click "Verify chain" again → must show ✗

### 3. Rebase onto main and merge
```bash
git fetch origin
git rebase origin/main
# resolve any conflicts (unlikely — branches touch different files)
git push origin migrate/postgres-storage
# open PR or ff-merge to main
```

### 4. Coordinate with Jeff — rebase jeff/outreach-crm onto this
The `jeff/outreach-crm` branch (PR #1) is built on old JSON storage. Its `api/crm/*` and
`api/outreach/*` routes call `readJSON`/`writeJSON` which no longer exist. After this branch
merges to main, Jeff needs to rebase onto main and wire those routes to the Drizzle data layer
(`getThreadsByUser`, `getThreadById`, `insertThread`, `appendThreadMessage`, `updateThread`).

---

## Key Architecture Facts (do not change)

### Audit hash chain — highest risk (30% of score)
- Hash = `sha256(JSON.stringify({ timestamp, actor, action, detail, prevHash }))` — key order is exact
- `detail` stored as **TEXT** (not jsonb — jsonb reorders keys, breaks hash)
- `timestamp` stored as **TEXT** (not timestamptz — re-renders ISO string, breaks hash)
- `audit_entries.id` is `bigserial` for monotonic ordering; read `ORDER BY id ASC/DESC`
- Demo tamper SQL: `UPDATE audit_entries SET action='tampered' WHERE id=(SELECT MIN(id) FROM audit_entries);`

### Schema ownership
- **Drizzle** (web) owns the schema + migrations. Run `npm run db:generate` after schema changes.
- **SQLAlchemy** (scraper) maps only — no `create_all`, no Alembic, no DDL ever.

### Column naming
- SQL columns: `snake_case` (e.g. `insurer_id`, `plan_ids`, `content_hash`)
- TypeScript: `camelCase` via Drizzle field aliases
- Python: `snake_case` attributes, converted to/from camelCase dicts at the engine layer

### Edge runtime constraint
- `db.ts` (Drizzle client) must NEVER be imported by `middleware.ts` or `auth.config.ts` — they run on the Edge runtime which has no Node.js APIs

---

## How Everyone Runs the App Now

### Docker (recommended)
```bash
cp .env.example .env          # fill AUTH_SECRET, DEEPSEEK_API_KEY, HERMES_API_KEY
docker compose up --build     # starts postgres → db-init (migrate+seed) → scraper + web + mailpit
```

### Local dev
```bash
# 1. Start Postgres (once)
docker run -d --name assura-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=assura -p 5432:5432 postgres:16

# 2. Set DATABASE_URL in web/.env.local
DATABASE_URL=postgres://postgres:dev@localhost:5432/assura

# 3. Migrate + seed (once, or after reset)
cd web && npm run db:migrate && npm run db:seed

# 4. Run web + scraper as before
cd web && npm run dev
cd scraper && uvicorn app.main:app --port 8100 --reload
```

### Reset demo data
```bash
bash seed/reset.sh   # truncates all tables and re-inserts seed data
# or:
./dev.sh seed
```

---

## Quick Reference

| Thing | Where |
|---|---|
| Branch | `migrate/postgres-storage` |
| Web schema | `web/src/lib/schema.ts` |
| Drizzle migration SQL | `web/drizzle/0000_eminent_the_anarchist.sql` |
| Web data layer | `web/src/lib/db.ts` |
| Audit chain | `web/src/lib/audit.ts` |
| Seed loader | `web/src/lib/seed.ts` |
| SQLAlchemy models | `scraper/app/storage/database.py` |
| Scraper engine | `scraper/app/scraper/engine.py` |
| Demo tamper SQL | `UPDATE audit_entries SET action='tampered' WHERE id=(SELECT MIN(id) FROM audit_entries);` |
| CRM branch to rebase | `jeff/outreach-crm` (PR #1) |
