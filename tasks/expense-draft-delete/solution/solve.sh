#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:5004"
EMAIL="alice@mosi.inc"
PASSWORD="password123"

# Step 1: Login as alice
echo "Logging in as alice..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/token" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to get auth token"
  exit 1
fi

echo "Got auth token"

# Step 2: Get baseline draft list
echo "Getting baseline draft list..."
DRAFTS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/drafts" \
  -H "Authorization: Bearer $TOKEN")

BASELINE_TOTAL=$(echo "$DRAFTS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('total', 0))")
echo "Baseline total: $BASELINE_TOTAL"

if [ "$BASELINE_TOTAL" = "0" ]; then
  echo "ERROR: No drafts found to delete"
  exit 1
fi

# Step 3: Extract first draft ID using JSON parsing (numeric id from API)
FIRST_DRAFT_ID=$(echo "$DRAFTS_RESPONSE" | python3 -c "
import sys, json
drafts = json.load(sys.stdin).get('drafts', [])
if drafts:
    print(drafts[0]['id'])
")

if [ -z "$FIRST_DRAFT_ID" ]; then
  echo "ERROR: Could not parse draft ID from response"
  exit 1
fi

echo "Found draft to delete: $FIRST_DRAFT_ID"

# Step 4: Delete the draft
echo "Deleting draft..."
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/drafts/$FIRST_DRAFT_ID" \
  -H "Authorization: Bearer $TOKEN")

# Verify delete response indicates success
DELETE_SUCCESS=$(echo "$DELETE_RESPONSE" | python3 -c "import sys, json; print('success' if json.load(sys.stdin).get('success') else 'fail')")

if [ "$DELETE_SUCCESS" != "success" ]; then
  echo "ERROR: Delete request did not succeed: $DELETE_RESPONSE"
  exit 1
fi

echo "Delete succeeded: $DELETE_RESPONSE"

# Step 5: Verify draft is gone and count decreased by 1
echo "Verifying deletion..."
VERIFY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/drafts" \
  -H "Authorization: Bearer $TOKEN")

UPDATED_TOTAL=$(echo "$VERIFY_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('total', -1))")
echo "Updated total: $UPDATED_TOTAL"

# Check count decreased by exactly 1
EXPECTED_TOTAL=$((BASELINE_TOTAL - 1))
if [ "$UPDATED_TOTAL" != "$EXPECTED_TOTAL" ]; then
  echo "ERROR: Count did not decrease by 1 (expected $EXPECTED_TOTAL, got $UPDATED_TOTAL)"
  exit 1
fi

# Check deleted draft is not in the list
if echo "$VERIFY_RESPONSE" | python3 -c "import sys, json; drafts = json.load(sys.stdin).get('drafts', []); ids = [d['id'] for d in drafts]; print('found' if $FIRST_DRAFT_ID in ids else 'gone')" | grep -q "found"; then
  echo "ERROR: Draft $FIRST_DRAFT_ID still exists in the list after deletion"
  exit 1
fi

echo "SUCCESS: Draft deleted and verified"
echo "  - Baseline count: $BASELINE_TOTAL"
echo "  - Updated count: $UPDATED_TOTAL"
echo "  - Deleted draft ID: $FIRST_DRAFT_ID"
exit 0