#!/usr/bin/env bash
set -euo pipefail

# Login to expense mock
LOGIN=$(curl -s -c /tmp/expense_cookie -X POST "http://localhost:5005/login" \
  -d "email=alice@mosi.inc&password=password123" -L)

# Create expense draft via the expense mock API
curl -s -b /tmp/expense_cookie -X POST "http://localhost:5005/api/drafts" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_name": "Northwind Components",
    "amount": 1840.50,
    "currency": "USD",
    "invoice_date": "2026-04-03",
    "attachment_ref": "inv_nc_2048",
    "source_type": "email"
  }'
echo
echo "Oracle: expense draft created"
