# Assura

AI-powered critical illness insurance comparison and outreach agent.
Built for the **2026 Shenzhen FinTechathon** — International Track, Topic D (Insurance Assistant).

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [First-time setup](#first-time-setup)
- [Running the project](#running-the-project)
- [dev.sh cheat sheet](#devsh-cheat-sheet)
- [Key URLs](#key-urls)
- [Demo credentials](#demo-credentials)
- [Architecture](#architecture)
- [Team ownership](#team-ownership)
- [Environment variables](#environment-variables)
- [Resetting demo data](#resetting-demo-data)
- [Running tests](#running-tests)

---

## Prerequisites

**Option A — Docker (recommended, no installs needed beyond Docker)**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 24+

**Option B — Local (no Docker)**
- Node.js 22+
- Python 3.11+
- [uv](https://docs.astral.sh/uv/) — `brew install uv` (or `curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Mailpit — `brew install mailpit`

The app uses Supabase for authentication and PostgreSQL, and DeepSeek for AI features. Configure the Supabase values, `DATABASE_URL`, and `DEEPSEEK_API_KEY` in the root `.env` before starting Docker.
The web and scraper use small database connection pools for Supabase's limited
session-mode pool. For larger deployments, use Supabase's transaction-mode
pooler URL as recommended by Supabase.

---

## First-time setup

### 1. Clone and enter the repo

```bash
git clone <repo-url>
cd Assura
```

### 2. Run setup

```bash
./dev.sh setup
```

By default, this creates only the root `.env` template needed by Docker; it
does not require Node.js, Python, or uv on the host. To install host-side
development dependencies as well, use `./dev.sh setup --local`.

The local setup (`--local`) also:
- Creates `.env` and `web/.env.local` from the example files
- Creates the Python virtual environment with **uv** (`scraper/.venv`)
- Installs all Python (via `uv`) and Node.js dependencies

### 3. Configure services

For Docker, fill in the root `.env`:

```env
DATABASE_URL=<Supabase PostgreSQL connection string>
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase publishable/anon key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=<server-only Supabase secret key>
DEEPSEEK_API_KEY=sk-...
```

Use the bare Supabase project URL (no `/rest/v1/` path). Never expose
`SUPABASE_SERVICE_ROLE_KEY` to the browser or commit real credentials.
To enable account email changes, add `http://localhost:3000/auth/callback` to
the Supabase project's allowed redirect URLs. Set `NEXT_PUBLIC_SITE_URL` to the
app's public origin in non-local deployments and allow that origin's
`/auth/callback` URL too.
`web/.env.local` is only needed when running the web app outside Docker; fill
in the corresponding Supabase and DeepSeek values there too.

### 4. Start the project

```bash
./dev.sh up-prod
```

This runs the whole stack in Docker with the web app built for production.
Open http://localhost:3000 — the app is running. Use the seeded demo account
below. The initial one-shot migration also seeds the demo Supabase identity;
that requires the Supabase URL, anon key, and service-role key.
Other Supabase users can sign in with their own credentials; Assura creates a
free app profile on first successful sign-in. Personal information is editable
from **Settings** and stored in the PostgreSQL `users` table. The sign-in email
is managed by Supabase and can be changed from Settings after confirming the
new address. The shared demo account email remains fixed. Masked relay addresses use
the `@relay.assura.local` domain and are routed only to local Mailpit; they are
not real or externally deliverable email addresses.

---

## Running the project

### Docker

```bash
./dev.sh up              # web only; development mode with hot reload (Free/basic use)
./dev.sh up --build      # web only, rebuilding its image first
./dev.sh up-premium      # web + scraper email relay + Mailpit for Premium outreach demo
./dev.sh up-scraper      # scraper + Mailpit without starting the web app
./dev.sh up-prod         # full production-built Premium demo
./dev.sh down            # stop all Assura services
```

The basic web app does not need the scraper or Mailpit. `up` starts only the
web service and its required one-shot migration/seeding job. The scraper can
run independently with `up-scraper`. In the current architecture, Premium
outreach needs both Mailpit and the scraper service because the scraper hosts
the local email relay and simulated insurer replies; `up-premium` starts those
dependencies alongside the web app. `up-prod` is the recommended full demo
flow. First startup builds images and runs database migrations/seeding.

### Single service — local (no Docker)

Run each in a separate terminal:

```bash
./dev.sh web             # Next.js   → http://localhost:3000
./dev.sh scraper         # FastAPI   → http://localhost:8100
./dev.sh mailpit         # Mailpit   → http://localhost:8025
```

### Mixed (recommended for active development)

Run the services you're **not** working on in Docker, run your own service locally for fastest hot-reload:

```bash
# Working on the web frontend? Run infra in Docker, web locally:
./dev.sh infra           # starts mailpit + scraper in Docker (background)
./dev.sh web             # run web locally in this terminal

# Working on the scraper? Run Mailpit in Docker, web and scraper locally:
docker compose up -d mailpit
./dev.sh web
./dev.sh scraper
```

---

## dev.sh cheat sheet

```
./dev.sh setup           Prepare root .env for Docker
./dev.sh setup --local   Also install local development dependencies

./dev.sh up              Start web only (development/hot reload)
./dev.sh up --build      Rebuild web image then start development mode
./dev.sh up-premium      Start web + scraper relay + Mailpit for Premium demo
./dev.sh up-scraper      Start scraper + Mailpit separately from web
./dev.sh up-prod         Start full production-built Premium demo (recommended)
./dev.sh down            Stop all services
./dev.sh restart         Stop + start
./dev.sh build web       Rebuild one image (web or scraper)
./dev.sh logs            Tail all logs
./dev.sh logs web        Tail logs for one service

./dev.sh web             Run Next.js locally
./dev.sh scraper         Run FastAPI locally
./dev.sh mailpit         Run Mailpit locally
./dev.sh infra           Start mailpit + scraper in Docker (background)

./dev.sh seed            Destructively reset the configured database to seed state
./dev.sh test            Run scraper test suite (pytest)
./dev.sh lint            Lint scraper/app with ruff
./dev.sh ci              Run all CI checks locally (web + scraper)
```

---

## Continuous integration

GitHub Actions runs on every push and pull request to `main` (`.github/workflows/ci.yml`):

- **web** — `npm ci` → lint → build → tests (jest, when the `test` script exists)
- **scraper** — dependencies via **uv** → `ruff` → `pytest`

CI provisions PostgreSQL for the automated database-backed tests.
Run the same checks locally before pushing with `./dev.sh ci`.

Optional pre-commit hooks (ruff + eslint + hygiene checks) live in `.pre-commit-config.yaml`:

```bash
uv tool install pre-commit
pre-commit install            # run hooks on every commit
pre-commit run --all-files    # run them once across the repo
```

---

## Key URLs

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| Scraper API | http://localhost:8100 |
| Scraper API docs | http://localhost:8100/docs |
| Mailpit UI | http://localhost:8025 |
| Mock brochure | http://localhost:8100/mock/brochure |

---

## Demo credentials

| Field | Value |
|---|---|
| Email | `demo@assura.local` |
| Password | `demo1234` |
| Tier | Premium |

The demo email uses the non-deliverable `.local` domain and is only a sign-in
identifier; Supabase marks this seeded demo identity as confirmed.

---

## Architecture

```
┌─────────────────────────── docker compose network ──────────────────────────┐
│                                                                               │
│   web (Next.js :3000)  ──── authenticated HTTP ──── scraper (FastAPI :8100)  │
│                                                            │                  │
│                                                            └── mailpit:1025  │
│                                                                               │
│   mailpit (:1025 SMTP, :8025 UI)                                             │
│                                                                               │
│   web + scraper ───────── Supabase PostgreSQL (DATABASE_URL)                │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Repo layout:**

```
/
├── web/          Next.js 16 (App Router) — frontend + all API routes
├── scraper/      Python FastAPI — scraper pipeline, email relay, personas
├── seed/         Source-of-truth demo data + database reset script
├── dev.sh        Development CLI (start here)
├── docker-compose.yml
├── docs/         Product spec and hackathon reference docs
├── AGENTS.md     AI agent instructions (tool-agnostic: Claude, Kiro, Copilot, ...)
├── TASK.MD       Cross-session task log (update when you complete work)
└── README.md     This file
```

### CRM and outreach ownership boundary

These surfaces are separated so they can be developed in parallel.

**CRM-owned files**

- `web/src/app/(app)/crm/`
- `web/src/app/api/crm/`
- `web/src/app/api/internal/crm/`
- `web/src/components/crm/`
- `web/src/hooks/use-thread*.ts`

The CRM owns PostgreSQL thread records, quote extraction, risk flags, thread
statuses, comparison entries, and audit events. Its API routes are the only
writers for CRM state.

**Outreach-owned files**

- `web/src/app/(app)/outreach/`
- `web/src/app/api/outreach/`
- `web/src/components/outreach/`
- `scraper/app/email_relay/`
- `scraper/app/personas/`
- `scraper/app/routers/email.py`

Outreach owns draft generation, consent filtering, Mailpit delivery, and the
simulated insurer personas. It must not write CRM database records directly. After a
simulated reply, it calls the authenticated `POST /api/internal/crm/replies`
endpoint with an inbound message and optional risk flag; the CRM performs the
state transition and audit logging.

**Startup order:**

```
db-migrate (applies migrations + seeds the database, then exits)
    │
    ├── mailpit  (email sandbox)
    │
    ├── scraper  (FastAPI + APScheduler cron)
    │
    └── web      (Next.js + Supabase Auth)
```

---

## Team ownership

| Person | Area | Key files |
|---|---|---|
| **Dominic** | Web frontend & auth | `web/src/app/`, `web/src/components/`, `web/src/middleware.ts` |
| **Marcus** | Scraper & data pipeline | `scraper/app/scraper/`, `scraper/app/routers/`, `data/sources.json` |
| **Jeff** | AI agent, outreach & CRM | `web/src/app/(app)/outreach/`, `web/src/app/(app)/crm/`, `scraper/app/personas/`, `scraper/app/email_relay/` |
| **Caitlyn** | Docs & presentation | Architecture diagram, security write-up, slide deck |

Read `AGENTS.md` for the full breakdown and the `TASK.MD` protocol.

---

## Environment variables

### `.env` — used by Docker Compose

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Bare Supabase project URL (`https://<project-ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe Supabase publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase secret key used for demo identity seeding |
| `DEEPSEEK_API_KEY` | DeepSeek API key from platform.deepseek.com (the AI layer uses the OpenAI-compatible DeepSeek API) |

`INTERNAL_API_SECRET` can remain at the local demo default unless you choose a
different value. Mailpit host and port are preconfigured; outreach email is
local-only and does not require external SMTP credentials.

### `web/.env.local` — used when running web locally

Set the Supabase URL/keys, `DATABASE_URL`, and `DEEPSEEK_API_KEY`. The example
file is `web/.env.local.example`.

### `scraper/.env` — used when running scraper locally

Pre-filled example at `scraper/.env.example`.

---

## Resetting demo data

To restore the configured PostgreSQL database to the clean demo state:

```bash
./dev.sh seed
```

This truncates and reseeds the configured database, and recreates/links the
demo Supabase Auth identity when the required Supabase keys are present. This
is destructive to existing application data; use only when you want a demo reset.

---

## Running tests

```bash
# Scraper — PII blocker, hash chain, change detection, pipeline safety (16 tests)
./dev.sh test

# Lint scraper code
./dev.sh lint
```

Web unit tests (policy engine, blocker, audit) are in `web/src/__tests__/` — run with `cd web && npm test`
(the `test` script is added by the storage-migration branch).

Run the full CI suite locally (web build/lint/test + scraper lint/test) with `./dev.sh ci`.

---

## Rebuilding after dependency changes

```bash
# Added a new npm package?
./dev.sh build web

# Added a new Python package (declared in scraper/pyproject.toml)?
./dev.sh build scraper
```

Then `./dev.sh up` to restart.
