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
- Node.js 20+
- Python 3.11+
- [uv](https://docs.astral.sh/uv/) — `brew install uv` (or `curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Mailpit — `brew install mailpit`

You need **both** an `AUTH_SECRET` and a `DEEPSEEK_API_KEY` regardless of which option you choose.

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

This single command does everything:
- Creates `.env` and `web/.env.local` from the example files
- Creates the Python virtual environment with **uv** (`scraper/.venv`)
- Installs all Python (via `uv`) and Node.js dependencies
- Seeds `./data` from `./seed`

### 3. Fill in secrets

Open `.env` (used by Docker) and `web/.env.local` (used for local dev) and fill in:

```bash
# Generate AUTH_SECRET with:
openssl rand -base64 32
```

```env
AUTH_SECRET=<paste generated value>
DEEPSEEK_API_KEY=sk-...
```

Both files need the same two values. Everything else is pre-configured.

### 4. Start the project

```bash
./dev.sh up
```

Open http://localhost:3000 — the app is running.

---

## Running the project

### All services together (Docker)

```bash
./dev.sh up              # start everything
./dev.sh up --build      # start everything, rebuild images first
./dev.sh down            # stop everything
./dev.sh restart         # stop then start
```

On first `up`, Docker builds the images (~2 min). Subsequent starts are fast.

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

# Working on the scraper? Run everything else in Docker:
docker compose up -d mailpit web
./dev.sh scraper
```

---

## dev.sh cheat sheet

```
./dev.sh setup           First-time setup (run this first)

./dev.sh up              Start all services in Docker
./dev.sh up --build      Rebuild images then start
./dev.sh down            Stop all services
./dev.sh restart         Stop + start
./dev.sh build web       Rebuild one image (web or scraper)
./dev.sh logs            Tail all logs
./dev.sh logs web        Tail logs for one service

./dev.sh web             Run Next.js locally
./dev.sh scraper         Run FastAPI locally
./dev.sh mailpit         Run Mailpit locally
./dev.sh infra           Start mailpit + scraper in Docker (background)

./dev.sh seed            Reset ./data from ./seed
./dev.sh test            Run scraper test suite (pytest)
./dev.sh lint            Lint scraper/app with ruff
./dev.sh ci              Run all CI checks locally (web + scraper)
```

---

## Continuous integration

GitHub Actions runs on every push and pull request to `main` (`.github/workflows/ci.yml`):

- **web** — `npm ci` → lint → build → tests (jest, when the `test` script exists)
- **scraper** — dependencies via **uv** → `ruff` → `pytest`

Both jobs spin up a PostgreSQL 16 service container (used once the storage migration lands).
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
| Email | `demo@fineprint.local` |
| Password | `demo1234` |
| Tier | Premium |

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
│   ./data  ──────────────── bind mount ──────────────  /data (shared)        │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Repo layout:**

```
/
├── web/          Next.js 16 (App Router) — frontend + all API routes
├── scraper/      Python FastAPI — scraper pipeline, email relay, personas
├── data/         Runtime JSON files (gitignored — populated by seed/reset.sh)
├── seed/         Source-of-truth seed data + reset.sh
├── dev.sh        Development CLI (start here)
├── docker-compose.yml
├── AGENTS.md     AI agent instructions (tool-agnostic: Claude, Kiro, Copilot, ...)
├── TASK.MD       Cross-session task log (update when you complete work)
└── PROJECT.MD    Full product spec
```

### CRM and outreach ownership boundary

These surfaces are separated so they can be developed in parallel.

**CRM-owned files**

- `web/src/app/(app)/crm/`
- `web/src/app/api/crm/`
- `web/src/app/api/internal/crm/`
- `web/src/components/crm/`
- `web/src/hooks/use-thread*.ts`

The CRM owns `threads.json`, quote extraction, risk flags, thread statuses,
comparison entries, and audit events. It is the only service that writes CRM
state.

**Outreach-owned files**

- `web/src/app/(app)/outreach/`
- `web/src/app/api/outreach/`
- `web/src/components/outreach/`
- `scraper/app/email_relay/`
- `scraper/app/personas/`
- `scraper/app/routers/email.py`

Outreach owns draft generation, consent filtering, Mailpit delivery, and the
simulated insurer personas. It must not write `threads.json` directly. After a
simulated reply, it calls the authenticated `POST /api/internal/crm/replies`
endpoint with an inbound message and optional risk flag; the CRM performs the
state transition and audit logging.

**Startup order:**

```
init-data (seeds ./data if empty, then exits)
    │
    ├── mailpit  (email sandbox)
    │
    ├── scraper  (FastAPI + APScheduler cron)
    │
    └── web      (Next.js + NextAuth)
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
| `AUTH_SECRET` | NextAuth signing secret — generate with `openssl rand -base64 32` |
| `DEEPSEEK_API_KEY` | DeepSeek API key from platform.deepseek.com (the AI layer uses the OpenAI-compatible DeepSeek API) |

All other variables (service URLs, Mailpit host, ports) are pre-set in `docker-compose.yml`.

> **Coming with the storage migration:** once the JSON → PostgreSQL migration lands, a
> `DATABASE_URL` is also required (a `postgres` service is added to `docker-compose.yml`).
> See `HANDOFF-postgres-migration.md`.

### `web/.env.local` — used when running web locally

Same `AUTH_SECRET` and `DEEPSEEK_API_KEY`. Pre-filled example at `web/.env.local.example`.

### `scraper/.env` — used when running scraper locally

Pre-filled example at `scraper/.env.example`.

---

## Resetting demo data

If you need to restore `./data` to the clean demo state:

```bash
./dev.sh seed
```

This copies `seed/*.json` into `data/` and clears the `.jsonl` logs. Safe to run at any time.

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
