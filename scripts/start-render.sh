#!/bin/sh
set -eu

# These are private ports inside the single-container topology. Do not allow a
# stale Render variable from the old multi-service setup to move one process
# away from the readiness checks or the Next.js rewrite compiled for :4000.
export API_PORT="4000"
export AI_SERVICE_URL="http://127.0.0.1:8001"
export API_INTERNAL_URL="http://127.0.0.1:4000"
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
  if [ -n "${web_pid:-}" ]; then
    kill "$web_pid" 2>/dev/null || true
  fi
  kill "$api_pid" "$ai_pid" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

wait_for_service() {
  service_name="$1"
  service_url="$2"
  service_pid="$3"
  attempt=1
  max_attempts=90

  while [ "$attempt" -le "$max_attempts" ]; do
    if ! kill -0 "$service_pid" 2>/dev/null; then
      echo "ERROR: $service_name exited before becoming ready" >&2
      wait "$service_pid"
      return 1
    fi
    if python3 -c 'import sys, urllib.request; urllib.request.urlopen(sys.argv[1], timeout=2).read()' "$service_url" >/dev/null 2>&1; then
      echo "$service_name is ready at $service_url"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  echo "ERROR: $service_name did not become ready within ${max_attempts}s" >&2
  return 1
}

wait_for_service "Python AI service" "http://127.0.0.1:8001/health" "$ai_pid"
wait_for_service "NestJS API" "http://127.0.0.1:4000/api/health" "$api_pid"

# The standalone Next.js server reads Render's PORT (normally 10000).
node apps/web/server.js &
web_pid=$!

# POSIX-compatible supervisor: never leave a broken backend behind a live web
# process, because Render health checks must represent the whole product.
while kill -0 "$web_pid" 2>/dev/null; do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    echo "ERROR: NestJS API stopped; terminating the container" >&2
    wait "$api_pid"
    exit 1
  fi
  if ! kill -0 "$ai_pid" 2>/dev/null; then
    echo "ERROR: Python AI service stopped; terminating the container" >&2
    wait "$ai_pid"
    exit 1
  fi
  sleep 2
done

wait "$web_pid"
