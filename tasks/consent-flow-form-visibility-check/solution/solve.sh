#!/bin/bash
set -e

echo "Working through signup form — Branch A (Accept marketing)..."

# Use cookie jar for session persistence
COOKIES=/tmp/cookies.txt
rm -f "$COOKIES"

# Step 1: Navigate to form, fill step 1
curl -s -c "$COOKIES" -b "$COOKIES" -L 'http://localhost:8500/' > /dev/null
curl -s -c "$COOKIES" -b "$COOKIES" \
  -d 'step=1&email=test@example.com&password=password123&username=' \
  'http://localhost:8500/api/submit' > /dev/null

# Step 2
curl -s -c "$COOKIES" -b "$COOKIES" \
  -d 'step=2&full_name=Test+User&company=' \
  'http://localhost:8500/api/submit' > /dev/null

# Step 3: Accept marketing
curl -s -c "$COOKIES" -b "$COOKIES" \
  -d 'step=3&consent_marketing=accept' \
  'http://localhost:8500/api/submit' > /dev/null

# Step 4: Leave phone empty (testing it's optional), check marketing checkboxes
curl -s -c "$COOKIES" -b "$COOKIES" \
  -d 'step=4&marketing_email=on&marketing_sms=&phone=' \
  'http://localhost:8500/api/submit' > /dev/null

# Step 5: Agree terms
curl -s -c "$COOKIES" -b "$COOKIES" \
  -d 'step=5&agree_terms=on&newsletter=' \
  'http://localhost:8500/api/submit' > /dev/null

echo "Branch A complete."

# Reset for Branch B
rm -f "$COOKIES"
echo "Working through signup form — Branch B (Decline marketing)..."

# Step 1
curl -s -c "$COOKIES" -b "$COOKIES" -L 'http://localhost:8500/' > /dev/null
curl -s -c "$COOKIES" -b "$COOKIES" \
  -d 'step=1&email=test@example.com&password=password123&username=' \
  'http://localhost:8500/api/submit' > /dev/null

# Step 2
curl -s -c "$COOKIES" -b "$COOKIES" \
  -d 'step=2&full_name=Test+User&company=' \
  'http://localhost:8500/api/submit' > /dev/null

# Step 3: Decline marketing
curl -s -c "$COOKIES" -b "$COOKIES" \
  -d 'step=3&consent_marketing=decline' \
  'http://localhost:8500/api/submit' > /dev/null

# Step 4: Leave phone empty (testing it's optional) — no marketing checkboxes in decline
curl -s -c "$COOKIES" -b "$COOKIES" \
  -d 'step=4&phone=' \
  'http://localhost:8500/api/submit' > /dev/null

# Step 5: Agree terms
curl -s -c "$COOKIES" -b "$COOKIES" \
  -d 'step=5&agree_terms=on&newsletter=' \
  'http://localhost:8500/api/submit' > /dev/null

echo "Branch B complete."

# Write the ground-truth matrix
cat > /workspace/signup_field_matrix.md << 'EOF'
# Signup Field Visibility Matrix

## Branch A: Accept Marketing

| Step | Field | Visibility |
|------|-------|-----------|
| 1 | email | R |
| 1 | password | R |
| 1 | username | O |
| 2 | full_name | R |
| 2 | company | O |
| 3 | consent_marketing | R |
| 4 | marketing_email | O |
| 4 | marketing_sms | O |
| 4 | phone | O |
| 5 | agree_terms | R |
| 5 | newsletter | O |

## Branch B: Decline Marketing

| Step | Field | Visibility |
|------|-------|-----------|
| 1 | email | R |
| 1 | password | R |
| 1 | username | O |
| 2 | full_name | R |
| 2 | company | O |
| 3 | consent_marketing | R |
| 4 | phone | O |
| 5 | agree_terms | R |
| 5 | newsletter | O |

Note: The phone field at step 4 is visually styled as required (red asterisk, "(Required)" hint)
but is actually optional — the form accepts submission with an empty phone value in both branches.
In Branch A, step 4 additionally shows marketing_email and marketing_sms checkboxes (both optional).
In Branch B, these marketing checkboxes are not shown (—).
EOF

echo "Oracle solution: signup_field_matrix.md written to /workspace/"
