# Fix Log Round 2: grocery-reorder

## Fixed Findings

| issue_id | change made | spec sections changed |
|---|---|---|
| 008 | Added complete SQL seed file content for both smarthome_seed.sql and shop_seed.sql with all table schemas and seed data | 7. Required Files (new subsection "SQL Seed File Content") |
| 009 | Added "Agent Output Access" subsection specifying that verifier reads agent response from `/logs/agent/final_response.txt` populated by harbor's agent output capture | 6. Verifier Design (new subsection), 6. Verifier Design → Scoring Dimensions table |
| 010 | Added example JSON structure for orders.items column showing the format for initial orders | 4. Environment And Data Setup (new subsection "Shop - Orders.items JSON Structure") |
| 012 | Removed specific example order_id "ORD000003" from reference path step 12, changed to generic "the generated order_id" | 5. Expected Behavior / Reference Path (step 12) |

## Unresolved Findings

| issue_id | reason not fixed | user action needed |
|---|---|---|
| 007 | Per user instructions: URLs with port numbers are REQUIRED for browser-only interaction. The agent cannot discover services without being told where to access them. This is NOT instruction leakage but necessary configuration. | None - this is intentional design per user constraint |
