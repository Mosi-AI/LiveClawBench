#!/usr/bin/env bash
set -euo pipefail

# Login to email mock
LOGIN=$(curl -s -X POST "http://localhost:5001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"peter","password":"password123"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

# Send acknowledgement reply
curl -s -X POST "http://localhost:5001/api/emails" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "recipient": "ops@orchid-systems.com",
    "subject": "Re: Requirement Summary: Phoenix Analytics pilot API scope",
    "body": "Hi,\n\nThanks for the summary -- received and we will review it this week. Will follow up with questions if any.\n\nPeter",
    "send_now": true
  }' > /dev/null
echo "Oracle: reply sent to ops@orchid-systems.com"

# Update tracker line in place, preserving the other two entries
python3 <<'PY'
from pathlib import Path
p = Path("/workspace/notes/requirements-tracker.md")
content = p.read_text()
target_old = "- Phoenix Analytics pilot API scope — awaiting latest summary"
target_new = "- Phoenix Analytics pilot API scope — received 2026-04-03"
if target_old in content:
    p.write_text(content.replace(target_old, target_new))
    print("Oracle: tracker line updated")
else:
    p.write_text(content.rstrip() + "\n" + target_new + "\n")
    print("Oracle: target line not found; appended instead")
PY
