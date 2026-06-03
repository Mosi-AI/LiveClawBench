#!/usr/bin/env bash
# Harbor verifier entrypoint.
#
# IMPORTANT: do NOT use `set -e` or `set -o pipefail` here — verify.py
# legitimately exits with code 1 when score < 0.5, and we still want
# reward.txt + reward.json (which verify.py emits internally) to survive.
set -u

mkdir -p /logs/verifier

# Sidecar bootstrap (openreview-conference-analysis only; no-op otherwise)
if [ -x /opt/openreview_mock/start.sh ]; then
  bash /opt/openreview_mock/start.sh || true
fi

# Run verify.py; capture full stdout to verify_stdout.txt; extract Score:.
python3 /tests/verify.py 2>&1 | tee /logs/verifier/verify_stdout.txt
SCORE=$(grep -oP 'Score:\s*\K[0-9.]+' /logs/verifier/verify_stdout.txt | tail -1)

# Always emit reward.txt — even when verify.py exited non-zero or the
# pipe failed.  Fall back to 0.0 so the harness never sees a missing file.
echo "${SCORE:-0.0}" > /logs/verifier/reward.txt
echo "Verification score: ${SCORE:-0.0}"

# PR-7 B7.4 defense-in-depth: if verify.py crashed before emit() ran,
# reward.json will be missing — synthesize a minimal one so the harness
# never sees a malformed verifier output.
if [ ! -s /logs/verifier/reward.json ]; then
  printf '{"reward": %s, "_meta_verifier_no_reward_json": 1}\n' "${SCORE:-0.0}" \
    > /logs/verifier/reward.json
fi
exit 0
