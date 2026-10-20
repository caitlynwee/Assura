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

The app uses Supabase for authentication and PostgreSQL, and DeepSeek for AI features. Configure the Supabase values, `DATABASE_URL`, and `DEEPSEEK_API_KEY` in the root `.env` before starting Docker.
The web, mail service, and scraper use small database connection pools for
Supabase's limited session-mode pool. For larger deployments, use Supabase's
transaction-mode pooler URL as recommended by Supabase.

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
./dev.sh up-stripe       # web + mail + Mailpit + Dockerized Stripe CLI
./dev.sh up-stripe --build # rebuild app images, then start the full billing demo
./dev.sh up-premium      # web + isolated mail service + Mailpit for Premium outreach demo
./dev.sh up-scraper      # scraper only, independent from web and mail
./dev.sh up-prod         # full production-built Premium demo
./dev.sh down            # stop all Assura services
```

The basic web app does not need the scraper, mail service, or Mailpit. `up`
starts only the web service and its required one-shot migration/seeding job.
Premium outreach uses the dedicated mail service and Mailpit; it does not
start the scraper. The scraper is an independent service, started only when
you need plan discovery or brochure scraping. All three services share the
configured PostgreSQL database. First startup builds images and runs database
migrations/seeding.

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
# Working on web locally? Run the mail service + Mailpit in Docker, web locally:
./dev.sh infra           # starts mail service + Mailpit in Docker (background)
./dev.sh web             # run web locally in this terminal

# Working on the scraper? Run scraper independently:
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
./dev.sh up-stripe       Start full billing demo (Stripe CLI runs in Docker)
./dev.sh up-stripe --build  Rebuild app images, then start billing demo
./dev.sh up-premium      Start web + mail service + Mailpit for Premium demo
./dev.sh up-scraper      Start the scraper independently
./dev.sh up-prod         Start full production-built Premium demo (recommended)
./dev.sh down            Stop all services
./dev.sh restart         Stop + start
./dev.sh build web       Rebuild one image (web or scraper)
./dev.sh logs            Tail all logs
./dev.sh logs web        Tail logs for one service

./dev.sh web             Run Next.js locally
./dev.sh scraper         Run FastAPI locally
./dev.sh mailpit         Run Mailpit locally
./dev.sh infra           Start mail service + Mailpit in Docker (background)

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
| Scraper API (when started) | http://localhost:8100 |
| Scraper API docs | http://localhost:8100/docs |
| Mail service (Premium) | http://localhost:8200 |
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
┌─────────────────────────── docker compose network ───────────────────────────┐
│                                                                              │
│   web (Next.js :3000) ── authenticated HTTP ── mail (FastAPI :8200)          │
│                                                        │                     │
│                                                        └── Mailpit :1025     │
│                                                                              │
│   scraper (FastAPI :8100)  [independent; starts only when requested]         │
│                                                                              │
│   web + mail + scraper ───────── Supabase PostgreSQL (DATABASE_URL)         │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Repo layout:**

```
/
├── web/          Next.js 16 (App Router) — frontend + all API routes
├── scraper/      Python FastAPI — independent plan and brochure scraper
├── mail-service/ Python FastAPI — Premium email relay and simulated replies
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
- `mail-service/app/`

Outreach owns draft generation, consent filtering, and the authenticated
handoff to the isolated mail service. The mail service sends only to the
local Mailpit sandbox, simulates insurer personas, and reads thread context;
it does not write CRM state. After a simulated reply, it calls the
authenticated `POST /api/internal/crm/replies` endpoint with an inbound
message and optional risk flag; the CRM performs the state transition and
audit logging.

**Startup order:**

```
db-migrate (applies migrations + seeds the database, then exits)
    │
    └── web      (Next.js + Supabase Auth)

Premium profile:
    ├── mailpit  (email sandbox)
    └── mail     (isolated FastAPI mail service)

Scraper profile:
    └── scraper  (FastAPI + APScheduler cron; no mail dependency)
```

---

## Team ownership

