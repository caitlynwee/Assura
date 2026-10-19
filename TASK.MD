## 2026-10-19 | Marcus | Initial Project Scaffold
Status: Completed
Done:
- Created full monorepo scaffold: /web (Next.js 16), /scraper (Python FastAPI), /data, /seed
- Wrote PROJECT.MD, README.md, .gitignore, CLAUDE.md
- Seeded 13 critical illness plans (5 insurers), 5 insurer personas, demo user (demo@fineprint.local / demo1234)
- All Next.js pages route and compile (compare, chat, onboarding, outreach, crm, crm/[threadId], activity)
- Implemented: auth (NextAuth v5 split config), policy engine (4 tiers), PII blocker, audit hash-chain, quarantine reader, AI helpers (chat/draft/extract), Mailpit mailer, Zod validators, all API route stubs
- Created component skeletons: layout (sidebar/topbar/navbar/footer), compare (plan-table/plan-filters), chat (chat-window), crm (thread-list/thread-card), activity (audit-event-list/verify-chain-button)
- Created hooks: use-plans, use-threads, use-thread, use-chat, use-audit-log
- Created test stubs: policy.test.ts, blocker.test.ts, audit.test.ts
- Python scraper: full directory + skeleton for engine, change_detector, downloader, extractor, converter, validator, email_relay, 5 persona modules, schemas, storage, mock brochure
- seed/reset.sh works: copies seed/*.json → data/, resets .jsonl files
Files:
- web/src/lib/{types,constants,auth.config,auth,db,policy,blocker,audit,quarantine,ai,mail,validators,utils}.ts
- web/src/app/(app)/{layout,compare,chat,onboarding,outreach,crm,crm/[threadId],activity}/page.tsx
- web/src/app/api/{auth,plans,chat,outreach,crm,audit,insurers,scraper,onboarding}/route.ts
- web/src/components/{layout,ui,compare,chat,crm,activity}/*
- web/src/hooks/use-*.ts, web/src/__tests__/*
- scraper/app/{main,config,routers,scraper,email_relay,personas,schemas,storage,utils}/*
- seed/{users,plans,insurers,sources,threads}.json, seed/reset.sh
Others need to know:
- Edge runtime constraint: DATA_DIR is in db.ts ONLY — never import db.ts from constants.ts or any file used by middleware
- auth.config.ts = edge-safe (middleware); auth.ts = Node.js full (API routes + server components)
- All (app) pages MUST export `export const dynamic = "force-dynamic"`
- Next.js 16 dynamic route params are Promise<{...}> — always await params
- next.config.ts has cacheComponents removed (conflicts with dynamic export)
- API routes are functional stubs — they return correct shapes but business logic needs wiring (Dominic/Jeff)
- Outreach and onboarding pages are placeholder divs — components needed (Dominic/Jeff)
Blockers: None
---

## 2026-10-19 | Jeff | Storage migration (JSON → PostgreSQL) — handed off to Marcus
Status: In Progress (handed off)
Done:
- Scoped + designed the full JSON → PostgreSQL migration (Drizzle for web, SQLAlchemy 2.0 for scraper, one shared DB via DATABASE_URL). Design is complete; implementation is partial and UNVERIFIED.
- Branch `migrate/postgres-storage` pushed to origin. One WIP commit (427c1e7) = started FEAT-001 (Drizzle schema, generated migration, seed/migrate scripts, started db.ts + route/audit rewrites). NOT built, NOT tested. FEAT-002 (scraper) not started.
- Full handoff written: see `HANDOFF-postgres-migration.md` at repo root. Design + call-site map in `.agents/tasks/investigation.md` and FEAT-001/FEAT-002 specs (on the branch).
Files:
- HANDOFF-postgres-migration.md (read this first), branch migrate/postgres-storage, .gitignore (added .worktrees/)
Others need to know:
- MARCUS is continuing this. Start at HANDOFF-postgres-migration.md.
- Decisions locked: PostgreSQL + Drizzle (web, owns schema/migrations) + SQLAlchemy 2.0 (scraper, maps only, no DDL). Do not relitigate.
- #1 risk = audit hash chain: store `detail` and `timestamp` as TEXT (not jsonb/timestamptz) or "Verify chain" breaks. Details in the handoff.
- Once this lands on main, everyone must run Postgres (docker compose will include it) + set DATABASE_URL; demo-data reset moves from JSON copy to a DB reset in seed/reset.sh.
- Separate branch `jeff/outreach-crm` (Outreach/CRM UI + DeepSeek AI port, PR #1) is built on the OLD JSON storage and still needs rebasing onto this migration afterward — its api/crm/* and api/outreach/* routes rewire to the Drizzle layer. Coordinate with Jeff.
Blockers: Migration implementation is unverified WIP — Marcus to finish + verify (build/test/real Postgres) before merging to main.
---

## 2026-10-19 | Jeff | DevOps: CI, PR template, CODEOWNERS, pre-commit (uv)
Status: Completed
Done:
- Added GitHub Actions CI (.github/workflows/ci.yml): web (npm ci → lint → build → optional jest) + scraper (uv install → ruff → pytest), both with a Postgres 16 service container for the incoming migration. Web lint is non-blocking for now (2 pre-existing errors on main); build must pass.
- Added .github/pull_request_template.md (mirrors the CLAUDE.md pre-commit checklist + security-impact prompt).
- Added .github/CODEOWNERS mapping the 4 team lanes to paths (usernames are @placeholders except @caitlynwee — fill in real GitHub handles for @dominic/@marcus/@jeff).
- Added .pre-commit-config.yaml: ruff (scraper) + eslint (web, non-blocking) + hygiene hooks (trailing ws, EOF, merge-conflict, large-file, detect-private-key). Install with `uv tool install pre-commit && pre-commit install`
- Switched dev.sh to uv (uv venv + uv pip install, replacing python venv + pip). Added `./dev.sh ci` to run all checks locally. Fixed stale ANTHROPIC_API_KEY → DEEPSEEK_API_KEY in setup messages.
Files:
- .github/workflows/ci.yml, .github/pull_request_template.md, .github/CODEOWNERS, .pre-commit-config.yaml, dev.sh, TASK.MD
Others need to know:
- CI now runs on every push/PR to main — keep it green. `./dev.sh ci` mirrors it locally before pushing.
- `uv` is now required for scraper dev setup (install: `brew install uv` or the astral install script). `./dev.sh setup` will error if uv is missing.
- CODEOWNERS @dominic/@marcus/@jeff are placeholders — someone with repo admin should replace them with real GitHub usernames (and CODEOWNERS only auto-requests reviews once branch protection is enabled in GitHub settings).
- Two follow-ups once the Postgres migration + web `test` script land: (1) remove the `|| true` on web lint in ci.yml and .pre-commit-config.yaml to make lint blocking after the 2 pre-existing errors are fixed; (2) the jest step auto-activates when the `test` script exists.
Blockers: None
---

## 2026-10-20 | Marcus | PostgreSQL Storage Migration — FEAT-001 verified + FEAT-002 complete
Status: Completed
Done:
- Verified Jeff's WIP FEAT-001 commit (427c1e7): npm build ✓, npm test 12/12 ✓, lint ✓ (2 pre-existing errors only)
- Confirmed blocker.ts + policy.ts changes are correct async adaptations (void logEvent fire-and-forget), no behavioral change
- FEAT-001 infra gaps completed: added postgres:16 + db-init one-shot to docker-compose.yml; removed init-data JSON-copy service; added DATABASE_URL to web + scraper env
- Rewrote seed/reset.sh to reset DB (truncate + re-seed) instead of copying JSON files; added resetDatabase() + RESET=1 truncation path to seed.ts
- Added DATABASE_URL to .env.example, web/.env.local.example, scraper/.env.example; updated dev.sh with db:migrate + db:seed shortcuts
- FEAT-002 complete: created scraper/app/storage/database.py — SQLAlchemy 2.0 ORM models mapping to all Drizzle-created tables (no DDL, no Alembic)
- Refactored engine.py to use SQLAlchemy; expunge_all() safety net preserves "failed scrape never loses data" invariant
- Refactored simulator.py to use SQLAlchemy for Thread/Insurer/ThreadMessage; builds camelCase thread dict for persona.reply() compat
- Refactored routers/scraper.py to query ScraperRun table for /scraper/status
- Removed _save_versioned() + data_dir (HTML snapshots dropped — not part of demo flow)
- Deleted dead code: json_store.py, jsonl_append.py, test_hash_chain.py
- All 12 scraper tests pass; ruff lint clean
- Merged 6 commits from origin/main: resolved 8 conflicts; wired Dominic's auth flow (brute-force, audit events) to async DB calls; rewrote users.ts to use Drizzle; made onboarding.ts async
Files:
- docker-compose.yml, seed/reset.sh, web/src/lib/seed.ts, dev.sh
- .env.example, web/.env.local.example, scraper/.env.example
- scraper/app/storage/database.py (new — SQLAlchemy models)
- scraper/app/scraper/engine.py, scraper/app/personas/simulator.py, scraper/app/routers/scraper.py
- scraper/app/config.py (removed data_dir), scraper/requirements.txt (added sqlalchemy + psycopg2-binary)
- scraper/tests/conftest.py, scraper/tests/test_engine.py
- web/src/lib/auth.ts, web/src/lib/users.ts, web/src/lib/onboarding.ts
- web/src/app/api/onboarding/route.ts, web/src/app/_actions/auth.ts
- web/jest.config.js, web/src/__tests__/setup.ts
Others need to know:
- EVERYONE must now run Postgres — `docker compose up` starts it automatically
- Set DATABASE_URL=postgres://postgres:dev@localhost:5432/assura in .env (Docker) and web/.env.local (local dev)
- Reset demo data: `bash seed/reset.sh` or `./dev.sh seed` (resets DB, not JSON files — data/ folder no longer needed)
- Audit tamper SQL for demo: UPDATE audit_entries SET action='tampered' WHERE id=(SELECT MIN(id) FROM audit_entries);
- jeff/outreach-crm branch (PR #1) needs rebase onto this migration — its api/crm/* and api/outreach/* routes still use old readJSON/writeJSON which no longer exist
- Postgres verify (db:migrate + db:seed against real DB) pending — run when Docker is available on your machine
- users.ts profile field (UserProfile) has no DB column — not persisted yet; add a jsonb column if needed
Blockers: None
---

## 2026-10-19 | Dominic | Auth flow, onboarding, outreach UI, Free/Premium gating
Status: Completed (branch `feat/dominic-web-auth`)
Done:
- Auth: sign up (Free or Premium-demo), login, demo login, logout as Server Actions; brute-force lockout (5 fails/15 min); login/signup/logout/lockout events in audit chain; open-redirect-safe callbackUrl; JSON 401 for unauthenticated /api/*
- Gating: middleware sends Free users on /onboarding, /outreach, /crm, /activity to new /upgrade page (demo upgrade, no payment); sidebar shows 🔒; APIs still enforced by policy engine
- Onboarding: profile + consent form, health/income locked as Tier 3, live "insurers will see" preview, masked inbox reveal
- Outreach: insurer picker (max 5), template, consented details, AI drafts w/ template fallback when no API key, editable drafts, live PII preview, approval dialog, send, inline "Blocked by PII guard", links to CRM threads
- Rebrand Fineprint → Assura in UI; self-hosted Geist font (no Google Fonts call → works offline at venue)
- Verified with 23-step Playwright run against `next start` + fake SMTP; audit chain verifies
Files: web/src/app/_actions/*, web/src/app/(public)/{login,signup}, web/src/app/(app)/{layout,upgrade,onboarding,outreach}, web/src/app/auth/reset, web/src/components/{auth,brand,onboarding,outreach,layout}/*, web/src/lib/{auth,auth.config,users,session,onboarding,demo}.ts, web/src/middleware.ts, web/src/types/next-auth.d.ts
Others need to know:
- **seed/users.json demo hash was wrong — demo1234 never worked.** Fixed in seed. Everyone: run `bash seed/reset.sh` (Docker only seeds when data/plans.json is missing).
- Middleware now strips Auth.js's rolling session-cookie refresh (it resurrected sessions after logout via in-flight prefetches). Sessions = absolute 8h.
- `session.user.tier/onboarded/maskedInbox` are typed now (types/next-auth.d.ts) — no more `as any`. In pages use `requireUser()` from lib/session.ts (fresh from users.json, no passwordHash).
- User type gained optional `profile`; onboardingSchema accepts optional `profile`. Tier-3 consent fields are forced false server-side.
- Jeff: approval dialog is components/outreach/approval-dialog.tsx — extend freely. Draft body has the AI disclosure stripped for display because mail.ts already prepends it (ai.ts prompt also asks the model to include it → was duplicated).
- Jeff/security: HEALTH_KEYWORDS blocks normal CI enquiries — "cancer" (riders template mentions early-stage cancer), "pre-existing", "treatment". Riders/exclusions AI drafts will likely be blocked. Suggest only blocking first-person disclosures ("I have/was diagnosed…").
- AI_DISCLOSURE_PREFIX (constants.ts) and relay domain (mail.ts) still say Fineprint; demo email is still demo@fineprint.local.
- Pre-existing lint error in hooks (react-hooks/set-state-in-effect, use-plans) — not touched.
- Marcus updated auth.ts, users.ts, onboarding.ts to use async DB (Drizzle) calls — the abstractions are the same, just async now.
Blockers: None. AI drafting needs Jeff's DeepSeek wiring; UI falls back to template drafts until then.
---
## 2026-10-20 | Outreach/CRM integration slice
Status: Completed
Done:
- Routed approved outbound email from Next.js through the authenticated Python outreach server.
- Added internal-key protection to outreach send and simulator endpoints.
- Added a backend callback for simulator replies so the web backend remains the CRM writer.
- Added a CRM "Simulate insurer reply" control for the five demo personas.
- Hardened send validation: approval is evaluated from the validated request, subject and body are PII-scanned, and invalid follow-up threads are rejected.
Validation:
- Python sources compile successfully.
- Patch whitespace check passes.
Notes:
- Node and Python test dependencies are not installed in this checkout; `npm ci` was attempted but network access reset, and pytest could not start because pytest is unavailable.
---

## 2026-10-20 | CRM/outreach ownership split
Status: Completed
Done:
- Fixed CRM reply simulation handler placement so the CRM component compiles and can refresh a thread after a simulated reply.
- Added CRM-only close/flag actions.
- Added CRM quote-to-comparison action with duplicate protection and audit logging.
- Documented the ownership boundary and internal reply contract in README.md for parallel work.
Validation:
- Web TypeScript check passes in the running container.
- Python sources and patch whitespace remain valid.
Notes:
- Existing repository-wide ESLint errors remain outside the CRM changes.
- Existing Jest configuration currently parses TypeScript as plain JavaScript, so the baseline web tests fail before executing.
---

## 2026-10-19 | Copilot | PR #1 merge conflict resolution
Status: Completed
Done:
- Merged `main` into `jeff/outreach-crm` and resolved all merge conflicts.
- Kept onboarding/outreach page + onboarding form conflict resolutions aligned with `main`'s latest UI flow.
- Preserved both branches' TASK.MD history by carrying over migration/auth entries from `main` and prior outreach/CRM entries from this branch.
Validation:
- `cd web && npm run build` ✅
- `cd web && npm test -- --runInBand` ✅
Others need to know:
- This branch now includes the latest `main` updates (auth/docs/CI scaffolding) and is no longer in a conflicted state.
Blockers: None
---

## 2026-10-20 | Copilot | Fix CI scraper lint failure
Status: Completed
Done:
- Investigated failing GitHub Actions job `scraper (lint · test)` (run 39292050598, job 118195268118) and identified `ruff` F821 (`threads_path` undefined) in `scraper/app/personas/simulator.py`.
- Added the missing `threads_path = settings.data_dir / "threads.json"` assignment before loading threads.
- Validated with `ruff check app/` and `pytest -v` in `/scraper` (16 passed).
Files:
- scraper/app/personas/simulator.py
- TASK.MD
Others need to know:
- Failure was limited to lint; no behavior change beyond restoring intended thread loading path.
Blockers: None
---

## 2026-10-19 | Jeff | CRM polish: refresh/polling, status error handling, quote review, API tests
Status: Completed
Done:
- Thread refresh/polling: thread detail now auto-polls for inbound replies (handles slow-persona delay) and refreshes the timeline after a simulated reply.
- Status error handling: close/flag status actions surface failures to the user instead of failing silently.
- Quote review gate: quote-to-comparison action requires explicit review, with duplicate protection and audit logging.
- API tests: added CRM API test coverage (crm-api.test.ts) over the thread/status/quote endpoints.
Files:
- web/src/components/crm/thread-detail.tsx
- web/src/hooks/use-thread.ts
- web/src/__tests__/crm-api.test.ts
Others need to know: Touches ONLY CRM-owned paths; does not affect Marcus's scraper or Dominic's website/auth/outreach work. Delivered as a draft PR off jeff/crm-polish (not merged).
Blockers: Live simulate-reply/extract smoke test still needed (requires DEEPSEEK_API_KEY + running scraper + Mailpit) to fully confirm the slow-persona polling UX.
---
## 2026-10-19 | Jeff | Profile-driven comparison personalization
Status: Completed
Done:
- Premium bucket resolver (pure, LLM-free) with graceful fallback chain: exact gender+snapped-age-band+smoker → same gender+band+nonsmoker → seed default (M/30) → first available bucket → not available.
- Profile-aware premium column: header switches to "Premium (your profile)" when a usable profile exists, else "Premium (M/30)"; a "*" tooltip marks non-exact (closest-available) matches.
- Soft budget/coverage highlight (NON-hiding): "within budget" / "meets coverage need" badges and an opacity de-emphasis for the "within my budget" toggle — plans are never removed.
- No-profile CTA: an alert links to /onboarding to add details for tailored premiums.
- Unit tests for the resolver + budget/coverage helpers (premium.test.ts).
Files:
- web/src/lib/premium.ts (new)
- web/src/__tests__/premium.test.ts (new)
- web/src/app/(app)/compare/page.tsx
- web/src/components/compare/plan-table.tsx
- web/src/components/compare/plan-filters.tsx
- web/src/hooks/use-plans.ts
Others need to know: Reads the app user profile and is independent of the auth provider — works under both NextAuth and the pending Supabase Auth. Stays out of auth/scraper/outreach/crm lanes and does not change the /api/plans response shape. Draft PR open, not merged.
Blockers: None (live visual check against a logged-in demo user with a profile is the final confirmation)
---
