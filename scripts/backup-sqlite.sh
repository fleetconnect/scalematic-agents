#!/usr/bin/env bash
# Online, consistent backup of the canonical SQLite runtime store using sqlite3's
# .backup command (WAL-safe; does not require stopping the server). Backups are written
# OUTSIDE the repository and are never tracked by Git. Retains the most recent N copies.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${SCALEMATIC_DB:-$ROOT/data/scalematic.db}"
BACKUP_DIR="${SCALEMATIC_BACKUP_DIR:-$HOME/ScaleMatic-Backups/sqlite}"
RETENTION="${SCALEMATIC_BACKUP_RETENTION:-14}"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB" ]; then
  echo "[backup-sqlite] ERROR: database not found at $DB" >&2
  exit 1
fi

TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/scalematic-$TS.db"

# Online backup via VACUUM INTO: produces a single, compacted, self-contained file
# with no -wal/-shm sidecars (safe while the app holds the DB open in WAL mode).
sqlite3 "$DB" "VACUUM INTO '$OUT'"

# Verify the backup is non-empty and passes an integrity check before trusting it.
if [ ! -s "$OUT" ]; then
  echo "[backup-sqlite] ERROR: backup is empty: $OUT" >&2
  rm -f "$OUT"
  exit 1
fi

CHECK="$(sqlite3 "$OUT" 'PRAGMA integrity_check;' | head -1)"
if [ "$CHECK" != "ok" ]; then
  echo "[backup-sqlite] ERROR: integrity check failed ($CHECK) for $OUT" >&2
  rm -f "$OUT"
  exit 1
fi

SIZE="$(du -h "$OUT" | cut -f1)"
echo "[backup-sqlite] OK: $OUT ($SIZE, integrity=$CHECK)"

# Retention: keep the most recent N, delete older ones.
COUNT="$(ls -1t "$BACKUP_DIR"/scalematic-*.db 2>/dev/null | wc -l | tr -d ' ')"
if [ "$COUNT" -gt "$RETENTION" ]; then
  ls -1t "$BACKUP_DIR"/scalematic-*.db | tail -n +"$((RETENTION + 1))" | while read -r old; do
    rm -f "$old"
    echo "[backup-sqlite] pruned old backup: $(basename "$old")"
  done
fi

echo "[backup-sqlite] retained $(ls -1 "$BACKUP_DIR"/scalematic-*.db 2>/dev/null | wc -l | tr -d ' ') backup(s) in $BACKUP_DIR"
