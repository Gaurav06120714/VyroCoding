#!/bin/bash
# =============================================================================
# VyroCoding — PostgreSQL Backup Script
# Usage: bash scripts/db-backup.sh [compose-file]
# =============================================================================
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
COMPOSE_FILE="${1:-docker-compose.yml}"

mkdir -p "$BACKUP_DIR"

echo "Backing up PostgreSQL from $COMPOSE_FILE..."

docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-vyrocoding}" \
  "${POSTGRES_DB:-vyro_coding}" \
  | gzip > "$BACKUP_DIR/vyro_coding_$TIMESTAMP.sql.gz"

echo "Backup saved: $BACKUP_DIR/vyro_coding_$TIMESTAMP.sql.gz"

# Keep only last 10 backups to avoid disk bloat
BACKUP_COUNT=$(ls "$BACKUP_DIR"/vyro_coding_*.sql.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 10 ]; then
  ls -t "$BACKUP_DIR"/vyro_coding_*.sql.gz | tail -n +11 | xargs rm -f
  echo "Pruned old backups (kept 10 most recent)"
fi
