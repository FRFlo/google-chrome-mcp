#!/usr/bin/env bash
set -Eeuo pipefail

: "${DISPLAY:=:99}"
: "${SCREEN_WIDTH:=1920}"
: "${SCREEN_HEIGHT:=1080}"
: "${CHROME_DATA_DIR:=/data/chrome}"
: "${DOWNLOAD_DIR:=/data/downloads}"
: "${MCP_PORT:=3000}"
: "${VNC_PORT:=5900}"
: "${NOVNC_PORT:=6080}"

if [[ -z "${VNC_PASSWORD:-}" ]]; then
  echo "VNC_PASSWORD must be set" >&2
  exit 1
fi

mkdir -p "$CHROME_DATA_DIR" "$DOWNLOAD_DIR" /tmp/runtime-node
chmod 0700 /tmp/runtime-node
export XDG_RUNTIME_DIR=/tmp/runtime-node

cleanup() {
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

Xvfb "$DISPLAY" -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x24" -ac +extension GLX +render -noreset &
fluxbox -display "$DISPLAY" >/tmp/fluxbox.log 2>&1 &

printf '%s\n' "$VNC_PASSWORD" | x11vnc -storepasswd - /tmp/vncpasswd >/dev/null
x11vnc -display "$DISPLAY" -rfbport "$VNC_PORT" -rfbauth /tmp/vncpasswd -forever -shared -noxdamage >/tmp/x11vnc.log 2>&1 &
websockify --web=/usr/share/novnc "$NOVNC_PORT" "localhost:$VNC_PORT" >/tmp/websockify.log 2>&1 &

google-chrome \
  --display="$DISPLAY" \
  --remote-debugging-address=0.0.0.0 \
  --remote-debugging-port=9222 \
  --user-data-dir="$CHROME_DATA_DIR" \
  --download-default-directory="$DOWNLOAD_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --disable-dev-shm-usage \
  --start-maximized \
  about:blank >/tmp/chrome.log 2>&1 &

for _ in {1..60}; do
  if curl --fail --silent http://127.0.0.1:9222/json/version >/dev/null; then
    break
  fi
  sleep 1
done

if ! curl --fail --silent http://127.0.0.1:9222/json/version >/dev/null; then
  echo "Chrome DevTools endpoint did not become ready" >&2
  exit 1
fi

exec mcp-proxy --port "$MCP_PORT" --server stream -- \
  chrome-devtools-mcp --browserUrl=http://127.0.0.1:9222

