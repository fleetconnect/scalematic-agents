#!/usr/bin/env bash
# Production entrypoint for the compiled backend, used by launchd (which has no shell PATH
# and does not source start.sh). Preserves the empty-ANTHROPIC_API_KEY guard.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/Users/fleetconnect/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:${PATH:-}"
export NODE_ENV=production

# A present-but-empty ANTHROPIC_API_KEY would shadow the real value in .env, because
# dotenv never overrides an already-set variable. Drop the empty export; respect a real one.
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  unset ANTHROPIC_API_KEY
fi

if [ ! -f dist/index.js ]; then
  echo "[start-prod] ERROR: dist/index.js missing — run 'npx tsc' first" >&2
  exit 1
fi

exec node dist/index.js
