#!/usr/bin/env bash
set -euo pipefail

export HOME="/home/node"
ROOT="${HOME}/.openclaw"
OUTPUT="${ROOT}/output"
SERVER_LOG="${OUTPUT}/directory_server.log"

mkdir -p "${OUTPUT}"

python3 "${ROOT}/directory_server.py" \
  --host "127.0.0.1" \
  --port "8300" \
  > "${SERVER_LOG}" 2>&1 &

# Wait for server to be ready
python3 - <<'PY'
import json, sys, time, urllib.request
deadline = time.time() + 10
last_error = ""
while time.time() < deadline:
    try:
        with urllib.request.urlopen("http://127.0.0.1:8300/health", timeout=1) as resp:
            payload = json.load(resp)
        if payload.get("ok"):
            sys.exit(0)
        last_error = f"unhealthy: {payload!r}"
    except Exception as exc:
        last_error = str(exc)
    time.sleep(0.2)
raise SystemExit(f"directory server did not become ready: {last_error}")
PY
