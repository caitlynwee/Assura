# Assura — Web (Next.js)

The Next.js 16 (App Router) frontend and API layer for Assura. This package contains all the
web pages, the authenticated app, the API routes (business logic), auth, and the security
libraries (policy engine, PII blocker, audit hash chain, quarantine reader).

> **Start from the repo root, not here.** Setup, Docker, Mailpit, seeding, and the full
> architecture are documented in the root [`README.md`](../README.md). Run `./dev.sh setup`
> once, then `./dev.sh up` (Docker) or `./dev.sh web` (local).

## Local dev (web only)

```bash
# From the repo root (needs AUTH_SECRET + DEEPSEEK_API_KEY in web/.env.local):
./dev.sh web            # → http://localhost:3000
```

Or directly:

```bash
npm install
npm run dev             # dev server
npm run build           # production build (must pass in CI)
npm run lint            # eslint
npm test                # jest (added by the storage-migration branch)
```

## Layout

```
src/
├── app/
│   ├── (public)/       Landing + login
│   ├── (app)/          Authenticated app: compare, chat, onboarding, outreach, crm, activity
│   └── api/            All API routes (auth, plans, chat, outreach, crm, audit, scraper proxy)
├── components/         UI by feature (layout, ui, compare, chat, crm, activity, outreach, onboarding)
├── hooks/              Data-fetching hooks (use-plans, use-threads, use-chat, ...)
├── lib/                auth, policy, blocker, audit, quarantine, ai, mail, db, validators, types
└── middleware.ts       Edge auth guard
```

## Conventions (see root `AGENTS.md` for the full list)

- All `(app)` pages export `export const dynamic = "force-dynamic";`
- Next.js 16 dynamic route params are `Promise<{...}>` — always `await params`.
- The DB access layer (`lib/db.ts`) is Node-runtime only — never import it from `middleware.ts`
  or `auth.config.ts` (edge-safe boundary).
- Every AI action goes through the policy engine (`lib/policy.ts`); all untrusted external text
  goes through the quarantine reader (`lib/quarantine.ts`). Factual comparison only — never
  financial advice.
- AI calls use DeepSeek (`DEEPSEEK_API_KEY`) via the OpenAI-compatible SDK.

## See also

- Root [`README.md`](../README.md) — setup, Docker, URLs, env, tests, CI
- [`../AGENTS.md`](../AGENTS.md) — architecture decisions, team lanes, security requirements
- [`AGENTS.md`](./AGENTS.md) — Next.js version notes for AI agents (web-scoped)
