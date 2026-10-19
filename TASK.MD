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

## 2026-10-20 | Marcus | PostgreSQL Storage Migration (FEAT-001 verify + FEAT-002)
Status: Completed
Done:
- Validated WIP FEAT-001 (Jeff's unverified commit): npm build ✓, npm test 12/12 ✓, lint ✓ (2 pre-existing errors only)
- blocker.ts + policy.ts changes confirmed correct async logEvent fire-and-forget — no behavioral change
- FEAT-001 infra gaps: added postgres:16 + db-init one-shot to docker-compose.yml; removed init-data JSON-copy
- Rewrote seed/reset.sh to reset DB (truncate + re-seed); added resetDatabase() + RESET=1 path to seed.ts
- Added DATABASE_URL to all env example files; updated dev.sh with db:migrate + db:seed shortcuts
- FEAT-002: created scraper/app/storage/database.py with SQLAlchemy ORM models mapped to Drizzle tables (no DDL)
- Refactored engine.py: SQLAlchemy reads/writes; expunge_all() preserves "failed scrape never loses data" invariant
- Refactored simulator.py: SQLAlchemy queries for Thread/Insurer/ThreadMessage
- Refactored routers/scraper.py: ScraperRun DB query for /scraper/status
- Deleted json_store.py, jsonl_append.py, test_hash_chain.py
- 12 scraper tests pass, ruff clean
Files:
- docker-compose.yml, seed/reset.sh, web/src/lib/seed.ts, dev.sh
- .env.example, web/.env.local.example, scraper/.env.example
- scraper/app/storage/database.py (new), engine.py, simulator.py, routers/scraper.py
Others need to know:
- EVERYONE must now run Postgres — docker compose up starts it automatically
- Set DATABASE_URL=postgres://postgres:dev@localhost:5432/assura in .env and web/.env.local
- Reset demo data: bash seed/reset.sh (resets DB, not JSON files)
- Audit tamper SQL for demo: UPDATE audit_entries SET action='tampered' WHERE id=(SELECT MIN(id) FROM audit_entries);
- jeff/outreach-crm branch (PR #1) needs rebase onto this migration — its api/crm/* and api/outreach/* routes use old JSON layer
Blockers: None
---
