#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:1235"
COOKIE_JAR="/tmp/finance_cookies.txt"

# 1. Login
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' > /dev/null

# 2. Get all assets
ASSETS=$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/assets")
echo "Assets: $ASSETS"

# 3. Fix Laptop Fleet (id=2): straight_line (80000-8000)/4 = 18000
curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/assets/2" \
  -H "Content-Type: application/json" \
  -d '{"cost_basis":80000.0,"residual_value":8000.0,"useful_life_years":4,"depreciation_method":"straight_line","annual_depreciation":18000.0,"correction_reason":"Fixed annual depreciation: was 25000 (incorrect declining_balance value), corrected to 18000 per straight-line formula (80000-8000)/4"}' > /dev/null

# 4. Fix Company Vehicle (id=4): declining_balance 60000*(2/6) = 20000
curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/assets/4" \
  -H "Content-Type: application/json" \
  -d '{"cost_basis":60000.0,"residual_value":10000.0,"useful_life_years":6,"depreciation_method":"declining_balance","annual_depreciation":20000.0,"correction_reason":"Fixed annual depreciation: was 10000 (incorrect straight_line value), corrected to 20000 per declining-balance formula 60000*(2/6)"}' > /dev/null

# 5. Fix Backup Generator (id=6): straight_line (40000-4000)/8 = 4500
curl -s -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/assets/6" \
  -H "Content-Type: application/json" \
  -d '{"cost_basis":40000.0,"residual_value":4000.0,"useful_life_years":8,"depreciation_method":"straight_line","annual_depreciation":4500.0,"correction_reason":"Fixed annual depreciation: was 8000 (incorrect), corrected to 4500 per straight-line formula (40000-4000)/8"}' > /dev/null

# 6. Update policy file with audit results
cat >> /workspace/policies/asset_policy.md << 'POLICY_EOF'

## Audit Results (2026-03)

The following assets were audited and corrected:

### Laptop Fleet (id=2)
- **Method**: straight_line
- **Error**: annual_depreciation was 25,000.00 (declining_balance value applied to straight_line asset)
- **Correction**: 18,000.00 per (80,000 - 8,000) / 4

### Company Vehicle (id=4)
- **Method**: declining_balance
- **Error**: annual_depreciation was 10,000.00 (straight_line value applied to declining_balance asset)
- **Correction**: 20,000.00 per 60,000 * (2 / 6)

### Backup Generator (id=6)
- **Method**: straight_line
- **Error**: annual_depreciation was 8,000.00 (incorrect calculation)
- **Correction**: 4,500.00 per (40,000 - 4,000) / 8

All other assets (Server Rack A, Office Furniture, Network Equipment, Conference Room AV) had correct depreciation values and were not modified.
POLICY_EOF
