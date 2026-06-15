#!/usr/bin/env bash
# Lightweight health monitor + log rotation, run on a short interval by launchd.
# Records a one-line health snapshot and rotates supervised logs when oversized.
# It does NOT restart services (launchd KeepAlive owns restarts) — it observes and records.
set -uo pipefail

LOG_DIR="$HOME/Library/Logs/scalematic"
HEALTH_LOG="$LOG_DIR/health.log"
ROTATE_BYTES=${SCALEMATIC_LOG_MAX_BYTES:-5242880}   # 5 MB
KEEP=${SCALEMATIC_LOG_KEEP:-3}
mkdir -p "$LOG_DIR"

code() { curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$1" 2>/dev/null; }

BACKEND=$(code http://localhost:3100/api/health)
FRONTEND=$(code http://localhost:4100)
VAULT=$(curl -s --max-time 8 http://localhost:3100/api/vault/status 2>/dev/null | grep -o '"state":"[a-z_]*"' | head -1 | cut -d'"' -f4)
EDGE=$(code https://control.dispatchmasters.org)   # 302 = Access enforcing (healthy)
TUNNEL=$(pgrep -f 'cloudflared.*tunnel run' >/dev/null && echo up || echo down)
DISK=$(df -h "$HOME" | awk 'NR==2{print $5}')

TS=$(date "+%Y-%m-%dT%H:%M:%S%z")
STATUS="ok"
[ "$BACKEND" = "200" ] || STATUS="degraded"
[ "$FRONTEND" = "200" ] || STATUS="degraded"
[ "$EDGE" = "302" ] || STATUS="degraded"
[ "$TUNNEL" = "up" ] || STATUS="degraded"

echo "$TS status=$STATUS backend=$BACKEND frontend=$FRONTEND vault=${VAULT:-unknown} edge=$EDGE tunnel=$TUNNEL disk=$DISK" >> "$HEALTH_LOG"

# Rotate any supervised log that grew past the threshold (keeps logs bounded).
for f in "$LOG_DIR"/*.log; do
  [ -f "$f" ] || continue
  sz=$(stat -f%z "$f" 2>/dev/null || echo 0)
  if [ "$sz" -gt "$ROTATE_BYTES" ]; then
    for ((i=KEEP-1; i>=1; i--)); do
      [ -f "$f.$i" ] && mv -f "$f.$i" "$f.$((i+1))"
    done
    cp -f "$f" "$f.1"
    : > "$f"
  fi
done
