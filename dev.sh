#!/usr/bin/env bash
# dev.sh — single entry point for all development tasks
# Usage: ./dev.sh <command> [options]

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$ROOT/scraper/.venv"
cd "$ROOT"

# ── Colours ────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}▶ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $*${NC}"; }
error() { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

# ── Helpers ────────────────────────────────────────────────────────────────
require_venv() {
  [ -d "$VENV" ] || error "Python venv not found. Run: ./dev.sh setup"
}

require_env() {
  [ -f "$ROOT/.env" ] || error ".env not found. Run: ./dev.sh setup"
}

# ── Usage ──────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF

  Assura dev CLI

  DOCKER
    ./dev.sh up              Start web only (dev mode, hot reload; Free/basic use)
    ./dev.sh up --build      Start web only, rebuilding its image first
    ./dev.sh up-stripe       Start web + Stripe webhook forwarding for billing tests
    ./dev.sh up-stripe --build  Rebuild web, then start web + Stripe forwarding
    ./dev.sh up-premium      Start web + mail service + Mailpit for Premium demo
    ./dev.sh up-scraper      Start scraper independently (no web or mail required)
    ./dev.sh up-prod         Start the full production-built Premium demo
    ./dev.sh down            Stop everything
    ./dev.sh restart         down + up
    ./dev.sh build [svc]     Rebuild image(s)  svc: web | mail | scraper
    ./dev.sh logs  [svc]     Tail logs         svc: web | mail | mailpit | scraper

  LOCAL (single service, no Docker)
    ./dev.sh web             Run Next.js on :3000 (dev, hot-reload)
    ./dev.sh demo            Build + run Next.js in production (no live recompiling)
    ./dev.sh scraper         Run FastAPI on :8100
    ./dev.sh mailpit         Run Mailpit  SMTP :1025  UI :8025

  MIXED (infra in Docker, one service local)
    ./dev.sh infra           Start mail service + Mailpit in Docker (background)
    ./dev.sh infra-web       Start mail service + Mailpit in Docker, run web locally

  UTILITIES
    ./dev.sh seed            Reset configured database to seed state (destructive)
    ./dev.sh db:migrate      Apply Drizzle migrations
    ./dev.sh db:seed         Load seed data (RESET=1 truncates first)
    ./dev.sh test            Run scraper test suite (pytest)
    ./dev.sh test-mail       Run mail service test suite (pytest)
    ./dev.sh lint            Lint scraper/app with ruff
    ./dev.sh ci              Run all CI checks locally (web + scraper + mail)
    ./dev.sh setup           Prepare root .env for Docker
    ./dev.sh setup --local   Also create local env and install host dependencies

EOF
}

# ── Commands ───────────────────────────────────────────────────────────────
cmd_up() {
  require_env
  if [ "${1:-}" = "--build" ]; then
    info "Starting web only (with rebuild)..."
    docker compose up --build web
  else
    info "Starting web only..."
    docker compose up web
  fi
}

cmd_up_stripe() {
  require_env
  command -v stripe &>/dev/null || error "Stripe CLI not installed. Install it and retry (macOS: brew install stripe/stripe-cli/stripe)."
  if [ -n "${1:-}" ] && [ "$1" != "--build" ]; then
    error "Usage: ./dev.sh up-stripe [--build]"
  fi

  local stripe_key price_id webhook_secret stripe_listen_pid
  stripe_key="$(docker compose config --environment | awk -F= '$1 == "STRIPE_SECRET_KEY" { sub(/^[^=]*=/, ""); print; exit }')"
  price_id="$(docker compose config --environment | awk -F= '$1 == "STRIPE_PRICE_ID" { sub(/^[^=]*=/, ""); print; exit }')"

  case "$stripe_key" in
    sk_test_*) ;;
    *) error "Set STRIPE_SECRET_KEY to a Stripe test secret (sk_test_...) in .env." ;;
  esac
  case "$price_id" in
    price_*) ;;
    *) error "Set STRIPE_PRICE_ID to a recurring test Price ID (price_...) in .env." ;;
  esac

  info "Getting the local Stripe webhook signing secret..."
  if ! webhook_secret="$(STRIPE_API_KEY="$stripe_key" stripe listen --print-secret)"; then
    error "Could not get a webhook secret. Check that the Stripe CLI can authenticate with this test key."
  fi
  case "$webhook_secret" in
    whsec_*) ;;
    *) error "Stripe CLI did not return a valid webhook signing secret." ;;
  esac

  local -a compose_args
  compose_args=(up)
  if [ "${1:-}" = "--build" ]; then
    compose_args+=(--build)
  fi
  compose_args+=(web)

  info "Starting Stripe webhook forwarding to http://localhost:3000/api/stripe/webhook..."
  STRIPE_API_KEY="$stripe_key" stripe listen \
    --events=customer.subscription.created,customer.subscription.updated,customer.subscription.deleted \
    --forward-to http://localhost:3000/api/stripe/webhook &
  stripe_listen_pid=$!
  trap "kill $stripe_listen_pid 2>/dev/null || true; wait $stripe_listen_pid 2>/dev/null || true" EXIT

  info "Starting web with the Stripe CLI webhook secret..."
  STRIPE_WEBHOOK_SECRET="$webhook_secret" docker compose "${compose_args[@]}"
}

