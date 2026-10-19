# Handoff: PostgreSQL Storage Migration → Marcus

**From:** Jeff (via Kiro) · **Date:** 2026-10-19 · **For:** Marcus (continuing with Claude)

You're picking up the JSON → PostgreSQL storage migration. This doc tells you exactly where
it stands, what's trustworthy, what isn't, and how to finish it.

---

## TL;DR

- Branch: **`migrate/postgres-storage`** (pushed to `origin`). Base: `main` @ `c308127`.
- There is **one WIP commit** on it: `427c1e7` — **UNVERIFIED**. It was never built or tested.
  Treat the code as a draft, the design as solid.
- The **design is done and high quality** — read these first, they're the real asset:
  - `.agents/tasks/investigation.md` (full call-site map + the audit-chain gotcha)
  - `.agents/tasks/task-postgres-storage-migration/features/FEAT-001.json` (web + schema + infra)
  - `.agents/tasks/task-postgres-storage-migration/features/FEAT-002.json` (scraper SQLAlchemy)
- **FEAT-001 (web) is partially coded, unverified. FEAT-002 (scraper) is NOT started.**
- Decisions locked (don't relitigate): **PostgreSQL**, **Drizzle** (web, owns schema+migrations),
  **SQLAlchemy 2.0** (scraper, maps only — no DDL), one shared DB via `DATABASE_URL`.

---

## How to get it

```bash
git fetch origin
git checkout migrate/postgres-storage      # or: git worktree add ../assura-sql migrate/postgres-storage
cd web && npm install                       # drizzle deps are in package.json already
```

> Note: a Kiro worktree exists locally at `.worktrees/sql-migration`. You don't need it — just
> check out the branch. If you keep working in a worktree, make your own; don't rely on that one.

---

## What's in the WIP commit `427c1e7` (status of each file)

**New files (FEAT-001, drafted, UNVERIFIED):**
- `web/src/lib/schema.ts` — Drizzle table definitions (the intended source of truth)
- `web/drizzle.config.ts`, `web/drizzle/0000_*.sql` + `meta/` — generated migration
- `web/src/lib/migrate.ts`, `web/src/lib/seed.ts` — migrate + seed scripts
- `web/jest.config.js` — jest config (the repo had none; README claimed `npm test` worked)

**Modified (FEAT-001, drafted, UNVERIFIED):**
- `web/src/lib/db.ts` — being replaced with a Drizzle async data layer
- `web/src/lib/audit.ts` — being rewritten to DB-backed hash chain (**see audit warning below**)
- `web/src/lib/auth.ts`, `web/src/lib/mail.ts` — storage reads → async DB
- all routes under `web/src/app/api/**` — `readJSON/writeJSON` → `await` DB calls
- `web/src/__tests__/{audit,setup}.ts` — being reworked to a DB-backed harness
- `web/package.json` / `package-lock.json` — drizzle-orm, pg driver, drizzle-kit, scripts added

> `blocker.ts` / `policy.ts` showing as modified are incidental (formatting / no storage logic) —
> diff them; they should NOT have behavioral changes. Revert if they do.

**Why unverified:** I stopped the run mid-FEAT-001 for the handoff. `npm run build`, `npm test`,
and a real Postgres run were **never executed** on this code. Assume nothing compiles until you
prove it. Start by running the FEAT-001 verification commands below and fixing what breaks.

---

## ⚠️ The #1 risk — the audit hash chain (security = 30% of the score)

`web/src/lib/audit.ts` is a tamper-evident SHA-256 chain. The "Verify chain ✓/✗" button is a
graded demo moment. It breaks silently if serialization changes. Non-negotiable rules
(full detail in `investigation.md` §4 and FEAT-001 step 3 & 5):

1. The hash is `sha256(JSON.stringify(partial))` where `partial` keys are in **exactly** this
   order: `timestamp, actor, action, detail, prevHash` (no `hash` field). Build the object
   literal explicitly in that order — **never** from a `SELECT *` row map (column order ≠ key order).
2. **Do NOT store `detail` as `jsonb`** and **do NOT store `timestamp` as `timestamptz`.** jsonb
   reorders keys / renormalizes numbers+whitespace; timestamptz re-renders the ISO string. Either
   breaks the hash. Store `detail` as **`text`** (the exact serialized JSON string you hashed) and
   `timestamp` as **`text`** (the exact ISO string). The WIP schema intends this — verify it did it.
3. `audit_entries` needs a monotonic `bigserial id`; `logEvent` reads last by `ORDER BY id DESC`,
   `verifyChain` reads all `ORDER BY id ASC`.
4. `logEvent`/`verifyChain` become **async** — every caller needs `await` (onboarding, mail.sendEmail,
   quote route). Keep the `VerifyChainResult` shape `{ valid, entries, brokenAt? }` identical.
5. **Demo requirement:** you must be able to tamper a row (e.g. `UPDATE audit_entries SET action=...`)
   and have `verifyChain` return `valid:false`. Document the exact tamper SQL for the demo.

The rewritten `audit.test.ts` must prove: clean 3-entry chain → valid; tampered row → `valid:false`,
`brokenAt:0`; empty → `valid:true, entries:0`.

---

## Finish FEAT-001 (web) — order of work

Follow `FEAT-001.json` steps/acceptance criteria. Then verify (all must pass):

```bash
cd web
npm install
npm run build        # must exit 0 (2 PRE-EXISTING lint errors in (public)/page.tsx and
npm run lint         #   hooks/use-plans.ts are NOT ours — leave them, don't let build fail)
npm test             # DB-backed audit test must pass (see rules above)
# apply migrations + seed against a throwaway Postgres and confirm tables + row counts:
npm run db:migrate && npm run db:seed   # (script names per package.json — confirm)
```

Stand up a real Postgres to verify (the demo depends on it actually working):
```bash
docker run --rm -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=assura -p 5432:5432 postgres:16
export DATABASE_URL=postgres://postgres:dev@localhost:5432/assura
```
Confirm seed loads **with string ids intact** (`aia`, `user_demo`, `aia_ci_power` — NOT serials)
and the 5 insurers / demo user / plans / sources are present.

**FEAT-001 acceptance (summary — see JSON for full list):** build+lint+test green; migration
applies to an empty DB; seed loads with text PKs; no source file still calls the old fs-based
`readJSON/writeJSON/appendJSONL/readJSONL`; `docker-compose.yml` has a `postgres` service +
`DATABASE_URL` for web & scraper, and the `init-data` JSON-copy is replaced by a migrate+seed step.

---

## FEAT-002 (scraper) — NOT started, do after FEAT-001

Full spec in `FEAT-002.json`. It depends on FEAT-001's final schema (SQLAlchemy maps to the
Drizzle-created tables — **no `create_all`, no Alembic**). Three call sites to convert, all found
and listed in `investigation.md` §3:
- `scraper/app/scraper/engine.py` — sources/plans read+write, scraper_runs append. Preserve the
  **"a failed scrape never deletes last good data"** invariant (only persist when `changed>0`).
