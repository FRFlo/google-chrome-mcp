#!/usr/bin/env bash
set -Eeuo pipefail

: "${DISPLAY:=:99}"
: "${SCREEN_WIDTH:=1920}"
: "${SCREEN_HEIGHT:=1080}"
: "${SESSION_ROOT:=/data/sessions}"
: "${MCP_PORT:=3000}"
: "${MAX_SESSIONS:=4}"
: "${SESSION_TTL_MS:=1800000}"
: "${VNC_PORT:=5900}"
: "${NOVNC_PORT:=6080}"

mkdir -p "$SESSION_ROOT" /tmp/runtime-node
chmod 0700 /tmp/runtime-node
export XDG_RUNTIME_DIR=/tmp/runtime-node

cleanup() {
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

Xvfb "$DISPLAY" -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x24" -ac +extension GLX +render -noreset &
fluxbox -display "$DISPLAY" >/tmp/fluxbox.log 2>&1 &

x11vnc -display "$DISPLAY" -rfbport "$VNC_PORT" -nopw -forever -shared -noxdamage >/tmp/x11vnc.log 2>&1 &
websockify --web=/usr/share/novnc "$NOVNC_PORT" "localhost:$VNC_PORT" >/tmp/websockify.log 2>&1 &

export SESSION_ROOT MAX_SESSIONS SESSION_TTL_MS
exec bun run /app/src/gateway.ts

