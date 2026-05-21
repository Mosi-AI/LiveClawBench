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

When correcting an asset, POST to `/api/assets/{id}` with a JSON body containing all asset fields:
- `cost_basis` (number)
- `residual_value` (number)
- `useful_life_years` (number)
- `depreciation_method` (string: "straight_line" or "declining_balance")
- `annual_depreciation` (number: must match the correct calculation per policy)
- `correction_reason` (string: explain what was wrong and how you fixed it)

All fields are required when correcting an asset. Calculate the correct `annual_depreciation` based on the policy rules and include a meaningful `correction_reason`.
