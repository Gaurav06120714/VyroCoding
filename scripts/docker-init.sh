#!/bin/bash
# =============================================================================
# VyroCoding — Docker Initialization Helper
# Usage: bash scripts/docker-init.sh
# =============================================================================
set -e

echo "VyroCoding Docker Setup"
echo "======================="
echo ""

# ── Check .env exists ─────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
  echo ""
  echo "WARNING: .env has placeholder values. Running secret generator..."
fi

# ── Generate secrets if placeholders still exist ──────────────────────────────
if grep -q "REPLACE_WITH_64_HEX_CHARS_FROM_CRYPTO_RANDOM" .env 2>/dev/null; then
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/REPLACE_WITH_64_HEX_CHARS_FROM_CRYPTO_RANDOM/$JWT_SECRET/" .env
  else
    sed -i "s/REPLACE_WITH_64_HEX_CHARS_FROM_CRYPTO_RANDOM/$JWT_SECRET/" .env
  fi
  echo "Generated JWT_SECRET"
fi

if grep -q "REPLACE_WITH_RANDOM_HEX_FOR_PRIVACY_PRESERVING_LOGS" .env 2>/dev/null; then
  IP_HASH_SALT=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/REPLACE_WITH_RANDOM_HEX_FOR_PRIVACY_PRESERVING_LOGS/$IP_HASH_SALT/" .env
  else
    sed -i "s/REPLACE_WITH_RANDOM_HEX_FOR_PRIVACY_PRESERVING_LOGS/$IP_HASH_SALT/" .env
  fi
  echo "Generated IP_HASH_SALT"
fi

echo ""

# ── Choose environment ────────────────────────────────────────────────────────
echo "Choose environment:"
echo "  1) Development (hot reload, ports exposed)"
echo "  2) Production  (optimized builds, internal network)"
echo ""
read -rp "Enter choice [1/2]: " choice

echo ""

if [ "$choice" = "1" ]; then
  echo "Starting development environment..."
  echo ""
  echo "Services:"
  echo "  Web:    http://localhost:3002"
  echo "  API:    http://localhost:3003"
  echo "  Collab: ws://localhost:1234"
  echo "  DB:     localhost:5432"
  echo "  Redis:  localhost:6379"
  echo ""
  docker compose -f docker-compose.dev.yml up --build
elif [ "$choice" = "2" ]; then
  echo "Starting production environment..."
  docker compose up -d --build
  echo ""
  echo "VyroCoding is running!"
  echo ""
  echo "Services:"
  echo "  Web:    http://localhost:3002"
  echo "  API:    http://localhost:3003"
  echo "  Collab: ws://localhost:1234"
  echo ""
  echo "Monitor: docker compose logs -f"
  echo "Stop:    docker compose down"
else
  echo "Invalid choice. Exiting."
  exit 1
fi
