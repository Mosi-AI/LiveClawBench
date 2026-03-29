#!/usr/bin/env bash
set -euo pipefail

export HOME="/home/node"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${HOME}/.openclaw"
OUTPUT="${ROOT}/output"
WORK="${ROOT}/workspace"
REQUESTS_LOG="${OUTPUT}/browser_requests.json"
TABS_LOG="${OUTPUT}/browser_tabs.json"
GATEWAY_LOG="${OUTPUT}/gateway.log"
GATEWAY_PID=""
BROWSER_READY=0
BROWSER_MOCK_PORT="${BROWSER_MOCK_PORT:-8123}"
BROWSER_MOCK_DIR="${ROOT}/browser_mock_sidecar"
BROWSER_MOCK_DB="${OUTPUT}/browser_mock_documents.sqlite"
BROWSER_MOCK_BASE_URL="${BROWSER_MOCK_BASE_URL:-}"
BROWSER_MOCK_ACCESS_LOG="${BROWSER_MOCK_ACCESS_LOG:-}"
BROWSER_LOG="${OUTPUT}/browser_mock_access.jsonl"
BROWSER_MOCK_PID=""
USE_EMBEDDED_BROWSER_MOCK=0

mkdir -p "${OUTPUT}" "${WORK}/memory" "${WORK}/state" "${WORK}/corpus" "${WORK}/tools"

cat > "${ROOT}/instruction.md" <<'EOF'
Your workspace notes about speculative decoding contain stale claims. Review the local corpus in `corpus/` and use the browser portal in `tools/` to find stronger evidence, then repair your notes and write `output/result.json`.
EOF

if [[ -z "${BROWSER_MOCK_ACCESS_LOG}" ]]; then
  BROWSER_MOCK_ACCESS_LOG="${BROWSER_LOG}"
fi

sync_browser_log() {
  if [[ -n "${BROWSER_MOCK_ACCESS_LOG}" && "${BROWSER_MOCK_ACCESS_LOG}" != "${BROWSER_LOG}" && -f "${BROWSER_MOCK_ACCESS_LOG}" ]]; then
    cp "${BROWSER_MOCK_ACCESS_LOG}" "${BROWSER_LOG}" 2>/dev/null || true
  fi
}

wait_for_browser_mock() {
  for _ in $(seq 1 30); do
    if python3 - "${BROWSER_MOCK_BASE_URL}" 2>/dev/null <<'PY'
import json
import sys
import urllib.request

base_url = sys.argv[1].rstrip("/")
with urllib.request.urlopen(f"{base_url}/health", timeout=1) as resp:
    payload = json.load(resp)
sys.exit(0 if payload.get("ok") else 1)
PY
    then
      return 0
    fi
    sleep 1
  done
  return 1
}

cleanup() {
  openclaw browser requests --json > "${REQUESTS_LOG}" 2>/dev/null || true
  openclaw browser tabs --json > "${TABS_LOG}" 2>/dev/null || true
  openclaw browser stop >/dev/null 2>&1 || true
  if [[ -n "${GATEWAY_PID}" ]]; then
    kill "${GATEWAY_PID}" >/dev/null 2>&1 || true
    wait "${GATEWAY_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${BROWSER_MOCK_PID}" ]]; then
    kill "${BROWSER_MOCK_PID}" >/dev/null 2>&1 || true
    wait "${BROWSER_MOCK_PID}" >/dev/null 2>&1 || true
  fi
  sync_browser_log
}
trap cleanup EXIT

if [[ -f "${BROWSER_MOCK_DIR}/browser_mock_server.py" && -f "${BROWSER_MOCK_DIR}/documents.sql" && -z "${BROWSER_MOCK_BASE_URL}" ]]; then
  USE_EMBEDDED_BROWSER_MOCK=1
  BROWSER_MOCK_BASE_URL="http://127.0.0.1:${BROWSER_MOCK_PORT}"
fi

if [[ "${USE_EMBEDDED_BROWSER_MOCK}" == "1" ]]; then
  mkdir -p "$(dirname "${BROWSER_MOCK_ACCESS_LOG}")"
  : > "${BROWSER_MOCK_ACCESS_LOG}"
  rm -f "${BROWSER_MOCK_DB}"
  sqlite3 "${BROWSER_MOCK_DB}" < "${BROWSER_MOCK_DIR}/documents.sql"
  python3 "${BROWSER_MOCK_DIR}/browser_mock_server.py" \
    --database "${BROWSER_MOCK_DB}" \
    --log "${BROWSER_MOCK_ACCESS_LOG}" \
    --host "127.0.0.1" \
    --port "${BROWSER_MOCK_PORT}" \
    > "${OUTPUT}/browser_mock_server.log" 2>&1 &
  BROWSER_MOCK_PID=$!
