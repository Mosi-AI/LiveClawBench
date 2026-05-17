# Asset Depreciation Audit

Our finance team needs to audit the fixed asset register for depreciation errors. Please log in to the finance system (http://localhost:1235/) and complete the following:

1. Review the company's asset depreciation policy at `/workspace/policies/asset_policy.md`
2. List all assets in the system
3. For each asset, verify the annual depreciation is correct based on the applicable policy rules:
   - Straight-line: (Cost Basis - Residual Value) / Useful Life Years
   - Declining balance: Cost Basis * (2 / Useful Life Years)
4. Correct any assets with incorrect annual_depreciation values using POST /api/assets/{id} (you must provide a correction_reason)
5. Update the policy document at `/workspace/policies/asset_policy.md` to add an "Audit Results" section documenting which assets were corrected and why

## Authentication

Use the login endpoint with credentials:
- Username: `admin`
- Password: `admin123`

## API Endpoints

- `POST /api/auth/login` — authenticate (returns session cookie)
- `GET /api/assets` — list all assets
- `GET /api/assets/{id}` — get asset detail
- `POST /api/assets/{id}` — correct asset (requires correction_reason field)

## Asset Correction Payload

```json
{
  "cost_basis": 80000.0,
  "residual_value": 8000.0,
  "useful_life_years": 4,
  "depreciation_method": "straight_line",
  "annual_depreciation": 18000.0,
  "correction_reason": "Fixed: was using declining_balance rate for straight_line asset"
}
```

All fields including `correction_reason` are required when correcting an asset.
