#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${MCP_BASE_URL:-http://127.0.0.1:${MCP_PORT:-3000}}"
curl --fail --silent "http://127.0.0.1:${NOVNC_PORT:-6080}/vnc.html" | grep -q 'noVNC'

response="$(curl --silent --show-error \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke-test","version":"1.0.0"}}}' \
  "$BASE_URL/mcp")"

grep -Eq '"protocolVersion"|"serverInfo"' <<<"$response"
echo "Smoke tests passed"

