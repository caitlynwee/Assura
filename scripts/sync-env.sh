#!/usr/bin/env bash
# sync-env.sh — keep .env and .env.example structurally in sync (keys), without
# ever touching your filled-in secret VALUES in .env.
#
#   .env.example  = committed template: every key the app uses, NO secret values.
#   .env          = your local file: same keys, filled with real credentials.
#
# This script compares the two by KEY and reconciles structure only:
#   • keys in .env.example but missing from .env   → appended to .env (empty)
#   • keys in .env but missing from .env.example   → appended to .env.example
#       (value blanked — the template must never contain a real secret)
#   • keys present in both                         → left untouched (values kept)
#
# Your existing .env values are NEVER overwritten or deleted. Removing a key is
# intentionally manual (delete it from both files yourself) so a stray edit can
# never wipe a credential.
#
# Usage:
#   ./dev.sh env            Sync both files (safe; additive only)
#   ./dev.sh env --check    Report drift only; make NO changes (exit 1 if drift)
#   ./dev.sh env --help     Show this help

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
EXAMPLE_FILE="$ROOT/.env.example"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; DIM='\033[2m'; NC='\033[0m'

MODE="sync"
case "${1:-}" in
  --check) MODE="check" ;;
  --help|-h)
    sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  "" ) ;;
  * ) echo "Unknown option: $1 (try --check or --help)"; exit 1 ;;
esac

[ -f "$EXAMPLE_FILE" ] || { echo -e "${RED}✗ .env.example not found at $EXAMPLE_FILE${NC}"; exit 1; }

# If .env is missing, seed it from the template (keys only, empty values).
if [ ! -f "$ENV_FILE" ]; then
  if [ "$MODE" = "check" ]; then
    echo -e "${RED}✗ .env does not exist.${NC} Run './dev.sh env' to create it from the template."
    exit 1
  fi
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  echo -e "${GREEN}▶ Created .env from .env.example. Fill in your credentials.${NC}"
fi

# Extract the set of KEY names (lines like FOO=...) from a file.
keys_of() {
  grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "$1" 2>/dev/null | sed 's/=$//' | sort -u
}

missing_in_env="$(comm -23 <(keys_of "$EXAMPLE_FILE") <(keys_of "$ENV_FILE") || true)"
missing_in_example="$(comm -13 <(keys_of "$EXAMPLE_FILE") <(keys_of "$ENV_FILE") || true)"

drift=0

if [ -n "$missing_in_env" ]; then
  drift=1
  echo -e "${YELLOW}Keys in .env.example but missing from .env:${NC}"
  echo "$missing_in_env" | sed 's/^/  + /'
fi

if [ -n "$missing_in_example" ]; then
  drift=1
  echo -e "${YELLOW}Keys in .env but not documented in .env.example:${NC}"
  echo "$missing_in_example" | sed 's/^/  ~ /'
fi

if [ "$drift" -eq 0 ]; then
  echo -e "${GREEN}✓ .env and .env.example keys are in sync.${NC}"
  exit 0
fi

if [ "$MODE" = "check" ]; then
  echo -e "${RED}✗ Drift detected (see above). Run './dev.sh env' to reconcile.${NC}"
  exit 1
fi

# ── Apply (sync mode) ────────────────────────────────────────────────────────
# Append template keys missing from .env (empty values — you fill them).
if [ -n "$missing_in_env" ]; then
  {
    echo ""
    echo "# ── Added by ./dev.sh env (fill in values) ──"
    while IFS= read -r key; do [ -n "$key" ] && echo "${key}="; done <<< "$missing_in_env"
  } >> "$ENV_FILE"
  echo -e "${GREEN}▶ Added $(echo "$missing_in_env" | grep -c .) key(s) to .env — fill in their values.${NC}"
fi

# Append .env-only keys to the template with BLANK values (never copy secrets).
if [ -n "$missing_in_example" ]; then
  {
    echo ""
    echo "# ── Added by ./dev.sh env (document new keys; values stay in .env) ──"
    while IFS= read -r key; do [ -n "$key" ] && echo "${key}="; done <<< "$missing_in_example"
  } >> "$EXAMPLE_FILE"
  echo -e "${GREEN}▶ Documented $(echo "$missing_in_example" | grep -c .) key(s) in .env.example (blank values).${NC}"
  echo -e "${DIM}  Review .env.example and move the new keys into the right section / add comments.${NC}"
fi

echo -e "${GREEN}✓ Sync complete. Your existing .env values were not modified.${NC}"
