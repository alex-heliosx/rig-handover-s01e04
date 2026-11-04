#!/bin/sh
# Save one rig page as a self-contained HTML file (ADR 0001): a command, not a browser.
# usage: scripts/save-page.sh /digest/2026-10-28 out/index.html   (LANE_MARKER from the env)
set -e
path="$1"; out="$2"; port="${PORT:-8787}"
mkdir -p "$(dirname "$out")"
PORT="$port" pnpm exec tsx src/server.ts >/dev/null 2>&1 &
pid=$!
for i in $(seq 1 30); do curl -sf "http://localhost:$port/health" >/dev/null && break; sleep 0.5; done
curl -sf "http://localhost:$port$path" -o "$out"
kill $pid
echo "saved $path → $out ($(wc -c < "$out") bytes)"
