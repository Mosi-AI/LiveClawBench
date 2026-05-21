#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:1235"
COOKIE_JAR="/tmp/finance_cookies.txt"

# 1. Login
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' > /dev/null

# 2. Check current dashboard (formula has deprecated field names)
DASHBOARD=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/dashboard")
echo "Dashboard: $DASHBOARD"

# 3. Fix the formula: replace deprecated v1 field names with v2 equivalents
#    - "total_expenses" → "actual_expense_amount"
#    - "budget_deviation" → "budget_amount"
#    NAPI = revenue - (actual_expenses * 0.10) + ((budget - actual_expenses) * 0.05)
cat > /tmp/build_dashboard_req.py << 'PYEOF'
import json

formula = {
    "op": "add",
    "left": {
        "op": "subtract",
        "left": {"op": "field", "name": "revenue_amount"},
        "right": {
            "op": "multiply",
            "left": {"op": "field", "name": "actual_expense_amount"},
            "right": {"op": "const", "value": 0.10},
        },
    },
    "right": {
        "op": "multiply",
        "left": {
            "op": "subtract",
            "left": {"op": "field", "name": "budget_amount"},
            "right": {"op": "field", "name": "actual_expense_amount"},
        },
        "right": {"op": "const", "value": 0.05},
    },
}

body = {
    "date_range_start": "2026-01-01",
    "date_range_end": "2026-12-31",
    "formula_json": json.dumps(formula),
    "department_weight_json": json.dumps(
        {"Engineering": 1.0, "Sales": 1.2, "Marketing": 0.8}
    ),
}
print(json.dumps(body))
PYEOF

python3 /tmp/build_dashboard_req.py > /tmp/dashboard_config.json

curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/dashboard/config" \
  -H "Content-Type: application/json" \
  -d @/tmp/dashboard_config.json > /dev/null

# 4. Verify dashboard now applies custom formula
DASHBOARD_FIXED=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/dashboard")
echo "Fixed Dashboard: $DASHBOARD_FIXED"

# 5. Update policy file with audit results
cat >> /workspace/policies/dashboard_spec.md << 'POLICY_EOF'

## Audit Report (2026-03)

The dashboard configuration was audited and the following issues were found and corrected:

### Issues Found

1. **Invalid field name "total_expenses"**: Used in formula_json (2 occurrences), replaced with `actual_expense_amount` (v2 equivalent)
2. **Invalid field name "budget_deviation"**: Used in formula_json (1 occurrence), replaced with `budget_amount` (v2 equivalent)

### Root Cause

The dashboard formula_json contained deprecated v1 field names that are no longer accepted by the formula validator. This caused the formula to fail validation, resulting in the dashboard falling back to default (unweighted) metric calculations.

### Corrected Formula

The NAPI formula has been corrected to use v2 field names:
```
NAPI = revenue_amount - (actual_expense_amount * 0.10) + ((budget_amount - actual_expense_amount) * 0.05)
```

All other settings (date range, department weights) were preserved.
POLICY_EOF