| Person | Area | Key files |
|---|---|---|
| **Dominic** | Web frontend & auth | `web/src/app/`, `web/src/components/`, `web/src/middleware.ts` |
| **Marcus** | Scraper & data pipeline | `scraper/app/scraper/`, `scraper/app/routers/`, PostgreSQL source records |
| **Jeff** | AI agent, outreach & CRM | `web/src/app/(app)/outreach/`, `web/src/app/(app)/crm/`, `mail-service/app/` |
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
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase secret key used for demo identity seeding and syncing paid tier claims |
| `DEEPSEEK_API_KEY` | DeepSeek API key from platform.deepseek.com (the AI layer uses the OpenAI-compatible DeepSeek API) |
| `STRIPE_SECRET_KEY` | Stripe test-mode secret key (`sk_test_...`); live keys are rejected |
| `STRIPE_PRICE_ID` | Recurring Stripe test Price ID for the Premium subscription |
| `STRIPE_WEBHOOK_SECRET` | Stripe CLI or test endpoint webhook signing secret |

`INTERNAL_API_SECRET` is shared by the web app and mail service for their
internal API calls; change it from the demo default for non-demo environments.
Mail service delivery is restricted in code to Mailpit hostnames on SMTP port
1025. It does not accept external SMTP credentials.

### Stripe test billing

Premium upgrades use Stripe Checkout in test mode. Create a recurring SGD
product price in the Stripe test dashboard, then set its `price_...` ID as
`STRIPE_PRICE_ID`. Set `STRIPE_SECRET_KEY` to an `sk_test_...` key and keep
`STRIPE_WEBHOOK_SECRET` server-side. The webhook endpoint is
`/api/stripe/webhook`. Configure the Stripe Customer Portal in the test
dashboard so users can manage or cancel their subscription.
Subscription changes are applied only from verified webhook events; returning
from Checkout by itself does not grant Premium. After Checkout, Assura refreshes
the Supabase session so edge route gating sees the webhook-synchronized tier;
if the webhook is still processing, the upgrade page offers a safe retry.
The seeded shared demo account remains Premium without payment. New accounts
start on Free and upgrade through Stripe. Live billing is intentionally
unavailable until explicitly enabled in code and separately configured.

For a single-command local billing test, configure `STRIPE_SECRET_KEY` and
`STRIPE_PRICE_ID` in the root `.env`, then run
`./dev.sh up-stripe`. This one command starts the web app, Premium mail service,
Mailpit, and Stripe webhook forwarding using the Stripe CLI Docker image (no
Stripe CLI installation on the host is required; Docker pulls the image if
needed). It uses the test secret key to obtain the local webhook signing
secret, then passes that secret directly to the web container for this run.
You do not need to copy the CLI-generated secret into `.env` when using this
command. Add `--build` to rebuild the app images first.
The independent scraper and the configured Supabase/PostgreSQL service are not
started by this command; Supabase credentials and `DATABASE_URL` must already
be configured in `.env`. The regular `./dev.sh up` command does not start
Stripe CLI; if you use it for billing tests, configure `STRIPE_WEBHOOK_SECRET`
yourself. For an externally hosted webhook endpoint, configure Stripe to send
`customer.subscription.created`, `customer.subscription.updated`, and
`customer.subscription.deleted` to the app's webhook URL and use that
endpoint's signing secret.

### `web/.env.local` — used when running web locally

Set the Supabase URL/keys (including the server-only service-role key),
`DATABASE_URL`, `DEEPSEEK_API_KEY`, and Stripe test values. The example file
is `web/.env.local.example`.

### `scraper/.env` — used when running scraper locally

Pre-filled example at `scraper/.env.example`.

### `MAIL_SERVICE_URL` — used when running web locally

Set to `http://localhost:8200` in `web/.env.local.example`. Start the mail
service and Mailpit using `./dev.sh infra` before testing Premium outreach
from a locally running web app.

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

# Isolated mail service — local-only Mailpit delivery and internal API auth
./dev.sh test-mail

# Lint scraper code
./dev.sh lint
```

Web unit tests (policy engine, blocker, audit) are in `web/src/__tests__/` — run with `cd web && npm test`
(the `test` script is added by the storage-migration branch).

Run the full CI suite locally (web build/lint/test + scraper lint/test + mail-service tests) with `./dev.sh ci`.

---

## Rebuilding after dependency changes

```bash
# Added a new npm package?
./dev.sh build web

# Added a new Python package to the scraper (declared in scraper/pyproject.toml)?
./dev.sh build scraper

# Added a dependency to mail-service/requirements.txt?
docker compose build mail
```

Then `./dev.sh up` to restart.
