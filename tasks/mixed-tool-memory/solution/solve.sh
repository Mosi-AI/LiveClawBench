#!/usr/bin/env bash
set -euo pipefail

export HOME="/home/node"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${HOME}/.openclaw"
OUTPUT="${ROOT}/output"
WORK="${ROOT}/workspace"
DB_DIR="${WORK}/db"
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

mkdir -p "${OUTPUT}" "${WORK}/memory" "${WORK}/state" "${WORK}/corpus" "${WORK}/tools" "${DB_DIR}"

cat > "${ROOT}/instruction.md" <<'EOF'
Build a durable speculative-decoding reference using the local corpus in `corpus/`, the browser portal, and the helper scripts in `tools/`. Populate the database, fill in the reference template, and write `~/.openclaw/output/result.json`.
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

sync_generated_artifacts() {
  mkdir -p "${OUTPUT}" "${DB_DIR}"

  for candidate in \
    "${WORK}/output/result.json" \
    "${WORK}/workspace/output/result.json"
  do
    if [[ -s "${candidate}" ]]; then
      cp "${candidate}" "${OUTPUT}/result.json" 2>/dev/null || true
      break
    fi
  done

  for candidate in \
    "${WORK}/db/spec_decode_knowledge.db" \
    "${WORK}/workspace/db/spec_decode_knowledge.db"
  do
    if [[ -f "${candidate}" ]]; then
      cp "${candidate}" "${DB_DIR}/spec_decode_knowledge.db" 2>/dev/null || true
      break
    fi
  done
}

hybrid_ready() {
  sync_generated_artifacts
  [[ -s "${OUTPUT}/result.json" ]] || return 1
  [[ -f "${DB_DIR}/spec_decode_knowledge.db" ]] || return 1
  if [[ -n "${BROWSER_MOCK_ACCESS_LOG}" && -s "${BROWSER_MOCK_ACCESS_LOG}" ]]; then
    :
  else
    [[ -s "${BROWSER_LOG}" ]] || return 1
  fi
  [[ -s "${WORK}/memory/speculative_decoding_reference.md" ]]
}

ARK_BASE_URL="${OPENCLAW_ARK_BASE_URL:-https://ark.cn-beijing.volces.com/api/coding/v3}"
ARK_MODEL="${OPENCLAW_ARK_MODEL:-kimi-k2.5}"
ARK_API_KEY="${OPENCLAW_ARK_API_KEY:-}"
AGENT_THINKING="${OPENCLAW_AGENT_THINKING:-on}"
AGENT_TIMEOUT="${OPENCLAW_HYBRID_AGENT_TIMEOUT:-600}"
MAX_ATTEMPTS="${OPENCLAW_HYBRID_MAX_ATTEMPTS:-4}"
MAX_WAIT_LOOPS="${OPENCLAW_HYBRID_MAX_WAIT_LOOPS:-130}"
PARTIAL_STREAK_LIMIT="${OPENCLAW_HYBRID_PARTIAL_STREAK_LIMIT:-6}"
NO_PROGRESS_STREAK_LIMIT="${OPENCLAW_HYBRID_NO_PROGRESS_STREAK_LIMIT:-5}"

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
for attempt in $(seq 1 "${MAX_ATTEMPTS}"); do
  PARTIAL_STREAK=0
  NO_PROGRESS_STREAK=0
  LAST_PROGRESS_TS=""
  rm -f "${OUTPUT}/agent_response.json" "${OUTPUT}/final.md" "${OUTPUT}/summary.md" "${OUTPUT}/answer.md" "${OUTPUT}/result.json"
  find "${DB_DIR}" -maxdepth 1 -type f \( -name '*.db' -o -name '*.sqlite' \) -delete
  rm -rf "${WORK}/output"
  SESSION_ID="pkb-hybrid-tool-memory-${attempt}-$(date +%s)-$$"
  SESSION_LOG="${ROOT}/agents/main/sessions/${SESSION_ID}.jsonl"
  openclaw agent \
    --local \
    --session-id "${SESSION_ID}" \
    --thinking "${AGENT_THINKING}" \
    --timeout "${AGENT_TIMEOUT}" \
    --message "${MESSAGE}" \
    --json \
    > "${OUTPUT}/agent_response.json" 2>&1 &
  AGENT_PID=$!

  for _ in $(seq 1 "${MAX_WAIT_LOOPS}"); do
    sync_browser_log
    sync_generated_artifacts

    if hybrid_ready; then
      SUCCESS=1
      kill "${AGENT_PID}" >/dev/null 2>&1 || true
      wait "${AGENT_PID}" >/dev/null 2>&1 || true
      break
    fi

    if [[ -f "${SESSION_LOG}" ]]; then
      CURRENT_PROGRESS_TS="$(stat -c %Y "${SESSION_LOG}" 2>/dev/null || echo "")"
      if [[ -n "${CURRENT_PROGRESS_TS}" && "${CURRENT_PROGRESS_TS}" == "${LAST_PROGRESS_TS}" ]]; then
        NO_PROGRESS_STREAK=$((NO_PROGRESS_STREAK + 1))
      else
        LAST_PROGRESS_TS="${CURRENT_PROGRESS_TS}"
        NO_PROGRESS_STREAK=0
      fi
    fi

    if python3 "${SCRIPT_DIR}/check_case_outputs.py" --root "${ROOT}" --require-result --require-db --require-browser-mock; then
      SUCCESS=1
      kill "${AGENT_PID}" >/dev/null 2>&1 || true
      wait "${AGENT_PID}" >/dev/null 2>&1 || true
      break
    fi
    if python3 "${SCRIPT_DIR}/check_case_outputs.py" --root "${ROOT}" --allow-partial; then
      PARTIAL=1
      PARTIAL_STREAK=$((PARTIAL_STREAK + 1))
      if [[ "${PARTIAL_STREAK}" -ge "${PARTIAL_STREAK_LIMIT}" ]]; then
        kill "${AGENT_PID}" >/dev/null 2>&1 || true
        wait "${AGENT_PID}" >/dev/null 2>&1 || true
        break
      fi
    else
      PARTIAL_STREAK=0
    fi
    if [[ "${NO_PROGRESS_STREAK}" -ge "${NO_PROGRESS_STREAK_LIMIT}" ]]; then
      kill "${AGENT_PID}" >/dev/null 2>&1 || true
      wait "${AGENT_PID}" >/dev/null 2>&1 || true
      break
    fi
    if ! kill -0 "${AGENT_PID}" >/dev/null 2>&1; then
      break
    fi
    sleep 5
  done

  sync_browser_log
  sync_generated_artifacts
  if hybrid_ready; then
    SUCCESS=1
  fi
  if python3 "${SCRIPT_DIR}/check_case_outputs.py" --root "${ROOT}" --require-result --require-db --require-browser-mock; then
    SUCCESS=1
    wait "${AGENT_PID}" >/dev/null 2>&1 || true
    break
  fi
  if python3 "${SCRIPT_DIR}/check_case_outputs.py" --root "${ROOT}" --allow-partial; then
    PARTIAL=1
  fi
  kill "${AGENT_PID}" >/dev/null 2>&1 || true
  wait "${AGENT_PID}" >/dev/null 2>&1 || true
  sleep 1
done

if [[ "${SUCCESS}" != "1" && "${PARTIAL}" != "1" ]]; then
  exit 1
fi