- `scraper/app/personas/simulator.py` — threads/insurers read, append inbound message, update status/riskFlags.
- `scraper/app/routers/scraper.py` — latest `ScraperRun` for `/scraper/status`.
- `scraper/app/storage/jsonl_append.py` — unused audit mirror; **recommend delete** (web is the
  sole audit writer). `json_store.py` → remove if unreferenced after the refactor.
- Keep `data/versions/<sourceId>/*.html` snapshots on the **filesystem** (not DB).

Verify: `./dev.sh lint` (ruff) and `./dev.sh test` (pytest) green against a seeded throwaway Postgres.

---

## Infra / seed / env (part of FEAT-001)

- `docker-compose.yml`: add `postgres` (healthcheck, named volume); add `DATABASE_URL` to `web`
  and `scraper`; replace `init-data` with a migrate+seed one-shot the apps `depends_on`.
  **Leave the scraper LLM config alone** (`HERMES_API_KEY`, Anthropic `LLM_MODEL`, Mailpit,
  `WEB_BASE_URL`, `SCRAPER_URL`) — out of scope here.
- `seed/reset.sh`: rewrite so `./dev.sh seed` resets the **DB** to seed state (keep the
  `./dev.sh seed|test|up` command surface working).
- Add `DATABASE_URL` to `.env.example`, `web/.env.local.example`, `scraper/.env.example`.
  Do NOT commit a real `.env`.

---

## Watch out for (pre-existing quirks, not yours to fix)

- The DB client must be **Node-runtime only** — never import it into `middleware.ts` or
  `auth.config.ts` (edge). Same constraint that kept `DATA_DIR` out of `constants.ts`.
- Scraper schemas are **snake_case** (Pydantic) while TS types + seed JSON are **camelCase**;
  the engine reads raw camelCase dicts (`source["planIds"]`). Pin one column convention
  (design recommends snake_case columns + Drizzle aliases) and refactor the 3 scraper call sites.
- 2 pre-existing lint errors on `main` in `(public)/page.tsx` + `hooks/use-plans.ts` — Dominic's, leave them.

---

## When you're done

1. Commit on `migrate/postgres-storage`, append a `TASK.MD` entry per the CLAUDE.md protocol,
   rebase onto latest `main`, then ff-merge + push `main` (the team is waiting on this).
2. In your `TASK.MD` "Others need to know": everyone must now run Postgres (`docker compose up`
   includes it) and set `DATABASE_URL`; how to reset demo data (new `seed/reset.sh`); the audit
   tamper SQL for the demo.
3. **Heads up:** the separate **`jeff/outreach-crm`** branch (Outreach/CRM UI + DeepSeek AI port,
   PR #1) is built on the OLD JSON storage and is **NOT yet merged**. It must be **rebased onto
   this migration** afterward — its `api/crm/*` and `api/outreach/*` routes will need rewiring to
   the Drizzle data layer. Coordinate with Jeff before/after you merge so that branch gets rebased.

---

## Quick reference

| Thing | Where |
|---|---|
| Branch | `migrate/postgres-storage` (origin) |
| WIP commit (unverified) | `427c1e7` |
| Design / call-site map | `.agents/tasks/investigation.md` |
| Web feature spec | `.agents/tasks/task-postgres-storage-migration/features/FEAT-001.json` |
| Scraper feature spec | `.agents/tasks/task-postgres-storage-migration/features/FEAT-002.json` |
| CRM branch to rebase later | `jeff/outreach-crm` (PR #1) |