fi

if [[ -n "${BROWSER_MOCK_BASE_URL}" ]] && ! wait_for_browser_mock; then
  echo "browser mock server did not become ready" >&2
  exit 1
fi

ARK_BASE_URL="${OPENCLAW_ARK_BASE_URL:-https://ark.cn-beijing.volces.com/api/coding/v3}"
ARK_MODEL="${OPENCLAW_ARK_MODEL:-kimi-k2.5}"
ARK_API_KEY="${OPENCLAW_ARK_API_KEY:-}"
AGENT_THINKING="${OPENCLAW_AGENT_THINKING:-on}"

if [[ -z "${ARK_API_KEY}" ]]; then
  echo "OPENCLAW_ARK_API_KEY is not set" >&2
  exit 1
fi

if ! command -v python >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
  mkdir -p "${HOME}/.local/bin"
  cat > "${HOME}/.local/bin/python" <<'EOF'
#!/usr/bin/env bash
exec python3 "$@"
EOF
  chmod +x "${HOME}/.local/bin/python"
  export PATH="${HOME}/.local/bin:${PATH}"
fi

PROVIDER_JSON="$(cat <<EOF
{"baseUrl":"${ARK_BASE_URL}","apiKey":"${ARK_API_KEY}","api":"openai-completions","models":[{"id":"${ARK_MODEL}","name":"${ARK_MODEL}"}]}
EOF
)"

openclaw config set models.providers.ark "${PROVIDER_JSON}" >/dev/null
openclaw models set "ark/${ARK_MODEL}" >/dev/null
rm -rf "${WORK}/corpus" "${WORK}/tools"
mkdir -p "${WORK}/corpus" "${WORK}/tools"
cp -R "${ROOT}/corpus/." "${WORK}/corpus/"
cp -R "${ROOT}/tools/." "${WORK}/tools/"
cat > "${WORK}/corpus/README.md" <<'EOF'
# Corpus Index

- formal digest
- talk transcript
- public explainer article
EOF

openclaw config set agents.defaults.workspace "${WORK}" >/dev/null
openclaw config set browser.executablePath "/usr/bin/chromium" >/dev/null
openclaw config set browser.headless true >/dev/null
openclaw config set browser.noSandbox true >/dev/null

openclaw gateway run --allow-unconfigured > "${GATEWAY_LOG}" 2>&1 &
GATEWAY_PID=$!

for _ in $(seq 1 30); do
  if openclaw browser start >/dev/null 2>&1; then
    BROWSER_READY=1
    break
  fi
  sleep 1
done

if [[ "${BROWSER_READY}" != "1" ]]; then
  echo "OpenClaw browser did not become ready" >&2
  exit 1
fi

MESSAGE="$(cat "${ROOT}/instruction.md")"
SUCCESS=0
PARTIAL=0
for attempt in 1 2 3; do
  rm -f "${OUTPUT}/agent_response.json" "${OUTPUT}/final.md" "${OUTPUT}/summary.md" "${OUTPUT}/answer.md" "${OUTPUT}/result.json"
  rm -rf "${WORK}/output"
  SESSION_ID="pkb-conflict-repair-${attempt}-$(date +%s)-$$"
  openclaw agent \
    --local \
    --session-id "${SESSION_ID}" \
    --thinking "${AGENT_THINKING}" \
    --timeout 720 \
    --message "${MESSAGE}" \
    --json \
    > "${OUTPUT}/agent_response.json" || true

  export OPENCLAW_WORKSPACE_ROOT="${ROOT}"
  python3 "${SCRIPT_DIR}/normalize_case_outputs.py"
  python3 "${SCRIPT_DIR}/export_best_note.py"
  python3 "${SCRIPT_DIR}/export_repair_result.py"
  sync_browser_log
  if python3 "${SCRIPT_DIR}/check_case_outputs.py" --root "${ROOT}" --require-result --require-browser-mock; then
    SUCCESS=1
    break
  fi
  if python3 "${SCRIPT_DIR}/check_case_outputs.py" --root "${ROOT}" --allow-partial; then
    PARTIAL=1
  fi
  sleep 1
done

if [[ "${SUCCESS}" != "1" && "${PARTIAL}" != "1" ]]; then
  exit 1
fi
