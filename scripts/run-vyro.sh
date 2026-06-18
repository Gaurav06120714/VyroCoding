#!/usr/bin/env bash
# Build the VyroVM and launch the full VyroCoding stack with VyroLang execution.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d ../VyroLang/impl ]; then
  echo "error: expected the VyroLang repo next to this one (../VyroLang/impl)."
  echo "       git clone https://github.com/Gaurav06120714/VyroLang.git ../VyroLang"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker isn't installed. Use the no-Docker path instead:"
  echo "  pnpm vyro:up:native        (Homebrew Postgres + Redis + pnpm dev)"
  echo "or install Docker Desktop: https://www.docker.com/products/docker-desktop/"
  exit 1
fi

echo "Building the VyroVM and starting the stack (Postgres, Redis, API, Web, Collab)…"
docker compose -f docker-compose.dev.yml -f docker-compose.vyro.yml up --build -d

echo "Waiting for the web app on http://localhost:3002 …"
for _ in $(seq 1 90); do
  if curl -sf http://localhost:3002 >/dev/null 2>&1; then
    echo
    echo "  ✓ VyroCoding is up:  http://localhost:3002"
    echo "    Pick 'VyroLang (native VyroVM)' in the language dropdown, write code, and Run."
    command -v open >/dev/null 2>&1 && open http://localhost:3002 || true
    exit 0
  fi
  sleep 2
done

echo "Web app did not respond in time. Check logs with:"
echo "  docker compose -f docker-compose.dev.yml -f docker-compose.vyro.yml logs -f"
exit 1
