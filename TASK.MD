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