cmd_up_premium() {
  require_env
  if [ "${1:-}" = "--build" ]; then
    info "Starting web, mail service, and Mailpit for the Premium demo (with rebuild)..."
    docker compose up --build web mail mailpit
  else
    info "Starting web, mail service, and Mailpit for the Premium demo..."
    docker compose up web mail mailpit
  fi
}

cmd_up_scraper() {
  require_env
  info "Starting scraper independently..."
  docker compose up scraper
}

cmd_up_prod() {
  # Whole stack in Docker with the web app BUILT (production) — no live
  # recompiling. Uses the prod override which swaps web to Dockerfile.prod.
  require_env
  info "Starting production web, mail service, and Mailpit (building images)..."
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build web mail mailpit
}

cmd_down() {
  info "Stopping all services..."
  docker compose down
}

cmd_restart() {
  cmd_down
  cmd_up "${@}"
}

cmd_build() {
  info "Building ${1:-all} image(s)..."
  docker compose build ${1:-}
}

cmd_logs() {
  docker compose logs -f ${1:-}
}

cmd_web() {
  info "Starting Next.js on :3000..."
  cd "$ROOT/web"
  npm run dev
}

cmd_demo() {
  # Production mode for the demo: build once, then `next start` — NO on-demand
  # compiling (unlike `next dev`), so no "Compiling..." pauses while presenting.
  #
  # Env: uses the SAME root .env you already fill in for Docker. We export its
  # values into the environment so Next.js picks them up directly (process env
  # beats .env.local), so there's just ONE env file to maintain.
  require_env
  info "Loading env from root .env..."
  set -a                       # auto-export everything sourced
  # shellcheck disable=SC1090
  . "$ROOT/.env"
  set +a
  cd "$ROOT/web"
  info "Building web for production (one-time)..."
  npm run build
  info "Starting Next.js (production) on :3000 — no live recompiling..."
  npm run start
}

cmd_scraper() {
  require_venv
  info "Starting FastAPI scraper on :8100..."
  cd "$ROOT/scraper"
  "$VENV/bin/uvicorn" app.main:app --port 8100 --reload
}

cmd_mailpit() {
  command -v mailpit &>/dev/null || error "mailpit not installed. Run: brew install mailpit"
  info "Starting Mailpit  SMTP :1025  UI :8025..."
  mailpit
}

cmd_infra() {
  require_env
  info "Starting mail service + Mailpit in Docker (background)..."
  WEB_BASE_URL=http://host.docker.internal:3000 docker compose up -d mail mailpit
  echo ""
  echo "  Mailpit UI  → http://localhost:8025"
  echo "  Mail API    → http://localhost:8200"
  echo ""
  info "Now run web locally:  ./dev.sh web"
}

cmd_infra_web() {
  require_env
  info "Starting mail service + Mailpit in Docker (background)..."
  WEB_BASE_URL=http://host.docker.internal:3000 docker compose up -d mail mailpit
  info "Starting Next.js locally..."
  cd "$ROOT/web"
  npm run dev
}

cmd_seed() {
  require_env
  warn "This will truncate the configured database and restore demo seed data."
  info "Resetting database to seed state..."
  docker compose run --rm db-migrate sh -c \
    'npm run db:migrate && RESET=1 npm run db:seed && npm run db:seed-auth'
  info "Done."
}

cmd_db_migrate() {
  info "Applying Drizzle migrations..."
  cd "$ROOT/web" && npx tsx src/lib/migrate.ts
}

cmd_db_seed() {
  info "Loading seed data..."
  cd "$ROOT/web" && npx tsx src/lib/seed.ts
}

cmd_test() {
  require_venv
  info "Running scraper test suite..."
  cd "$ROOT/scraper"
  "$VENV/bin/pytest" -v
}

cmd_test_mail() {
  require_venv
  info "Running mail service test suite..."
  cd "$ROOT/mail-service"
  "$VENV/bin/python" -m pytest -v
}

cmd_lint() {
  require_venv
  info "Linting scraper/app..."
  cd "$ROOT/scraper"
  "$VENV/bin/ruff" check app/
}

