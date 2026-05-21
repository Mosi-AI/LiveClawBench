# Asset Depreciation Policy

## Depreciation Methods

### Straight-Line Method (Primary)
Annual depreciation = (Cost Basis - Residual Value) / Useful Life Years

This is the default method for all assets unless otherwise specified.

### Declining Balance Method (Alternative)
Annual depreciation = Cost Basis * (2 / Useful Life Years)

Note: The declining balance method uses the double-declining rate. The residual value is used as a floor but does not reduce the annual calculation base.

### Sum-of-Years-Digits Method (Legacy)
Annual depreciation = (Cost Basis - Residual Value) * (Remaining Life / Sum of Years)

**DEPRECATED**: This method was used prior to 2024. Any assets still using this method should be converted to straight-line.

## Asset Categories and Default Useful Life

| Category | Default Life (years) | Default Method |
|----------|---------------------|----------------|
| IT Equipment | 4-5 | straight_line |
| Vehicles | 5-6 | declining_balance |
| Office Furniture | 10 | straight_line |
| Buildings | 25-30 | straight_line |
| Network Equipment | 5 | straight_line |
| Industrial Equipment | 8-10 | straight_line |

## Audit Procedures

1. Verify each asset's depreciation method matches its category default
2. Calculate expected annual depreciation using the applicable formula
3. Compare calculated value against recorded annual_depreciation
4. Document discrepancies with correction_reason
5. Update the policy with audit findings

## Special Rules

- Assets purchased mid-year use full-year depreciation in the first year
- Fully depreciated assets (accumulated > cost - residual) should have annual_depreciation set to 0
- Residual value must be >= 0 and < cost_basis
- Useful life must be >= 1 year

## Historical Notes

- Prior to 2024, the company used a hybrid depreciation method for vehicles that has since been standardized to declining_balance
- The straight_line method applies to all IT equipment regardless of purchase date
- Office furniture depreciation rate changed from 15 years to 10 years in 2025; assets purchased before 2025 should retain their original useful life
