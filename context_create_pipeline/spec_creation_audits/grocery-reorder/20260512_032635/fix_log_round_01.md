# Fix Log Round 1: grocery-reorder

## Fixed Findings

| issue_id | change made | spec sections changed |
|---|---|---|
| 001 | Assigned `case_id = 32` from cases_registry.csv (next available after case_id 31) | Case Metadata, Suggested task.toml |
| 002 | Added explicit verifier-readable symlink path for shop database: `/tmp/mosi_shop.sqlite` | 4. Environment And Data Setup (Mock Services, State Persistence), 6. Verifier Design (Verifier State Paths table) |
| 003 | Added complete SQL schema for both databases including grocery_product, orders, and products tables | 6. Verifier Design (Database Schema Reference) |
| 004 | Added explanatory note in Raw Collection Sheet Fields section explaining the domain discrepancy between `xc` field ("Health & Wellness") and `source_domain` ("E-commerce & Daily Services") | Raw Collection Sheet Fields |
| 005 | Clarified data loading mechanism in Startup section: explained how SQL seed files are loaded into databases and how symlinks are created | 4. Environment And Data Setup (Startup) |
| 006 | Defined explicit partial credit rules for Dimension 4: 0.05 for mentioning "2.5 dozen" or "30 pieces"; 0.10 for explaining rounding with keywords; full 0.15 for complete explanation | 6. Verifier Design (Scoring Dimensions) |

## Unresolved Findings

| issue_id | reason not fixed | user action needed |
|---|---|---|
| (none) | All identified issues have been addressed | N/A |