cmd_ci() {
  # Mirror the GitHub Actions CI locally (useful before pushing).
  require_venv
  info "web: build..."
  (cd "$ROOT/web" && npm run build)
  info "web: lint..."
  (cd "$ROOT/web" && npm run lint) || warn "web lint has errors (non-blocking)"
  info "web: test..."
  if (cd "$ROOT/web" && npm run | grep -qE '^  test'); then
    (cd "$ROOT/web" && npm test)
  else
    echo "  no web 'test' script yet — skipping."
  fi
  info "scraper: lint (ruff)..."
  (cd "$ROOT/scraper" && "$VENV/bin/ruff" check app/)
  info "scraper: test (pytest)..."
  (cd "$ROOT/scraper" && "$VENV/bin/pytest" -v)
  info "mail service: test (pytest)..."
  (cd "$ROOT/mail-service" && "$VENV/bin/python" -m pytest -v)
  info "CI checks passed."
}

cmd_setup() {
  case "${1:-}" in
    ""|--local) ;;
    *) error "Usage: ./dev.sh setup [--local]" ;;
  esac

  info "Running first-time setup..."

  # ── Root .env ────────────────────────────────────────────────
  if [ ! -f "$ROOT/.env" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    warn ".env created — configure Supabase, DATABASE_URL, and DEEPSEEK_API_KEY before Docker startup."
  else
    echo "  .env already exists, skipping."
  fi

  if [ "${1:-}" != "--local" ]; then
    echo ""
    echo "  Configure Supabase, DATABASE_URL, and DEEPSEEK_API_KEY in .env."
    echo "  Then run: ./dev.sh up-prod"
    echo "  For Stripe billing tests: add STRIPE_SECRET_KEY and STRIPE_PRICE_ID, then run ./dev.sh up-stripe"
    echo "  For host-based development dependencies, run: ./dev.sh setup --local"
    return
  fi

  # ── web/.env.local ───────────────────────────────────────────
  if [ ! -f "$ROOT/web/.env.local" ]; then
    cp "$ROOT/web/.env.local.example" "$ROOT/web/.env.local"
    warn "web/.env.local created — configure Supabase, DATABASE_URL, and DEEPSEEK_API_KEY for local dev."
  else
    echo "  web/.env.local already exists, skipping."
  fi

  # ── Python venv + deps (uv) ──────────────────────────────────
  command -v uv &>/dev/null || error "uv not installed. Install: curl -LsSf https://astral.sh/uv/install.sh | sh  (or: brew install uv)"
  if [ ! -d "$VENV" ]; then
    info "Creating Python venv (uv)..."
    uv venv "$VENV" --python 3.11
  else
    echo "  Venv already exists, skipping."
  fi
  info "Installing scraper dependencies (uv)..."
  VIRTUAL_ENV="$VENV" uv pip install -e "$ROOT/scraper/.[dev]" -q
  info "Installing mail service test dependencies (uv)..."
  VIRTUAL_ENV="$VENV" uv pip install -r "$ROOT/mail-service/requirements.txt" -q
  info "Installing Playwright browser..."
  "$VENV/bin/playwright" install chromium

  # ── Node deps ────────────────────────────────────────────────
  info "Installing web dependencies..."
  cd "$ROOT/web" && npm install --silent

  echo ""
  echo -e "${GREEN}Setup complete.${NC}"
  echo ""
  echo "  Next steps:"
  echo "  1. Configure .env: Supabase URL/keys, DATABASE_URL, and DEEPSEEK_API_KEY"
  echo "  2. ./dev.sh up          ← web only (Free/basic use; hot reload)"
  echo "     ./dev.sh up-premium  ← web + mail service + Mailpit"
  echo "     ./dev.sh up-stripe   ← web + Stripe CLI webhook forwarding"
  echo "     ./dev.sh up-prod     ← full production-built Premium demo"
  echo ""
}

# ── Router ─────────────────────────────────────────────────────────────────
case "${1:-}" in
  up)          cmd_up "${2:-}" ;;
  up-stripe)   cmd_up_stripe "${2:-}" ;;
  up-premium)  cmd_up_premium "${2:-}" ;;
  up-scraper)  cmd_up_scraper ;;
  up-prod)     cmd_up_prod ;;
  down)        cmd_down ;;
  restart)     cmd_restart "${2:-}" ;;
  build)       cmd_build "${2:-}" ;;
  logs)        cmd_logs "${2:-}" ;;
  web)         cmd_web ;;
  demo)        cmd_demo ;;
  scraper)     cmd_scraper ;;
  mailpit)     cmd_mailpit ;;
  infra)       cmd_infra ;;
  infra-web)   cmd_infra_web ;;
  seed)        cmd_seed ;;
  db:migrate)  cmd_db_migrate ;;
  db:seed)     cmd_db_seed ;;
  test)        cmd_test ;;
  test-mail)   cmd_test_mail ;;
  lint)        cmd_lint ;;
  ci)          cmd_ci ;;
  setup)       cmd_setup "${2:-}" ;;
  help|--help) usage ;;
  *)           usage; exit 1 ;;
esac
