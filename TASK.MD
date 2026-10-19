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
