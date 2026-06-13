#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# A present-but-empty ANTHROPIC_API_KEY in the shell would shadow the real value in
# .env, because dotenv never overrides an already-set process.env variable. Drop the
# empty export so the configured key loads. A non-empty value is left untouched.
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  unset ANTHROPIC_API_KEY
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo ""
echo "  ScaleMatic Autonomous Agent System"
echo "  API → http://localhost:3100/api"
echo ""

npx ts-node-dev --respawn --transpile-only src/index.ts
