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

## 2026-10-20 | Dominic | Supabase Auth migration (replaces NextAuth v5)
Status: Completed
Done:
- Supabase Auth is now the default runtime auth path; NextAuth v5 removed (auth.config.ts, next-auth.d.ts, api/auth/[...nextauth] deleted; next-auth dropped from package.json).
- Kept the app `users` table as source of truth. Added nullable `users.auth_uid` column + Drizzle migration (0001_curly_grim_reaper.sql); preserved all TEXT ids (user_demo) and FKs. Link by auth_uid, email fallback + back-fill.
- New guarded Supabase clients (lazy, no-throw keyless) in web/src/lib/supabase/{env,client,server,admin}.ts. Service-role key is server-only (never NEXT_PUBLIC_).
- New @/lib/auth facade: auth()/signOut()/refreshSessionCookie() with the same { user: { id, tier, maskedInbox, onboarded, email, name } } shape; all ~16 call sites + crm-api.test.ts mock unchanged.
- Server actions reimplemented on Supabase (login/demo/signup/logout/upgrade), same signatures; audit events preserved (auth.login.success|failed|locked, signup, logout, user.tier_changed) with maskEmail().
- Edge middleware rewritten on @supabase/ssr + jose local HS256 verify of the access token (no getUser() round-trip); reads tier from app_metadata; same gating rules via pure evaluateRoute() in auth-routing.ts.
- Idempotent demo identity: ensure-demo-user.ts + seed-auth.ts (npm db:seed-auth), wired into reset.sh and docker-compose db-migrate; early-returns (no throw) keyless.
- Added auth-facade.test.ts (user-mapping + evaluateRoute rules).
Files:
- web/src/lib/{auth,auth-routing,session,db,users,types,schema}.ts
- web/src/lib/supabase/{env,client,server,admin,ensure-demo-user}.ts
- web/src/lib/seed-auth.ts, web/src/middleware.ts, web/src/types/session.d.ts
- web/src/app/_actions/auth.ts, web/src/app/auth/reset/route.ts
- web/drizzle/0001_curly_grim_reaper.sql (+ meta), web/package.json
- .env.example, web/.env.local.example, docker-compose.yml, seed/reset.sh
- web/src/__tests__/auth-facade.test.ts
Others need to know:
- Four new env vars before a live demo: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (browser-exposed, safe), SUPABASE_SERVICE_ROLE_KEY and SUPABASE_JWT_SECRET (server-only, NEVER NEXT_PUBLIC_).
- One-click demo login now REQUIRES the Supabase identity to exist: run seed/reset.sh (or docker compose up db-migrate) against a live Supabase project so db:seed-auth creates demo@fineprint.local and links user_demo.auth_uid. Also disable email confirmation on the project.
- Edge verify assumes HS256 access tokens signed with SUPABASE_JWT_SECRET; if the project uses asymmetric signing keys the middleware needs JWKS instead (flagged in a code comment).
- Pre-existing lint error in web/src/hooks/use-plans.ts is untouched (Dominic's known item).
Blockers: Live-key behaviours (real sign-in/up, edge cookie refresh, app_metadata propagation after upgrade, ensureDemoAuthUser) are not CI-verifiable keyless — covered by the design's demo-setup checklist.
Verification (from web/, keyless): npm install OK; npm run build exit 0; npm test 30 passed / 5 suites (incl. new auth-facade.test.ts + unchanged crm-api.test.ts); npm run lint = 1 pre-existing use-plans.ts error, no new errors.
---

## 2026-10-19 | Jeff | Web auth → Supabase Auth
Status: In Progress (code complete + reviewed/APPROVED; draft PR opened; live smoke test pending)
Done:
- Migrated web auth from NextAuth v5 (Credentials) to Supabase Auth as the runtime provider; NextAuth removed (auth.config.ts, next-auth.d.ts, api/auth/[...nextauth] deleted; next-auth dropped from package.json; jose added as a direct dep).
- Kept the app `users` table as the source of truth. Added nullable `users.auth_uid` + Drizzle migration 0001_curly_grim_reaper.sql; preserved all TEXT ids (user_demo) and FKs; link by auth_uid with email fallback + back-fill.
- New @/lib/auth facade (auth()/signOut()/refreshSessionCookie()) keeps the { user: { id, tier, maskedInbox, onboarded, email, name } } shape — all ~16 call sites + crm-api.test.ts mock unchanged.
- Guarded, lazy, no-throw Supabase clients (env/client/server/admin); server actions reimplemented (login/demo/signup/logout/upgrade) with audit events preserved via maskEmail().
- Edge middleware on @supabase/ssr + jose local HS256 verify (no getUser() round-trip); reads tier from app_metadata via pure evaluateRoute() in auth-routing.ts. Idempotent demo identity via ensure-demo-user.ts + seed-auth.ts (db:seed-auth), wired into reset.sh + docker-compose.
- Verified keyless (from web/): npm install OK; npm run build exit 0; npm test 30 passed / 5 suites (incl. new auth-facade + unchanged crm-api); npm run lint = 1 pre-existing use-plans.ts error, no new errors. Code review verdict: APPROVED.
Files:
- web/src/lib/{auth,auth-routing,session,db,users,types,schema}.ts
- web/src/lib/supabase/{env,client,server,admin,ensure-demo-user}.ts
- web/src/lib/seed-auth.ts, web/src/middleware.ts, web/src/types/session.d.ts
- web/src/app/_actions/auth.ts, web/src/app/api/auth/[...nextauth]/route.ts (deleted), web/src/lib/auth.config.ts (deleted), web/src/types/next-auth.d.ts (deleted)
- web/drizzle/0001_curly_grim_reaper.sql (+ meta), web/package.json, web/package-lock.json
- .env.example, web/.env.local.example, docker-compose.yml, seed/reset.sh
- web/src/__tests__/auth-facade.test.ts
Others need to know:
- NEW ENV VARS everyone must set (from Supabase dashboard → Project Settings → API): NEXT_PUBLIC_SUPABASE_URL (Project URL) and NEXT_PUBLIC_SUPABASE_ANON_KEY (anon public key) are browser-exposed by design and safe; SUPABASE_SERVICE_ROLE_KEY (service_role key) is SERVER-ONLY — never prefix NEXT_PUBLIC_, never expose to the browser. (The edge premium-gating also reads SUPABASE_JWT_SECRET, server-only, for local HS256 token verification.)
- Login is now Supabase-backed: Supabase Auth verifies the password and issues the session; NextAuth is gone.
- Bridging approach: the app `users` table stays the source of truth; Supabase is a thin identity provider. App rows link to Supabase identities by auth_uid (email fallback + back-fill). App TEXT ids and all FKs are unchanged — no UUID re-keying.
- One-click demo login REQUIRES the Supabase identity to exist: run seed/reset.sh (or `npm run db:seed-auth`, or docker compose up db-migrate) against a live Supabase project so ensureDemoAuthUser() creates demo@fineprint.local / demo1234 and links user_demo.auth_uid.
- A LIVE smoke test is still pending (create the demo user via the service-role admin routine, set the keys, log in as demo@fineprint.local / demo1234). Live-key behaviours are not CI-verifiable keyless.
Blockers: Live smoke test pending (needs a live Supabase project + the three/four keys). None blocking the draft PR.
---

## 2026-10-20 | Copilot | PR #7 live smoke-test checkpoint
Status: Blocked
Done:
- Confirmed production Compose stack and database migration/seed complete successfully.
- One-click Supabase demo login lands on `/compare`; premium demo can open `/onboarding`, `/outreach`, `/crm`, and `/activity`.
- `npm test -- --runInBand`: 6 suites, 53 tests passed. `npm run build`: passed.
- Signup smoke test was blocked by Supabase Auth email rate limit (HTTP 429); `.invalid` address was rejected. Checked that neither test email left an app or Auth user record.
- `SMTP_HOST` is unset, so outreach remains Mailpit-only; no real email was sent.
Files:
- TASK.MD
Others need to know:
- Retry registration after the Supabase Auth email rate limit resets or is adjusted; no test account remains.
- Real inbox delivery still needs SMTP configuration and explicit authorization.
Blockers: Supabase Auth email rate limit; no SMTP configuration for real inbox test.
---

## 2026-10-20 | Copilot | Docker end-to-end smoke test
Status: Completed
Done:
- Rebuilt production web, scraper, migration, and Mailpit Docker services; all remain running.
- Verified demo login, plan Q&A citations, first-person outreach, server-side PII blocking, Mailpit delivery, helpful reply, quote extraction, mock-only scrape/Updated badge, and 59-entry audit verification.
- Fixed scraper DB driver/config, DeepSeek conversion, downloader call, source-id forwarding, quote schema, disclosure copy, and Q&A citation prompt.
- Validation: web 53 tests + build pass; scraper 14 tests + changed-file Ruff pass.
Files: web/src/lib/{ai,constants,mail}.ts, web/src/components/outreach/*, web/src/app/api/scraper/trigger/route.ts, scraper/{app/config.py,app/scraper/*,pyproject.toml,requirements.txt,tests/*}, TASK.MD
Others need to know: SMTP remains unset; both test emails stayed in Mailpit. Supabase signup remains rate-limited (429). One AIA test thread and the mock-plan update remain in demo data; no reset was run. Full Ruff still reports pre-existing findings in test_change_detector.py and test_pii_blocker.py.
Blockers: Account registration test awaits Supabase email-rate-limit reset; core Docker demo flow is verified.
---

## 2026-10-20 | Copilot | Full Docker persona and login verification
Status: Completed
Done:
- Rebuilt/restarted all production Compose services; web, scraper docs/mock page, and Mailpit respond successfully.
- Signed out and manually signed back in with demo@fineprint.local / demo1234; login reaches `/compare`.
- Exercised sandbox emails for helpful, slow, pushy, data-grabber, and injector personas. Helpful quote extraction now returns premium/coverage/waiting period; pushy/data-grabber/injector threads are flagged; slow persona correctly sends no first reply.
- Verified mock-only scraper run updated the seeded plan and the audit chain passes with 81 entries.
Files: TASK.MD
Others need to know: Four additional test threads and local Mailpit messages were created; slow persona thread remains Sent pending follow-up. No outbound email left Mailpit. Do not reset demo data unless intentionally clearing these artifacts.
Blockers: User signup still awaits Supabase Auth email-rate-limit reset; demo login is verified.
---

## 2026-10-20 | Copilot | Provision app profiles for Supabase Auth users
Status: Completed
Done:
- Kept Supabase Auth as the sole credential verifier; after successful Auth identity resolution, create a missing app profile with free tier, no consent, and onboarding incomplete.
- Never store the Supabase password in the app database; a random unusable password hash satisfies the legacy schema field.
- Preserve existing rows by Auth UID/email and reject attempts to relink an email already bound to another Auth UID.
- Uses a stable app-user ID derived from the Auth UID so concurrent provisioning of one identity converges on the same row.
- Added auth facade regression tests for profile provisioning, UID lookup, and preventing identity relinking.
Files: web/src/lib/{users,auth}.ts, web/src/app/_actions/auth.ts, web/src/__tests__/auth-facade.test.ts
Others need to know: Auth-created users default to Free and must complete onboarding/upgrade for premium features. This change does not move CRM/application data out of PostgreSQL.
Blockers: None.
---

## 2026-10-20 | Copilot | Retire stale CRM/outreach handoff
Status: Completed
Done:
- Removed the obsolete CRM/outreach handoff and its AGENTS.md pointer; implementation and Docker/Mailpit verification are recorded in this task log.
- Corrected the scraper env template from the retired Hermes key to the configured DeepSeek key.
- Carried forward remaining PR #7 gates: live Supabase signup/account-deletion verification and the user's decision to mark ready/merge.
Files: docs/HANDOFF.md, AGENTS.md, scraper/.env.example, TASK.MD
Others need to know: All email delivery remains local via Mailpit. No live Supabase signup/deletion check was completed here.
Blockers: PR #7 remains open/draft pending those live checks or an explicit waiver and user approval to merge.
---

## 2026-10-20 | Copilot | Brevo demo email delivery
Status: Blocked
Done:
- Wired optional Brevo SMTP through Docker while retaining Mailpit as the default when SMTP is not configured.
- Added a demo-only recipient override, actual delivery headers in CRM threads, and approval-screen sender/recipient display.
- Restricted live sends to the Supabase account matching the configured sender; that account is provisioned premium and its JWT metadata refreshes on login.
- Added a guard against sending seeded `.local` recipients externally, SMTP-auth health checks, and relay regression tests.
- Validation: web tests 55 passed + production build passed; scraper tests 17 passed + targeted Ruff passed.
Files: .env.example, AGENTS.md, docker-compose.yml, docs/{HANDOFF.md,PROJECT.MD}, scraper/app/{config.py,email_relay/relay.py,routers/email.py}, scraper/tests/test_relay.py, web/src/{app/(app)/outreach/page.tsx,app/_actions/auth.ts,app/api/outreach/send/route.ts,components/outreach/*,lib/mail.ts,lib/users.ts,__tests__/auth-facade.test.ts}
Others need to know: No email was sent. Docker has Brevo config and the requested test recipient, but Brevo returned `535 5.7.8 Authentication failed`. Replace local `SMTP_USERNAME`/`SMTP_PASSWORD` with valid Brevo SMTP login/key (not the API key) before sending. The current password has an SMTP-key-like format but was rejected.
Blockers: Brevo rejected SMTP authentication; live delivery awaits valid SMTP credentials.
---

## 2026-10-20 | Copilot | Brevo SMTP credential recheck
Status: Blocked
Done:
- Rechecked the active Docker configuration; Brevo host, port, credentials, sender, and demo recipient are all passed to the right services.
- Confirmed the environment values are unchanged between the main `.env` and Docker container (matched SHA-256 fingerprints without printing secrets).
- Confirmed TLS connection succeeds but SMTP authentication is rejected with `535 5.7.8` on all supported Brevo ports (587, 2525, 465); no message was sent.
- Confirmed the configured SMTP login currently matches the From address; no external email was sent.
Files: TASK.MD
Others need to know: Replace the SMTP login/key with the values shown in Brevo's SMTP & API → SMTP tab, then rebuild/restart scraper and web with the main checkout `.env`. The supplied SMTP-like key is rejected, so do not mark live delivery as verified.
Blockers: Valid Brevo SMTP authentication is still required before end-to-end delivery can be tested.
---

## 2026-10-20 | Copilot | Local-only outreach email
Status: Completed
Done:
- Removed external SMTP selection, credentials, recipient overrides, and sender-specific premium provisioning; outreach now always sends through Mailpit.
- Restored masked relay and seeded insurer addresses in the UI; retained approval, PII screening, and AI disclosure safeguards.
- Added a relay regression test proving legacy SMTP environment variables cannot redirect a send outside Mailpit.
Files: docker-compose.yml, .env.example, AGENTS.md, docs/{HANDOFF.md,PROJECT.MD}, scraper/app/{config.py,email_relay/relay.py,routers/email.py}, scraper/tests/test_relay.py, web/src/{app/(app)/outreach/page.tsx,components/outreach/*,lib/{mail,users}.ts,__tests__/auth-facade.test.ts}
Others need to know: External SMTP settings in local `.env` files were left untouched; Compose no longer forwards them to services.
Blockers: None.
---

## 2026-10-20 | Copilot | Merge Supabase Auth PR and clarify Docker run commands
Status: Completed
Done:
- Merged the latest main into the Supabase Auth branch; resolved the env-template conflict to retain Supabase/JWKS guidance and omit external SMTP, and kept the feature branch's complete task history.
- Marked PR #7 ready and merged it into main after both GitHub CI jobs passed.
- Updated `dev.sh`/README to recommend `./dev.sh up-prod` for the full production-built Docker demo and distinguish it from hot-reload `./dev.sh up`.
- Made script invocation independent of the caller's current directory and routed destructive seed reset through Compose's configured DB environment.
- Made default `./dev.sh setup` Docker-only; `./dev.sh setup --local` opts into installing host development dependencies.
- Updated local env guidance to remove unused NextAuth settings and corrected README database/startup/reset instructions.
Validation:
- `bash -n dev.sh` and help invocation from `/tmp`: passed.
- Production Docker web image build passed.
- Web: 55 tests passed; production build passed.
- Scraper: 15 tests passed; Ruff passed.
- Dev and production Docker Compose config validation: passed.
- Docker-first setup via `./dev.sh setup` from outside the repository: passed.
- GitHub CI: web and scraper jobs passed.
Files: .env.example, README.md, dev.sh, web/.env.local.example, TASK.MD
Others need to know: Use `./dev.sh up-prod` from any working directory for the Docker demo; it uses the root `.env`. Use `./dev.sh up` for Docker hot reload.
Blockers: None.
---

## 2026-10-20 | Copilot | Retire completed CRM/outreach handoff
Status: Completed
Done:
- Confirmed the CRM/outreach integration, Mailpit delivery, persona simulations, quote workflow, audit verification, and Docker demo are implemented and have been exercised.
- The handoff's remaining suggestions are optional improvements, not blockers for the working demo; removed the stale handoff rather than keep obsolete setup and validation guidance.
- Removed the live AGENTS.md pointer; TASK.MD and PROJECT.MD remain the current project references.
Files: docs/HANDOFF.md, AGENTS.md, TASK.MD
Others need to know: The open/draft PR #7 and its remaining live Supabase smoke-test/merge decisions are tracked separately; this does not mark PR #7 merged or ready.
Blockers: None for retiring this handoff.
---

## 2026-10-20 | Copilot | Retire Supabase Auth PR handoff
Status: In Progress (PR #7 remains open and draft)
Done:
- Reconciled the PR handoff with current state: Docker demo login and Mailpit-only outreach are verified; web tests/build and scraper tests/targeted Ruff pass.
- Removed the real-inbox/Brevo test from scope; approved outreach is deliberately local-only.
- Removed the stale handoff; this log now carries the remaining PR gates.
Files: docs/HANDOFF-supabase-auth-pr7.md, TASK.MD
Others need to know: Still unverified against the live Supabase project: new-account signup and account deletion. Signup previously hit Supabase's email rate limit. PR #7 must remain draft until those checks are completed or explicitly waived, and the user approves merging.
Blockers: Live Supabase signup/account-deletion smoke test and user decision on PR readiness/merge.
---

## 2026-10-20 | Copilot | Resolve Supabase Auth PR handoff gates
Status: Completed
Done:
- Verified PR #7 merged into `main` as `9af4cd4` after web and scraper CI passed; the user explicitly authorized merging.
- Closed the handoff's PR readiness/merge decision. The live Supabase signup and account-deletion checks remain unverified and are follow-up validation, not a merge blocker.
Files: TASK.MD
Others need to know: Before relying on real-account flows, smoke-test signup and account deletion against the intended Supabase project; CI does not validate those live service flows.
Blockers: None for the PR merge; live Supabase smoke tests remain outstanding.
---

## 2026-10-20 | Copilot | Fix sign-in pool exhaustion and add account settings
Status: Completed
Done:
- Capped web PostgreSQL and scraper SQLAlchemy pools to fit Supabase's constrained session-mode connection pool.
- Removed redundant post-login token refresh; invalid refresh-token cookies now clear through `/auth/reset`.
- Added Settings to edit a display name and personal profile fields persisted in PostgreSQL; moved account deletion there and placed Sign out last in the account menu.
- Added a profile JSONB migration after the latest timestamp in the shared database's migration history and upgraded the production web image to Node 22.
- Verified 57 web tests, 15 scraper tests, targeted web lint and Ruff, host/Docker builds, migration and seed startup, and Docker endpoint/auth-reset smoke tests.
Files: web/src/{lib/{db,schema,users,auth,onboarding}.ts,app/(app)/settings,app/_actions/settings.ts,components/settings}, web/drizzle/0002_last_killer_shrike.sql, scraper/app/storage/database.py, web/Dockerfile.prod
Others need to know: Personal/health/income data is never shared unless separate consent permits it; sign-in email remains managed by Supabase. Full web lint still reports a pre-existing issue in untouched `web/src/hooks/use-plans.ts`.
Blockers: None.
---

## 2026-10-20 | Copilot | Rebrand local masked relay addresses
Status: Completed
Done:
- Changed generated, seeded, and simulated masked inbox addresses to `@relay.assura.local`.
- Added a data migration for existing accounts and documented that the `.local` address is Mailpit-only, not externally deliverable.
- Verified focused web and scraper tests/lints, Drizzle reports no schema changes, and Docker applied migration 5; the seeded demo inbox now uses the Assura domain.
Files: web/src/lib/mail.ts, web/drizzle/0003_assura_relay_domain.sql, scraper/app/personas/simulator.py, seed/users.json, README.md
Others need to know: Demo login remains `demo@fineprint.local`; it is separate from the masked relay address.
Blockers: None.
---

## 2026-10-20 | Copilot | Enable confirmed account email changes
Status: Completed
Done:
- Added a Settings email-change request that delegates to Supabase Auth and requires its confirmation link; the shared demo account remains protected.
- Added the Supabase PKCE callback and syncs the app profile only after Supabase reports the confirmed email; handles multi-step confirmation as pending.
- Added callback URL configuration guidance and tests for validation, audit masking, demo protection, and profile email sync.
- Verified 19 focused web tests, changed-file ESLint, and production Next.js build.
Files: web/src/app/_actions/settings.ts, web/src/app/auth/callback/route.ts, web/src/components/settings/settings-form.tsx, web/src/lib/{db,users,supabase/server}.ts, .env.example, README.md
Others need to know: Add `http://localhost:3000/auth/callback` to Supabase Auth's allowed redirect URLs. Set `NEXT_PUBLIC_SITE_URL` to the public app origin in hosted environments.
Blockers: None.
---
