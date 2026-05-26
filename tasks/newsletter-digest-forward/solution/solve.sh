#!/usr/bin/env bash
set -euo pipefail

# Write the digest note
mkdir -p /workspace/notes
cat > /workspace/notes/newsletter-digest.md <<'NOTE'
# Newsletter digest -- 2026-04-03

- VectorDB Cloud row-level ACLs
- OpenBrowse persistent sessions
- NovaStack Series A
NOTE

# Login to email mock
LOGIN=$(curl -s -X POST "http://localhost:5001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"peter","password":"password123"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

# Send the digest email
curl -s -X POST "http://localhost:5001/api/emails" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "recipient": "research@work.mosi.inc",
    "subject": "Newsletter digest -- 2026-04-03",
    "body": "Top three updates this cycle:\n\n  - VectorDB Cloud row-level ACLs\n  - OpenBrowse persistent sessions\n  - NovaStack Series A\n",
    "send_now": true
  }' > /dev/null
echo "Oracle: digest file + email sent"
