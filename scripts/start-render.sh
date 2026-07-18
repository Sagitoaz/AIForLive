#!/bin/sh
set -eu

export API_PORT="${API_PORT:-4000}"
export AI_SERVICE_URL="${AI_SERVICE_URL:-http://127.0.0.1:8001}"
export API_INTERNAL_URL="${API_INTERNAL_URL:-http://127.0.0.1:4000}"
export HOSTNAME="0.0.0.0"

# `migrate deploy` is idempotent: it applies reviewed migrations only and never
# inserts demo/seed data.
./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma

uvicorn app.main:app \
  --app-dir apps/ai-service \
  --host 127.0.0.1 \
  --port 8001 &
ai_pid=$!

node dist/main.js &
api_pid=$!

cleanup() {
  kill "$api_pid" "$ai_pid" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# The standalone Next.js server reads Render's PORT (normally 10000).
node apps/web/server.js
