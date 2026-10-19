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
Blockers: None. AI drafting needs Jeff's DeepSeek wiring; UI falls back to template drafts until then.
---
