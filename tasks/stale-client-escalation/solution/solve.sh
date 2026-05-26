#!/usr/bin/env bash
set -euo pipefail

# Login to email mock
LOGIN=$(curl -s -X POST "http://localhost:5001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"peter","password":"password123"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

# Send escalation email
curl -s -X POST "http://localhost:5001/api/emails" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "recipient": "ops@work.mosi.inc",
    "subject": "Escalation: BlueHarbor Labs -- stale > 48h",
    "body": "Heads up -- BlueHarbor Labs has been waiting since 2026-04-01 on contract redline blocked by missing DPA. No reply has gone out from our side. Flagging for ops follow-up.",
    "send_now": true
  }' > /dev/null
echo "Oracle: escalation email to ops"

# Append log entry (preserve existing lines)
python3 <<'PY'
from pathlib import Path
p = Path("/workspace/notes/client-escalation-log.md")
content = p.read_text() if p.exists() else "# Client Escalation Log\n"
new_line = "- 2026-04-03 — BlueHarbor Labs — contract redline blocked by missing DPA."
if new_line not in content:
    p.write_text(content.rstrip() + "\n" + new_line + "\n")
print("Oracle: log entry appended")
PY
