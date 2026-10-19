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

## 2026-10-20 | Marcus | Scraper — DeepSeek + Playwright Implementation
Status: Completed
Done:
- Swapped Anthropic SDK → openai>=1.0 (DeepSeek uses OpenAI-compatible API at api.deepseek.com)
- Rewrote converter.py: AsyncOpenAI client, chat.completions.create, raised truncation 8k → 24k chars
- Rewrote downloader.py: headless Chromium singleton via Playwright for product_page sources; plain httpx for mock sources
- Fixed insurerName bug: validator.py now looks up display name from insurers.json when converter leaves it blank
- Added Singlife as 6th insurer (seed: insurers.json, sources.json, plans.json)
- Updated Dockerfile: Chromium system libs + playwright install chromium
- docker-compose.yml: DEEPSEEK_API_KEY + LLM_MODEL env vars for scraper service
- Added test_converter.py (4 tests); updated test_engine.py mock to accept source_type kwarg
- All 20 tests pass, ruff lint clean
Files:
- scraper/app/scraper/{converter,downloader,engine,validator}.py
- scraper/app/config.py, scraper/requirements.txt, scraper/pyproject.toml
- scraper/Dockerfile, docker-compose.yml, scraper/.env.example
- scraper/tests/{test_converter,test_engine}.py
- seed/{insurers,sources,plans}.json
- dev.sh, CLAUDE.md (added playwright install chromium to setup steps)
Others need to know:
- Env var for scraper AI is DEEPSEEK_API_KEY (not HERMES_API_KEY — that's for web/email)
- sources.json uses type="mock" for the local brochure and type="product_page" for real insurer URLs
- To run scraper locally: `pip install -r requirements.txt && playwright install chromium`
- `./dev.sh setup` handles everything (venv + deps + playwright browser + seed)
Blockers: None
---
