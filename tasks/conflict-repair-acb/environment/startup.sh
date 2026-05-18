#!/usr/bin/env bash
# NOTE: This file is intentionally duplicated in tasks/mixed-tool-memory/environment/startup.sh.
# Harbor's per-task build context (environment/ dir only) prevents cross-task file sharing
# without baking shared logic into the base image. If you edit this file, apply the same
# change to its counterpart.
set -euo pipefail

export HOME="/home/node"
ROOT="${HOME}/.openclaw"
OUTPUT="${ROOT}/output"
BROWSER_MOCK_BASE_URL="${BROWSER_MOCK_BASE_URL:-http://127.0.0.1:8123}"

mkdir -p "${OUTPUT}"

# Verify Bun mock-doc-search is running (started by per-task image entrypoint).
# The legacy Python browser_mock_sidecar was removed in Plan 2.5.
if ! python3 -c "
import urllib.request, json, sys
try:
    r = urllib.request.urlopen('http://127.0.0.1:8123/health', timeout=1)
    ok = json.load(r).get('ok', False)
    sys.exit(0 if ok else 1)
except SystemExit: raise
except: sys.exit(1)
" 2>/dev/null; then
  echo "ERROR: Bun mock-doc-search is not running on port 8123" >&2
  exit 1
fi
echo "Bun mock-doc-search is running on port 8123"
