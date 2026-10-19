# PostgreSQL Storage Migration — Investigation Report

Worktree: `/Users/leeguanfeng/Documents/Github/Assura/.worktrees/sql-migration`
Task: Migrate the storage layer from local JSON/JSONL files to a single shared PostgreSQL
database across the TypeScript web app (Drizzle ORM + drizzle-kit) and the Python scraper
(SQLAlchemy 2.0), plus Docker/seed infra.

Decisions already made (not relitigated): one Postgres DB, one shared schema used by both
services; schema defined once as source of truth; **Drizzle owns migrations**, SQLAlchemy only
MAPS to Drizzle-created tables; connection via `DATABASE_URL`.

---

## 1. Project facts discovered during exploration

- Monorepo: `web/` (Next.js 16, App Router, TypeScript) + `scraper/` (Python FastAPI).
- Web package manager: **npm** (`web/package-lock.json` present; Dockerfile uses `npm ci`).
  No Drizzle present yet — `drizzle-orm` / `drizzle-kit` must be added.
- Web tests: **Jest + ts-jest** (`web/src/__tests__/`, run with `cd web && npm test`).
  Note: `web/package.json` has no `test` script yet — only `dev`/`build`/`lint`. README says
  `npm test`; a `test` script must be added (Jest config is implied by ts-jest; confirm during impl).
- Scraper deps: pydantic 2.7+, pydantic-settings, FastAPI, httpx, apscheduler, etc.
  No SQLAlchemy / psycopg present — must be added to `scraper/requirements.txt`.
- Scraper tests: **pytest** (`./dev.sh test`), lint via ruff (`./dev.sh lint`).
- Data dir resolution:
  - Web: `DATA_DIR = process.env.DATA_DIR_OVERRIDE ?? path.resolve(process.cwd(), "../data")` (`web/src/lib/db.ts`).
  - Scraper: `settings.data_dir` = env `DATA_DIR` or `<repo>/data` (`scraper/app/config.py`).
- `./dev.sh` is the dev CLI; `seed/reset.sh` seeds `./data`; `docker-compose.yml` has an
  `init-data` service that copies seed JSON into the `./data` bind mount before web/scraper start.

### Build / test commands (real, from docs & manifests)
- Web build: `cd web && npm run build`  (Next.js build)
- Web lint: `cd web && npm run lint`
- Web unit tests: `cd web && npm test` (Jest; **test script must be added**)
- Scraper tests: `./dev.sh test` → pytest (16 tests)
- Scraper lint: `./dev.sh lint` → ruff
- Full stack: `./dev.sh up` (Docker)

---

## 2. Web storage surface (chokepoint + verified call sites)

### Chokepoint: `web/src/lib/db.ts`
Five exported functions, all synchronous `fs`-based:
- `readJSON<T>(filename)` — read+parse a JSON file.
- `writeJSON<T>(filename, data)` — atomic write (temp file + `fs.renameSync`).
- `appendJSONL(filename, entry)` — append one JSON line.
- `readJSONL<T>(filename)` — read all non-empty lines, parse each.
- `dataFileExists(filename)` — `fs.existsSync`.

**Migration implication:** these are synchronous. Postgres drivers (`pg`/`postgres`) and Drizzle
queries are **async**. Every call site is in an API route handler or a lib function that is
already `async` or can be made `async`, so converting the data layer to async functions (or
replacing `db.ts` with Drizzle query helpers) requires `await` at each call site. `lib/auth.ts`'s
`authorize()` is already `async`. `lib/mail.ts` helpers are already `async`. The audit `logEvent`
is currently sync and called synchronously in several routes — see §4.

### Verified web call-site list (grep-confirmed, complete)
Grep of `readJSON|writeJSON|appendJSONL|readJSONL|dataFileExists` across `web/src` confirms the
prompt's list is complete and adds no surprises. Files touching storage:

