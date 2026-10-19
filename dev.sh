#!/usr/bin/env bash
# dev.sh — single entry point for all development tasks
# Usage: ./dev.sh <command> [options]

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$ROOT/scraper/.venv"

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

  DOCKER (all services together)
    ./dev.sh up              Start everything  (docker compose up, dev/hot-reload web)
    ./dev.sh up --build      Start everything, rebuild images first
    ./dev.sh up-prod         Start everything in Docker, web BUILT (no recompiling)
    ./dev.sh down            Stop everything
    ./dev.sh restart         down + up
    ./dev.sh build [svc]     Rebuild image(s)  svc: web | scraper
    ./dev.sh logs  [svc]     Tail logs         svc: web | scraper | mailpit

  LOCAL (single service, no Docker)
    ./dev.sh web             Run Next.js on :3000 (dev, hot-reload)
    ./dev.sh demo            Build + run Next.js in production (no live recompiling)
    ./dev.sh scraper         Run FastAPI on :8100
    ./dev.sh mailpit         Run Mailpit  SMTP :1025  UI :8025

  MIXED (infra in Docker, one service local)
    ./dev.sh infra           Start mailpit + scraper in Docker (background)
    ./dev.sh infra-web       Start mailpit in Docker, run web locally

  UTILITIES
    ./dev.sh seed            Reset database to seed state (needs DATABASE_URL)
    ./dev.sh db:migrate      Apply Drizzle migrations
    ./dev.sh db:seed         Load seed data (RESET=1 truncates first)
    ./dev.sh test            Run scraper test suite (pytest)
    ./dev.sh lint            Lint scraper/app with ruff
    ./dev.sh ci              Run all CI checks locally (web + scraper)
    ./dev.sh setup           First-time setup (uv venv, deps, .env files, seed)

EOF
}

# ── Commands ───────────────────────────────────────────────────────────────
cmd_up() {
  require_env
  if [ "${1:-}" = "--build" ]; then
    info "Starting all services (with rebuild)..."
    docker compose up --build
  else
    info "Starting all services..."
    docker compose up
  fi
}

cmd_up_prod() {
  # Whole stack in Docker with the web app BUILT (production) — no live
  # recompiling. Uses the prod override which swaps web to Dockerfile.prod.
  require_env
  info "Starting all services with PRODUCTION web (building image)..."
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
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
  info "Starting mailpit + scraper in Docker (background)..."
  docker compose up -d mailpit scraper
  echo ""
  echo "  Mailpit UI  → http://localhost:8025"
  echo "  Scraper     → http://localhost:8100"
  echo ""
  info "Now run web locally:  ./dev.sh web"
}

cmd_infra_web() {
  require_env
  info "Starting mailpit in Docker (background)..."
  docker compose up -d mailpit
  info "Starting Next.js locally..."
  cd "$ROOT/web"
  npm run dev
}

cmd_seed() {
  info "Resetting database to seed state..."
  bash "$ROOT/seed/reset.sh"
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
  info "CI checks passed."
}

cmd_setup() {
  info "Running first-time setup..."

  # ── Root .env ────────────────────────────────────────────────
  if [ ! -f "$ROOT/.env" ]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    warn ".env created — fill in AUTH_SECRET and DEEPSEEK_API_KEY before running docker."
  else
    echo "  .env already exists, skipping."
  fi

  # ── web/.env.local ───────────────────────────────────────────
  if [ ! -f "$ROOT/web/.env.local" ]; then
    cp "$ROOT/web/.env.local.example" "$ROOT/web/.env.local"
    warn "web/.env.local created — fill in AUTH_SECRET and DEEPSEEK_API_KEY for local dev."
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

  # ── Node deps ────────────────────────────────────────────────
  info "Installing web dependencies..."
  cd "$ROOT/web" && npm install --silent

  echo ""
  echo -e "${GREEN}Setup complete.${NC}"
  echo ""
  echo "  Next steps:"
  echo "  1. Edit .env  (AUTH_SECRET + DEEPSEEK_API_KEY)"
  echo "  2. ./dev.sh up          ← Docker (all services)"
  echo "     ./dev.sh web         ← local web only"
  echo ""
}

# ── Router ─────────────────────────────────────────────────────────────────
case "${1:-}" in
  up)          cmd_up "${2:-}" ;;
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
  lint)        cmd_lint ;;
  ci)          cmd_ci ;;
  setup)       cmd_setup ;;
  help|--help) usage ;;
  *)           usage; exit 1 ;;
esac
