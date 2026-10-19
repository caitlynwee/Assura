# Fineprint

AI-powered critical illness insurance comparison and outreach agent. Built for the 2026 Shenzhen FinTechathon (International Track, Topic D — Insurance Assistant).

## Architecture

```
/
├── web/        Next.js 14 (App Router) — frontend + API routes
├── scraper/    Python FastAPI — scraper, email relay, insurer simulators
├── data/       Shared runtime JSON files (gitignored, populated by seed/reset.sh)
└── seed/       Initial seed data + reset script
```

## Prerequisites

- Node.js 20+
- Python 3.11+
- [Mailpit](https://mailpit.axllent.org/) (sandbox email)

## Quickstart

### 1. Reset data to seed state
```bash
bash seed/reset.sh
```

### 2. Start the web app
```bash
cd web
cp .env.local.example .env.local   # fill in AUTH_SECRET and ANTHROPIC_API_KEY
npm install
npm run dev
```

### 3. Start the scraper server
```bash
cd scraper
cp .env.example .env               # fill in ANTHROPIC_API_KEY
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8100 --reload
```

### 4. Start Mailpit
```bash
mailpit
# Web UI: http://localhost:8025
# SMTP:   localhost:1025
```

## Demo login
- Email: `demo@fineprint.local`
- Password: `demo1234`

## Key URLs (dev)
| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| Scraper API | http://localhost:8100 |
| Mailpit UI | http://localhost:8025 |
| Mock brochure | http://localhost:8100/mock/brochure |

## Running tests
```bash
# Web (TypeScript)
cd web && npm test

# Scraper (Python)
cd scraper && pytest
```

## Security design
See `PROJECT.MD` — security accounts for 30% of the judging score. Key components:
- **Policy engine** (`web/src/lib/policy.ts`) — deny-by-default, tier-gated actions
- **PII blocker** (`web/src/lib/blocker.ts` + `scraper/app/email_relay/pii_blocker.py`) — NRIC, phone, health keywords
- **Quarantined reader** (`web/src/lib/quarantine.ts`) — untrusted text never reaches the send agent
- **Hash-chain audit log** (`web/src/lib/audit.ts`) — tamper-evident, verifiable
