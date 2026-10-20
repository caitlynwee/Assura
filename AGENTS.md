# Assura — AI Agent Instructions

> Tool-agnostic guide for any AI coding assistant working in this repo (Claude, Kiro, Copilot,
> Cursor, etc.). `AGENTS.md` is the cross-tool standard filename; most assistants read it
> automatically. Read this plus `TASK.MD` (current state) and `docs/PROJECT.MD` (product spec) at the
> start of every session.

## Goal: Win the 2026 Shenzhen FinTechathon
International Track · Topic D (Insurance Assistant) · Theme: "AI as a Financial Participant"
**Deadline: 20 Oct 2026, 23:59 SGT. Every decision must serve the judging criteria.**

---

## Judging Criteria (internalize this before writing a single line)
| Weight | Criterion | What judges look for |
|--------|-----------|----------------------|
| **40%** | Task completion | All 3 deliverables working end-to-end in the demo |
| **30%** | Security & compliance | Policy engine, PII blocker, audit chain, quarantine reader — demonstrably working |
| **30%** | Innovation & interaction | AI-driven UX, smooth demo flow, "wow" moments |

**Rules of thumb:**
- If a feature doesn't appear in the demo flow, deprioritize it.
- Security must be *visible* — the PII block, the escalation, the "Verify chain" pass/fail are demo moments.
- Never output "buy this plan" or financial advice — factual comparison only.
- Always cite sources (brochure name + "data as of" date) in AI answers.

---

## Product: What We Are Building
Assura is a "reverse CRM" for insurance customers:
1. **Level 1 — Compare**: Scrapes public brochure data from 6 Singapore CI insurers, presents a filterable comparison table with cited sources.
2. **Level 2 — Outreach**: With user approval, AI drafts emails. All delivery goes to the local Mailpit sandbox. User edits and approves every email before it sends.
3. **Level 3 — CRM**: Tracks all threads, extracts quotes via a quarantined LLM call, flags suspicious replies (pushy, data-grabber, injector persona).

**Demo flow (must work perfectly — 4 minutes):**
Home → Compare & filter → Q&A chat (cited answer) → Onboarding (masked inbox) → Outreach (NRIC typed = blocked, then approve) → CRM (helpful quote extracted, pushy flagged, data-grabber escalated, injection ignored) → Edit mock brochure → Run now (Updated badge) → Verify chain ✓ → Tamper copy → Verify chain ✗

---

## Team Responsibilities

### Dominic — Website & Auth
- Full Next.js frontend: all pages, components, UI polish
- User authentication (Supabase Auth, JWT sessions, demo login)
- Free vs Premium feature gating
- Web security: middleware auth guards, input validation, no XSS
- Files: `web/src/app/`, `web/src/components/`, `web/src/middleware.ts`

### Marcus — Scraper
- Python FastAPI scraper server (`/scraper`)
- Scrape 6 Singapore CI insurers: AIA, Prudential, Great Eastern, NTUC Income, Manulife, Singlife
- Extract plan data from brochures → convert via quarantined LLM → update plans.json
- Cron job at 00:00 SGT (local for now, cloud later)
- Change detection: ETag/Last-Modified → SHA-256 hash fallback
- Mock brochure at `/mock/brochure` (editable live for demo)
- Files: `scraper/app/scraper/`, `scraper/app/routers/scraper.py`, `data/sources.json`

### Jeff — AI Agent & CRM
- AI email drafting + thread management (in-process via `web/src/lib/ai.ts` — the standalone
  Hermes agent idea was dropped as overkill for the demo; drafting is one LLM call, no agent loop)
- Outreach flow: insurer picker → template → AI draft → user approval → send
- CRM: thread timeline, status management, quote extraction, risk flag display
- 5 simulated insurer personas (helpful, slow, pushy, data-grabber, injector)
- Connect AI APIs; ensure quarantine reader is used for all inbound insurer text
- Files: `web/src/app/(app)/outreach/`, `web/src/app/(app)/crm/`, `scraper/app/personas/`, `scraper/app/email_relay/`

### Caitlyn — Documentation & Deck
- Technical documentation: system architecture diagram, core algorithm walkthrough, security design write-up
- Self-assessment report: known-risk list (see docs/PROJECT.MD security section)
- Presentation deck (≤10 minutes): problem → solution → demo → security → innovation
- Judges will ask about security — ensure the policy engine tiers and audit chain are documented clearly

---

