#!/usr/bin/env bash
set -euo pipefail

FINANCE_URL="http://localhost:1235"
EMAIL_URL="http://localhost:5001"
FINANCE_COOKIE="/tmp/finance_cookies.txt"

# 1. Login to finance system
curl -s -c "$FINANCE_COOKIE" -b "$FINANCE_COOKIE" \
  -X POST "$FINANCE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' > /dev/null

# 2. Login to email system
EMAIL_LOGIN=$(curl -s -X POST "$EMAIL_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"peter","password":"password123"}')
TOKEN=$(echo "$EMAIL_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

# 3. Read inbox to get tax notification
INBOX=$(curl -s -H "Authorization: Bearer $TOKEN" "$EMAIL_URL/api/emails?folder=inbox")
echo "Inbox: $INBOX"

# 4. Create invoice INV-2026-010 (vendor_id=1 for Acme Corp)
curl -s -b "$FINANCE_COOKIE" \
  -X POST "$FINANCE_URL/api/invoices" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": 1,
    "invoice_number": "INV-2026-010",
    "invoice_date": "2026-03-01",
    "items": [
      {"description": "Software License Renewal", "category_code": "5300", "amount": 15000.00},
      {"description": "Technical Support Package", "category_code": "5400", "amount": 5000.00}
    ]
  }' > /dev/null

echo "Invoice INV-2026-010 created."

# 5. Calculate VAT based on tax policy
# INV-2026-001: Software License (5300) $12,500.50 * 6% = $750.03 + Support (5400) $3,000.00 * 6% = $180.00 = $930.03
# INV-2026-002: Travel (5100) $52,000.00 * 0% = $0.00 (exempt)
# INV-2026-010: Software License (5300) $15,000.00 * 6% = $900.00 + Support (5400) $5,000.00 * 6% = $300.00 = $1,200.00
# Total: $930.03 + $0.00 + $1,200.00 = $2,130.03

# 6. Update tax policy
export FILING_DATE=$(date +%Y-%m-%d)
python3 << 'PYEOF'
import datetime, os
policy_path = '/workspace/policies/tax_policy.md'
with open(policy_path, 'r') as f:
    content = f.read()

old_section = """## Q1 2026 Filing Status: PENDING

*No filing data has been recorded yet for Q1 2026.*"""

filing_date = os.environ.get('FILING_DATE', 'unknown')

new_section = f"""## Q1 2026 Filing Status: FILED

### VAT Calculation Summary

| Invoice | Vendor | Line Items | VAT Amount |
|---------|--------|-----------|------------|
| INV-2026-001 | Acme Corp | Software License (5300) $12,500.50 + Support (5400) $3,000.00 | $930.03 |
| INV-2026-002 | Globex Systems | Travel Expenses (5100) $52,000.00 | $0.00 |
| INV-2026-010 | Acme Corp | Software License (5300) $15,000.00 + Support (5400) $5,000.00 | $1,200.00 |

**Total Q1 2026 VAT: $2,130.03**

Filed on: {filing_date}"""

content = content.replace(old_section, new_section)
with open(policy_path, 'w') as f:
    f.write(content)
PYEOF

echo "Tax policy updated."

# 7. Send reply email to tax authority
curl -s -X POST "$EMAIL_URL/api/emails" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "recipient": "notifications@tax-authority.gov",
    "subject": "Re: Q1 2026 VAT Filing Reminder - Action Required",
    "body": "Dear Tax Authority,\n\nWe have completed our Q1 2026 VAT calculation as requested.\n\nVAT Breakdown by Invoice:\n\n1. INV-2026-001 (Acme Corp, dated 2026-01-15):\n   - Software License (5300): $12,500.50 x 6% = $750.03\n   - Support (5400): $3,000.00 x 6% = $180.00\n   - Invoice VAT: $930.03\n\n2. INV-2026-002 (Globex Systems, dated 2026-02-01):\n   - Travel Expenses (5100): $52,000.00 x 0% = $0.00 (VAT exempt)\n   - Invoice VAT: $0.00\n\n3. INV-2026-010 (Acme Corp, dated 2026-03-01):\n   - Software License (5300): $15,000.00 x 6% = $900.00\n   - Support (5400): $5,000.00 x 6% = $300.00\n   - Invoice VAT: $1,200.00\n\nTotal Q1 2026 VAT Liability: $2,130.03\n\nPlease confirm receipt of this filing.\n\nBest regards,\nFinance Administrator",
    "send_now": true
  }' > /dev/null

echo "Reply email sent to tax authority."
echo "Q1 2026 VAT filing complete. Total VAT: \$2,130.03"