| File | Functions used | Files/tables touched |
|---|---|---|
| `src/lib/db.ts` | (definitions) | — |
| `src/lib/audit.ts` | `appendJSONL`, `readJSONL` | `audit.jsonl` |
| `src/lib/auth.ts` | `readJSON` | `users.json` (login lookup; `authorize` is async) |
| `src/lib/mail.ts` | `readJSON` (x2) | `threads.json` (daily-limit count, follow-up cooldown) |
| `src/app/api/onboarding/route.ts` | `readJSON`, `writeJSON` | `users.json` (findIndex, update consent/onboarded/maskedInbox) |
| `src/app/api/outreach/send/route.ts` | `readJSON` (insurers, users, threads), `writeJSON` | create/append thread + message |
| `src/app/api/outreach/draft/route.ts` | `readJSON` (insurers, users) | read-only |
| `src/app/api/plans/route.ts` | `readJSON` | `plans.json` read + filter/sort |
| `src/app/api/insurers/route.ts` | `readJSON` | `insurers.json` read |
| `src/app/api/chat/route.ts` | `readJSON` | `plans.json` read (for citations) |
| `src/app/api/crm/threads/route.ts` | `readJSON` | `threads.json` filter by user/status, sort by updatedAt |
| `src/app/api/crm/threads/[threadId]/route.ts` | `readJSON` (x2), `writeJSON` | get one + update (status/close) |
| `src/app/api/crm/threads/[threadId]/quote/route.ts` | `readJSON`, `writeJSON` | set `extractedQuote`, status `info_received` |
| `src/app/api/scraper/status/route.ts` | `readJSONL` | `scraper_runs.jsonl` fallback read |

Dynamic-route params are `Promise<{...}>` and already `await`ed (Next 16 convention per CLAUDE.md).
`DATA_DIR` must stay out of `constants.ts` (edge-runtime constraint) — the DB client must likewise
not be imported into edge code (`auth.config.ts`/middleware). `auth.ts` is Node-runtime only and is
the correct place for the DB-backed user lookup.

---

## 3. Scraper storage surface (grep-confirmed, complete)

### Storage modules
- `scraper/app/storage/json_store.py` — `read_json`, `write_json` (atomic temp+`os.replace`),
  `read_jsonl`, `append_jsonl`. Path-based (`Path` args).
- `scraper/app/storage/jsonl_append.py` — `compute_sha256`, `append_audit_event`, `verify_chain`,
  `_now_iso`. **This module has NO callers anywhere in `scraper/app`** (grep confirms). It is the
  Python mirror of the audit hash chain (see §4). It is dead code today but part of the storage
  surface; the migration must decide whether to port or drop it (recommend: drop the file writer,
  keep the hashing contract documented — web owns audit writes).

### Verified scraper call sites (every caller of json_store)
Grep of `json_store|read_json|write_json|append_jsonl|read_jsonl` across `scraper/app`:

| File | Functions | Files/tables touched |
|---|---|---|
| `app/personas/simulator.py` | `read_json` (threads, insurers), `write_json` (threads) | reads threads+insurers, appends inbound message, updates status/riskFlags/updatedAt |
| `app/routers/scraper.py` | `read_jsonl` | `scraper_runs.jsonl` (status endpoint, last run) |
| `app/scraper/engine.py` | `read_json` (sources, plans), `write_json` (plans, sources), `append_jsonl` (runs) | full scrape pipeline persistence |

Indirect callers (reach storage transitively):
- `app/routers/email.py` → `simulate_reply` (writes threads) and `send_email`.
- `app/main.py` lifespan cron → `run_scraper` (writes plans/sources/runs).

`engine.py` also writes **versioned HTML snapshots** to `data/versions/<sourceId>/<ts>.html`
(`_save_versioned`). This is a filesystem artifact, NOT JSON storage. Decision needed: keep on disk
(simplest, out of DB scope) or move to DB. Recommend keep on disk — it is binary page archive, not
relational data, and `init-data`/`reset.sh` already create `data/versions`.

### Scraper schemas (`scraper/app/schemas/*.py`) — snake_case Pydantic models
- `plan.py` `Plan` + `PremiumsByProfile` (note: only the 4 fixed premium keys; no extra-key map,
  unlike the TS `[key: string]` index).
- `insurer.py` `Insurer` (`agent_email`).
- `source.py` `Source` (`plan_ids`, `content_hash`, etc.).
- `scraper_run.py` `ScraperRun` + `ScraperError` (`run_id`, `sources_checked`, ...).
- `email_message.py` `EmailMessage`.
These are **snake_case** while the JSON on disk and TS types are **camelCase** (e.g. engine reads
`source["planIds"]`, `source["id"]` — raw dict access, NOT via the Pydantic models). The Pydantic
schema field names do NOT currently round-trip the camelCase JSON; the code uses plain dicts. The
SQLAlchemy models will map to the shared (Drizzle-defined) columns and must agree on a single
column naming convention — recommend **snake_case columns** with Drizzle emitting snake_case and
the TS side mapping camelCase↔snake_case (Drizzle supports column name aliases).

