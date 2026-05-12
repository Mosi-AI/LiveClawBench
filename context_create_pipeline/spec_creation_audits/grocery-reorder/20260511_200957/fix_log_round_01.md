# Fix Log Round 1: grocery-reorder

## Fixed Findings

| issue_id | change made | spec sections changed |
|---|---|---|
| I001 | Removed explicit threshold "less than 1 dozen" from agent instruction; changed to "running low on eggs" to avoid leaking the decision threshold | 3. Agent Instruction Draft |
| I002 | Added complete database schema reference with exact table/column names for all four relevant tables (grocery_product, inventory_item, grocery_order, grocery_order_item) | 6. Verifier Design |
| I003 | Added explicit note that grocery_product table has no unit column; clarified that unit info should be encoded in product name field (e.g., "Eggs (1 dozen)") | 4. Environment And Data Setup |
| I004 | Added explicit requirement for inventory eggs item to have `location = 'fridge'` in precondition checks and data synthesis notes | 4. Environment And Data Setup, 6. Verifier Design |
| I005 | Normalized mock_services to "smarthome" (already correct in spec) | 1. Case Metadata |
| I006 | Added `allow_internet_rationale` field explaining LLM API access requirement | 1. Case Metadata |
| I007 | Added detailed Web UI Navigation Structure section describing the navigation bar, Inventory page layout (Fridge/Pantry sections), and Grocery page layout (product table, cart, order history) | 5. Expected Behavior |

## Unresolved Findings

| issue_id | reason not fixed | user action needed |
|---|---|---|
| (none) | All findings addressed | N/A |