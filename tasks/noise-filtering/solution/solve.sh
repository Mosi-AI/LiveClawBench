#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export HOME="/home/node"
ROOT="${HOME}/.openclaw"
OUTPUT="${ROOT}/output"
WORK="${ROOT}/workspace"

mkdir -p "${OUTPUT}" "${WORK}/memory" "${WORK}/state" "${WORK}/corpus"

cat > "${ROOT}/instruction.md" <<'EOF'
Review the speculative decoding materials in `corpus/` and your memory. Some sources are careful and well-supported; others oversimplify or make unsupported claims. Identify which sources are reliable and which are misleading. Update your workspace notes with your corrected understanding and write `~/.openclaw/output/result.json`.
EOF

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
rm -rf "${WORK}/corpus"
mkdir -p "${WORK}/corpus"
cp -R "${ROOT}/corpus/." "${WORK}/corpus/"

openclaw config set agents.defaults.workspace "${WORK}" >/dev/null

MESSAGE="$(cat "${ROOT}/instruction.md")"
SUCCESS=0
PARTIAL=0

for attempt in 1 2 3; do
  rm -f "${OUTPUT}/agent_response.json" "${OUTPUT}/final.md" "${OUTPUT}/summary.md" "${OUTPUT}/answer.md" "${OUTPUT}/result.json"
  rm -rf "${WORK}/output"
  SESSION_ID="pkb-noise-filter-${attempt}-$(date +%s)-$$"
  openclaw agent \
    --local \
    --session-id "${SESSION_ID}" \
    --thinking "${AGENT_THINKING}" \
    --timeout 540 \
    --message "${MESSAGE}" \
    --json \
    > "${OUTPUT}/agent_response.json" || true

  export OPENCLAW_WORKSPACE_ROOT="${ROOT}"
  python3 "${SCRIPT_DIR}/normalize_case_outputs.py"
  python3 "${SCRIPT_DIR}/export_best_note.py"
  if python3 "${SCRIPT_DIR}/check_case_outputs.py" --root "${ROOT}" --require-result; then
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