---

## 4. Audit hash chain — the #1 risk (exact logic)

### TypeScript (`web/src/lib/audit.ts`) — the live writer
- `sha256(text)` = `crypto.createHash("sha256").update(text,"utf-8").digest("hex")`.
- `logEvent(actor, action, detail)`:
  1. read existing entries; `prevHash = last.hash` else `"0"`.
  2. build `partial` object with keys **in this exact order**: `timestamp, actor, action, detail, prevHash` (NO `hash` field).
  3. `hash = sha256(JSON.stringify(partial))`.
  4. append `{ ...partial, hash }` to `audit.jsonl`.
- `verifyChain()`: re-reads all entries in order; for each, checks `prevHash` linkage
  (`"0"` for index 0, else previous entry's `hash`), then strips `hash`, recomputes
  `sha256(JSON.stringify(partial))`, compares. Returns `{ valid, entries, brokenAt? }`.

### Python (`scraper/app/storage/jsonl_append.py`) — mirror, currently unused
- Same field order; hashes `json.dumps(partial, separators=(",", ":"))` (compact, no spaces).
- `JSON.stringify` with no replacer/space produces the **same** compact form, so TS and Python
  serializations are byte-identical **provided key order and value formatting match**.

### Where fidelity is at risk (must be preserved exactly)
1. **Key order in the hashed object must remain `timestamp, actor, action, detail, prevHash`.**
   An ORM/row that reconstructs the object (e.g. `SELECT *` into a struct) can reorder keys →
   `JSON.stringify` output changes → every hash past that point fails `verifyChain`. The hashing
   MUST build the object literal explicitly in that order, never from a column-ordered row map.
2. **`detail` serialization fidelity.** `detail` is `Record<string, unknown>` (arbitrary nested
   JSON). It must be stored as `jsonb`/`json` and serialized back with the SAME key order and the
   SAME numeric/string formatting that `JSON.stringify` produced when the hash was computed.
   Postgres `jsonb` does NOT preserve key order or whitespace and may re-normalize numbers →
   **storing `detail` as `jsonb` will break the chain.** Recommended mitigation: store the exact
   serialized string used for hashing (store `hash` AND either the canonical `detail` JSON text or
   the full `partial` JSON text) so `verifyChain` recomputes over the stored text, OR store `detail`
   as `text` (raw JSON string) rather than `jsonb`. The investigation flags this as the single
   highest-risk decision; the design/plan must pin it down. (See open items §7.)
3. **`timestamp` precision.** Stored as ISO 8601 string with millisecond precision (`new Date().toISOString()`,
   e.g. `2026-10-01T00:00:00.000Z`). If stored as a Postgres `timestamptz` and re-rendered, the
   millisecond/`Z` formatting can change → hash break. Store `timestamp` as `text` (the exact ISO
   string), not a timestamp column, for audit entries.
4. **Append-only ordering.** `verifyChain` depends on reading entries in insertion order. The audit
   table needs a monotonic ordering column (serial/bigserial `id`) and queries must `ORDER BY` it.

### Audit test harness risk
- `web/src/__tests__/audit.test.ts` writes/reads `audit.jsonl` on disk directly (tamper test edits
  the file). `web/src/__tests__/setup.ts` copies seed JSON into a temp `DATA_DIR_OVERRIDE`.
  After migration these tests break: they must be rewritten to seed a **test database** and to
  "tamper" by mutating a DB row instead of a file line, while asserting the SAME
  `verifyChain` semantics (`valid`, `entries`, `brokenAt`). This is required work, not optional.

---

## 5. Entities and fields (schema source of truth)

From `web/src/lib/types.ts` (camelCase, authoritative) cross-checked with scraper Pydantic
(snake_case) and seed JSON. Tables to define in Drizzle (shared schema):

- **users** — `id, email, passwordHash, name, tier('free'|'premium'), maskedInbox, onboarded,
  consent(embedded ConsentFlags: 8 booleans — shareAge, shareGender, shareSmokerStatus,
  shareCoverageNeeds, shareBudgetRange, shareOccupation, shareHealthHistory, shareIncome),
  createdAt(ISO)`. Decision: embed `consent` as `jsonb`/8 columns — recommend 8 boolean columns
  (simple, queryable, matches flat seed). `createdAt` as `timestamptz` is fine (not hashed).
- **insurers** — `id, name, agentEmail, logo, persona(helpful|slow|pushy|data_grabber|injector), website`.
- **plans** — `id, insurerId(FK), insurerName, planName, category, coverageAmount, premiums
  (PremiumsByProfile — TS allows arbitrary extra numeric keys via index signature; Pydantic fixes 4),
  premiumFrequency, coverageTerms(string[]), illnessesCovered, earlyStageConditions, payoutType,
  keyBenefits(string[]), exclusions(string[]), sourceUrl, dataAsOf(YYYY-MM-DD), updatedBadge,
  changeNotes(string[]), version, scrapedAt(ISO)`. Arrays → `jsonb` or `text[]`; `premiums` → `jsonb`
  (preserve the open-ended profile keys from the TS index signature).
- **sources** — `id, insurerId(FK), label, url, type(product_page|pdf|mock), planIds(string[]),
  etag(nullable), lastModified(nullable), contentHash(nullable), lastChecked, lastChanged,
  status(pending|ok|changed|error|skipped)`.
- **threads** — `id, userId(FK), insurerId(FK), insurerName, subject, status(7 states),
  messages(ThreadMessage[]), extractedQuote(ExtractedQuote|null), riskFlags(string[]),
  addedToComparison, createdAt, updatedAt`.
  - **ThreadMessage**: `id, direction(outbound|inbound), from, to, subject, body, timestamp,
    aiGenerated, flagged, flagReason?`. Decision: child table `thread_messages` (FK threadId,
    ordered) is cleaner than embedded `jsonb`, because `mail.ts` and `simulator.py` append/scan
    messages and compute "last outbound" by timestamp. Recommend **child table**.
  - **extractedQuote**: `annualPremium?, coverageAmount?, waitingPeriod?, exclusionsNoted?[],
    riderOptions?[], validUntil?, rawNotes?, extractedAt`. Embed as `jsonb` on threads (nullable)
    or a 1:1 table — recommend `jsonb` (read/written as a unit).
- **audit entries** (`audit.jsonl`) — `timestamp(text ISO), actor, action, detail, prevHash, hash`
  + monotonic `id` for ordering. See §4 for storage constraints (do NOT use jsonb for `detail`
  unless the exact hashed text is also persisted).
- **scraper_runs** (`scraper_runs.jsonl`) — `runId, trigger(cron|manual), startedAt, finishedAt,
  sourcesChecked, sourcesChanged, errors(Array<{sourceId,message}>)`. `errors` → `jsonb`.

Reference integrity: `plans.insurerId`, `sources.insurerId`, `threads.userId/insurerId` are FKs.
Current seed uses string ids (`aia`, `user_demo`, `aia_ci_power`) — keep text PKs, not serial.

---

## 6. Infra & seed surface

- **`docker-compose.yml`**: `init-data` service copies `seed/*.json` → `./data` and touches the
  two `.jsonl` files + `versions/` dir. This JSON-copy init must be replaced by a Postgres service
  + a DB seed step (run Drizzle migrations, then load seed rows). A new `postgres` service and a
  `DATABASE_URL` must be added to both `web` and `scraper` service env. **Leave the scraper LLM
  config alone** — `HERMES_API_KEY`, `LLM_MODEL` (Anthropic), `MAILPIT_*`, `WEB_BASE_URL` stay.
  `web` and `scraper` `depends_on` must wait for Postgres healthy + migrations applied (replace the
  `init-data: service_completed_successfully` dependency with the migrate/seed step).
- **`seed/`**: `insurers.json` (5), `users.json` (1 demo, bcrypt hash), `plans.json` (~10-15),
  `sources.json` (5, one `mock` type → localhost mock brochure), `threads.json` (`[]` empty),
  plus the two empty `.jsonl` logs created at runtime. These become the seed dataset for the DB.
- **`seed/reset.sh`**: currently copies JSON into `./data` and truncates `.jsonl`. Must be rewritten
  (or supplemented) to reset the database to seed state (truncate tables + re-insert seed rows, or
  drop/recreate schema via drizzle + seed). `./dev.sh seed` and `./dev.sh test` invoke this path —
  keep the command surface stable.
- **`.env` / `.env.example`**: add `DATABASE_URL`. Root `.env.example` currently lists
  `AUTH_SECRET` and `DEEPSEEK_API_KEY` (note: docker-compose references `HERMES_API_KEY` and an
  Anthropic `LLM_MODEL` — pre-existing inconsistency, out of scope). `web/.env.local.example` and
  `scraper/.env.example` both need `DATABASE_URL` added.
- **`data/versions/<sourceId>/*.html`**: binary page snapshots from the scraper — recommend keep on
  filesystem (not DB).
- **Dockerfiles**: web uses `npm ci` (so `package-lock.json` must be updated when drizzle deps are
  added); scraper installs `requirements.txt` (add SQLAlchemy + driver). A migration step must run
  before the app serves traffic (new compose service or entrypoint).

---

## 7. Key risks & open decisions for the design/plan step

1. **Audit chain integrity (highest).** `detail` and `timestamp` must serialize byte-identically to
   the original `JSON.stringify(partial)` with key order `timestamp,actor,action,detail,prevHash`.
   Do NOT round-trip `detail` through `jsonb`. Safest: store the exact serialized JSON text used for
   hashing (or store `detail` as `text`), and keep a monotonic ordering id. Both web (Drizzle) and
   the unused Python mirror must agree (web should remain the sole audit writer).
2. **Sync→async conversion.** `db.ts` is synchronous; Drizzle is async. Every call site becomes
   `await`; `audit.logEvent` becomes async, affecting routes that call it inline (`onboarding`,
   `mail.sendEmail`, `quote`). Confirm all callers are async-capable (they are — all in route
   handlers / async libs).
3. **Shared schema ownership.** Drizzle defines & migrates; SQLAlchemy maps to existing tables only
   (no `create_all`, no Alembic). Column naming must be pinned (recommend snake_case columns with
   Drizzle aliases to camelCase TS fields; SQLAlchemy maps 1:1).
4. **camelCase vs snake_case mismatch.** Scraper engine reads raw camelCase dicts (`source["planIds"]`)
   while Pydantic schemas are snake_case; the SQLAlchemy layer must expose whatever the engine/persona
   code consumes (or those call sites get refactored to the ORM). Pick one convention and refactor
   the three scraper call sites (`engine.py`, `simulator.py`, `routers/scraper.py`) accordingly.
5. **Test harnesses must be rewritten.** `web/src/__tests__/setup.ts` (seed-copy to temp dir) and
   `audit.test.ts` (file tamper) assume filesystem storage. Need DB-backed test setup (e.g. a test
   Postgres, transaction rollback, or pg-mem) preserving identical `verifyChain` assertions. Scraper
   pytest suite (16 tests) likely touches storage too — must be checked and updated.
6. **Add a `test` npm script** to `web/package.json` (README/CLAUDE claim `npm test` works but no
   script exists).
7. **Seed/reset & compose rework** must keep `./dev.sh seed|test|up` working and preserve the demo
   flow (demo login `demo@fineprint.local`, 5 insurers, mock brochure source).
8. **Versioned HTML snapshots** stay on disk (recommend); confirm in design.

---

## 8. Decomposition decision

This work decomposes cleanly into **two independent, parallelizable-by-design (executed
sequentially) feature tracks that share one contract** (the schema + `DATABASE_URL`):

1. **Shared schema + web migration (Drizzle):** define the single source-of-truth schema, add the
   Drizzle data layer, migrate `db.ts` + all web call sites, preserve the audit chain, rewrite web
   tests, and update infra/seed/compose. This track establishes the tables that track 2 maps to.
2. **Scraper migration (SQLAlchemy):** map SQLAlchemy models to the Drizzle-created tables (no DDL),
   refactor the three scraper storage call sites + the unused audit mirror, update scraper deps/tests.

Track 2 depends on track 1 (tables must exist first), so they are ordered, not concurrent. This maps
to a FEAT decomposition (FEAT-001 web+schema+infra, FEAT-002 scraper), authored alongside this report.

---

## Appendix: files read during investigation

Docs: `PROJECT.MD`, `README.md`, `CLAUDE.md`. Web: `lib/db.ts`, `lib/types.ts`, `lib/audit.ts`,
`lib/auth.ts`, `lib/mail.ts`, all 10 API routes under `app/api/**`, `__tests__/{audit,setup}.ts`,
`package.json`, `Dockerfile`, `.env.local.example`. Scraper: `storage/{json_store,jsonl_append}.py`,
`schemas/*.py`, `scraper/engine.py`, `personas/simulator.py`, `routers/{scraper,email}.py`,
`config.py`, `main.py`, `requirements.txt`, `Dockerfile`. Infra/seed: `docker-compose.yml`,
`seed/*.json`, `seed/reset.sh`, root `.env.example`. Grep verified web + scraper call sites.