## Repo Layout
```
/
├── web/          Next.js 16 (App Router) — frontend + API routes
├── scraper/      Python FastAPI — scraper, email relay, personas
├── data/         Runtime JSON files (gitignored; reset with bash seed/reset.sh)
├── seed/         Seed data + reset.sh (source of truth for demo state)
├── docs/         Product spec and hackathon reference docs
│   └── PROJECT.MD    ← product spec
├── AGENTS.md     ← you are here (AI agent instructions, any tool)
├── TASK.MD       ← cross-session task log (UPDATE THIS when you finish something)
└── README.md     ← setup & onboarding
```

---

## Architecture Decisions (do not change without team consensus)
- **AI provider**: DeepSeek via the OpenAI-compatible SDK (`DEEPSEEK_API_KEY`, model `deepseek-chat`), in `ai.ts` + `quarantine.ts`. The client is lazily instantiated so `next build` works without a key. (Migrated off Anthropic/Claude. The scraper's own LLM config is a separate port — Marcus's lane.)
- **Storage**: Local JSON files — `data/*.json` and `data/*.jsonl`. Backend is the only writer. Atomic saves (temp → rename). **⚠ Migration in progress:** moving to PostgreSQL (Drizzle for web, SQLAlchemy for the scraper) on branch `migrate/postgres-storage` (full handoff lives on that branch). Until that merges, JSON files remain the source of truth.
- **Auth**: Supabase Auth verifies credentials; PostgreSQL app profiles supply tier/consent data. `proxy.ts` verifies access-token signatures with Supabase JWKS.
- **`DATA_DIR`**: Defined in `web/src/lib/db.ts` only. Do NOT put it in `constants.ts` (edge runtime constraint).
- **All `(app)` pages**: Must export `export const dynamic = "force-dynamic"`.
- **Next.js 16 dynamic routes**: Params are `Promise<{...}>` — always `await params`.
- **Policy engine**: `web/src/lib/policy.ts` — pure code, no LLM, deny by default. Every AI action goes through this.
- **Quarantine**: All untrusted external text (insurer replies, scraped HTML) → `quarantine.ts` — no-tools LLM, fixed JSON schema, Zod-validated.
- **Email delivery**: Mailpit only. No external SMTP provider or recipient is configured; every send still requires user approval, PII screening, and the AI disclosure footer.

## Security — Non-Negotiable (30% of score)
These must be demonstrably working in the demo:
1. **Policy tiers**: 0=read, 1=advise/draft (premium), 2=send (approval required), 3=blocked (NRIC/health/income → escalate)
2. **PII blocker**: NRIC regex `[STFGM]\d{7}[A-Z]`, SG phone, health keywords — blocks outgoing email, shows error to user
3. **Audit hash chain**: SHA-256 linked entries in `audit.jsonl`, "Verify chain" button shows ✓/✗
4. **Quarantine reader**: Insurer replies never reach the send agent raw — always parsed through isolated LLM call

---

## TASK.MD Protocol — How We Collaborate Across Sessions

**READ `TASK.MD` at the start of every session** to know current project state.

**UPDATE `TASK.MD` when you complete any meaningful work.** Append a new entry:

```
## YYYY-MM-DD | [YOUR NAME] | [FEATURE]
Status: Completed | In Progress | Blocked
Done: Brief bullet points of what was implemented
Files: List of key files created or modified
Others need to know: Anything that affects another teammate's work
Blockers: What is stopping you (if any)
---
```

**Rules:**
- Do not rewrite other people's entries — append only.
- If you discover a bug in someone else's code, note it under "Others need to know" in your entry, then fix it if it's in your domain.
- Keep entries concise — 5–10 lines max.

---

## Start Commands
```bash
# 1. Seed data (run once or to reset demo state)
bash seed/reset.sh

# 2. Web app
cd web && cp .env.local.example .env.local   # fill Supabase + DATABASE_URL + DEEPSEEK_API_KEY
npm install && npm run dev                    # http://localhost:3000

# 3. Scraper server (uv — install: brew install uv)
cd scraper && uv venv .venv && source .venv/bin/activate
uv pip install -e ".[dev]"
uvicorn app.main:app --port 8100 --reload    # http://localhost:8100

# (Or just run `./dev.sh setup` from the repo root to do steps 1-3 at once.)

# 4. Mailpit (install once: brew install mailpit)
mailpit                                       # UI: http://localhost:8025 | SMTP: localhost:1025
```

Demo login: `demo@fineprint.local` / `demo1234`

---

## Before You Commit Anything
- [ ] Does it serve the demo flow? (if not, is it worth the time?)
- [ ] Does it respect the policy engine tiers?
- [ ] Does it show a source citation or "data as of" date where applicable?
- [ ] Does it never say "buy this" or give financial advice?
- [ ] Have you updated TASK.MD?
