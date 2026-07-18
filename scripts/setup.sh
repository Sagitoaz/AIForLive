#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo "Node.js 20.9+ is required"; exit 1; }
command -v npm >/dev/null || { echo "npm is required"; exit 1; }
command -v python3 >/dev/null || { echo "Python 3.11+ is required"; exit 1; }
command -v docker >/dev/null || { echo "Docker is required"; exit 1; }
[ -f .env ] || cp .env.example .env
npm install
npm run ai:install
docker compose up -d postgres
npm run db:setup
npm run ai:data
[ -f apps/ai-service/ml/artifacts/next_attempt_model.joblib ] || npm run ai:train
npm run db:seed
npm run validate:assets
echo "Setup complete. Run: npm run dev"
