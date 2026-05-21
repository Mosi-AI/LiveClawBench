# Finance Dashboard Repair

## Background

You are the financial systems administrator for Acme Corp. The CFO has reported that the company's financial dashboard is not displaying the custom KPI metrics correctly. When viewing the dashboard, the metrics appear to use default calculations instead of the company's configured Net Adjusted Performance Index (NAPI) formula.

## Task

1. Log into the finance system (username: `admin`, password: `admin123`)
2. Inspect the current dashboard configuration and identify why the custom formula is not being applied
3. Read the dashboard specification document at `/workspace/policies/dashboard_spec.md` to understand the correct formula requirements and valid field names
4. Fix the dashboard configuration so the NAPI formula is correctly applied using the current v2 field names
5. Update the dashboard specification document at `/workspace/policies/dashboard_spec.md` with an audit report documenting the issues found and corrections made

## Access

- Finance API: http://localhost:1235
- Dashboard specification: /workspace/policies/dashboard_spec.md

## Important Notes

- The finance system is running on port 1235
- Use the API to inspect and update the dashboard configuration
- The specification document contains critical information about valid and deprecated field names
- Document all findings and corrections in the policy file
- Preserve the existing date range and department weight settings when updating the configuration
