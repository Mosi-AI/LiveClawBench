#!/usr/bin/env bash
set -euo pipefail

# Login to email mock
LOGIN=$(curl -s -X POST "http://localhost:5001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"peter","password":"password123"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

# Send acceptance to AsterByte (winner)
curl -s -X POST "http://localhost:5001/api/emails" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "recipient": "sales@asterbyte.io",
    "subject": "Re: Procurement RFQ -- 24 x LaptopX1",
    "body": "Hi AsterByte,\n\nThanks for the quote. We would like to proceed with your offer at USD 1180/unit, 5 business-day delivery. Please send the PO confirmation and we will confirm the order on our side.\n\nBest,\nPeter",
    "send_now": true
  }' > /dev/null
echo "Oracle: acceptance email sent to sales@asterbyte.io"
