#!/usr/bin/env bash
# Run VyroCoding with native VyroLang execution — no Docker.
# Uses Homebrew Postgres + Redis and runs the apps with pnpm.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d ../VyroLang/impl ]; then
  echo "error: expected the VyroLang repo at ../VyroLang (git clone it next to this repo)."
  exit 1
fi

# 1. Build the VyroVM ---------------------------------------------------------
echo "› Building the VyroVM (cargo release)…"
( cd ../VyroLang/impl && cargo build --release )
export VYRO_BIN="$(cd ../VyroLang/impl && pwd)/target/release/vyro"
export VYRO_TIMEOUT_MS="${VYRO_TIMEOUT_MS:-5000}"
echo "  VYRO_BIN=$VYRO_BIN"

# 2. Start Postgres + Redis via brew ------------------------------------------
PG_FORMULA="$(brew list --formula 2>/dev/null | grep -m1 '^postgresql@' || echo postgresql@16)"
echo "› Starting $PG_FORMULA and redis…"
brew services start "$PG_FORMULA" >/dev/null 2>&1 || true
brew services start redis >/dev/null 2>&1 || true

echo -n "  waiting for postgres"
for _ in $(seq 1 30); do pg_isready -h localhost -p 5432 >/dev/null 2>&1 && break; echo -n "."; sleep 1; done; echo
echo -n "  waiting for redis"
for _ in $(seq 1 30); do redis-cli ping >/dev/null 2>&1 && break; echo -n "."; sleep 1; done; echo

# 3. Create + migrate the database --------------------------------------------
DB_USER="$(whoami)"
export DATABASE_URL="postgresql://${DB_USER}@localhost:5432/vyro_coding"
export REDIS_URL="redis://localhost:6379"
echo "› Ensuring database vyro_coding exists…"
createdb vyro_coding 2>/dev/null && echo "  created." || echo "  already exists."
if ! psql -d vyro_coding -c '\dt' 2>/dev/null | grep -q problems; then
  echo "  loading schema…"
  psql -d vyro_coding -q -f apps/api/src/db/schema.sql
fi

# 4. App config ---------------------------------------------------------------
export NODE_ENV=development
export JWT_SECRET="${JWT_SECRET:-dev-jwt-secret-change-in-prod-minimum-32-chars-here}"
export CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:3002}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3003}"

# 5. Seed problems (best effort) ----------------------------------------------
echo "› Seeding problems (best effort)…"
( cd apps/api && npx tsx src/db/seed.ts >/dev/null 2>&1 && echo "  seeded." ) || echo "  seed skipped (already seeded or no seed)."

# 6. Launch -------------------------------------------------------------------
echo "› Starting API + Web + Collab (pnpm dev)…"
echo "  Web:  http://localhost:3002"
echo "  API:  http://localhost:3003"
echo "  Pick 'VyroLang (native VyroVM)' in the language dropdown."
exec pnpm dev
