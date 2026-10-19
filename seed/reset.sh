#!/usr/bin/env bash
# reset.sh — Copies seed data into /data and creates required directories.
# Run from any directory; script resolves paths relative to its own location.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$REPO_ROOT/data"

echo "Resetting data directory at $DATA_DIR ..."

# Create data directory structure
mkdir -p "$DATA_DIR/versions"

# Copy seed JSON files
cp "$SCRIPT_DIR/insurers.json"  "$DATA_DIR/insurers.json"
cp "$SCRIPT_DIR/users.json"     "$DATA_DIR/users.json"
cp "$SCRIPT_DIR/plans.json"     "$DATA_DIR/plans.json"
cp "$SCRIPT_DIR/sources.json"   "$DATA_DIR/sources.json"
cp "$SCRIPT_DIR/threads.json"   "$DATA_DIR/threads.json"

# Reset append-only log files (empty)
> "$DATA_DIR/audit.jsonl"
> "$DATA_DIR/scraper_runs.jsonl"

# Ensure .gitkeep files exist so git tracks empty dirs
touch "$DATA_DIR/.gitkeep"
touch "$DATA_DIR/versions/.gitkeep"

echo "Done. Data reset to seed state."
