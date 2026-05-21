#!/usr/bin/env bash
# NOTE: This file is intentionally duplicated in tasks/mixed-tool-memory/environment/startup.sh.
# Harbor's per-task build context (environment/ dir only) prevents cross-task file sharing
# without baking shared logic into the base image. If you edit this file, apply the same
# change to its counterpart.
set -euo pipefail

export HOME="/home/node"
ROOT="${HOME}/.openclaw"
OUTPUT="${ROOT}/output"
BROWSER_MOCK_DIR="${ROOT}/browser_mock_sidecar"
BROWSER_MOCK_DB="${OUTPUT}/browser_mock_documents.sqlite"
BROWSER_MOCK_LOG="${OUTPUT}/browser_mock_access.jsonl"
BROWSER_MOCK_SERVER_LOG="${OUTPUT}/browser_mock_server.log"
BROWSER_MOCK_BASE_URL="${BROWSER_MOCK_BASE_URL:-http://127.0.0.1:8123}"

mkdir -p "${OUTPUT}"
: > "${BROWSER_MOCK_LOG}"

python3 - "${BROWSER_MOCK_DIR}/documents.sql" "${BROWSER_MOCK_DB}" <<'PY'
import sqlite3
import sys
from pathlib import Path

sql_path = Path(sys.argv[1])
db_path = Path(sys.argv[2])
if db_path.exists():
    db_path.unlink()
conn = sqlite3.connect(db_path)
try:
    conn.executescript(sql_path.read_text(encoding="utf-8"))
    conn.commit()
finally:
    conn.close()
PY

python3 "${BROWSER_MOCK_DIR}/browser_mock_server.py" \
  --database "${BROWSER_MOCK_DB}" \
  --log "${BROWSER_MOCK_LOG}" \
  --host "127.0.0.1" \
  --port "8123" \
  > "${BROWSER_MOCK_SERVER_LOG}" 2>&1 &

python3 - "${BROWSER_MOCK_BASE_URL}" <<'PY'
import json
import sys
import time
import urllib.request

base_url = sys.argv[1].rstrip("/")
deadline = time.time() + 10
last_error = ""
while time.time() < deadline:
    try:
        with urllib.request.urlopen(f"{base_url}/health", timeout=1) as resp:
            payload = json.load(resp)
        if payload.get("ok"):
            sys.exit(0)
        last_error = f"unhealthy payload: {payload!r}"
    except Exception as exc:
        last_error = str(exc)
    time.sleep(0.2)
raise SystemExit(f"browser mock server did not become ready: {last_error}")
PY
