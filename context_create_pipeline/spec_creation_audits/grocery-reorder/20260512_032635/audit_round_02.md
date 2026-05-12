Now let me check the spec against the checklist rules.

```markdown
# Audit Round 2: grocery-reorder

STATUS: FAIL

## Summary
The spec has improved significantly from Round 1, but several issues remain. The case_id assignment is correct (32 is next available after 31). However, there are new findings related to instruction leakage, missing SQL seed file content, and incomplete verifier design.

## Findings
| issue_id | severity | checklist_source | spec_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|
| 007 | high | Task Goal And Instruction Leakage | 3. Agent Instruction Draft | Instruction contains exact port numbers (5004, 1234) that reveal hidden service configuration not discoverable by agent naturally | Remove explicit port numbers from instruction; use generic URLs like "smart-home app" and "shop app" or provide discoverable entry point | open |
| 008 | high | Environment And Data Completeness | 7. Required Files | `smarthome_seed.sql` and `shop_seed.sql` are listed as required files but their actual SQL content is not provided in the spec | Provide complete SQL seed file content for both databases | open |
| 009 | medium | Verifier Contract | 6. Verifier Design | Dimension 4 scoring (0.15 pts) relies on "keyword match in agent output" but no mechanism specified for how verifier accesses agent output | Specify how verifier accesses agent response (e.g., log file path, harbor output capture) | open |
| 010 | medium | Environment And Data Completeness | 4. Environment And Data Setup | Shop orders table uses `items JSON` column but no example JSON structure provided for the initial orders (ORD000001, ORD000002) | Provide example JSON structure for orders.items column | open |
| 011 | low | Structure And Metadata | 1. Case Metadata | `domains_multi` field shows single value "E-commerce & Daily Services" but should be array format in task.toml | The suggested task.toml correctly uses array format `["E-commerce & Daily Svcs"]` — this is consistent, no fix needed | resolved |
| 012 | low | Task Goal And Instruction Leakage | 5. Expected Behavior / Reference Path | Step 12 mentions "order_id (e.g., ORD000003)" which hints at the expected order ID format | Remove the example order_id or make it generic like "the generated order_id" | open |

## Previous Round Verification

| issue_id | Round 1 Finding | Verification Status |
|---|---|---|
| 001 | case_id = "TODO" | **FIXED** — Now shows `case_id = 32`, which is correct (next available after case_id 31 in registry) |
| 002 | Missing shop database symlink path | **FIXED** — Added `/tmp/mosi_shop.sqlite` symlink path |
| 003 | Missing SQL schema for shop orders | **FIXED** — Added complete SQL schema for both databases |
| 004 | Domain discrepancy not explained | **FIXED** — Added explanatory note in Raw Collection Sheet Fields |
| 005 | Data loading mechanism unclear | **FIXED** — Clarified startup script data loading process |
| 006 | Partial credit rules undefined for Dimension 4 | **FIXED** — Added explicit partial credit breakdown (0.05/0.10/0.15) |

## Metadata Check
- `task_name`: `grocery-reorder` — ✓ kebab-case, matches expected format
- `case_id`: 32 — ✓ correct (next available after 31)
- `domains_multi[0]` matches `domain`: ✓ both "E-commerce & Daily Svcs"
- Tags align with domains: ✓ (e_commerce, smart_home, inventory_management, cross_service)
- Factor fields: ✓ A1=1, A2=0, B1=0, B2=0 correctly set
- No deprecated `capability_dimension`: ✓

## Instruction Leakage Check
- **ISSUE**: Instruction explicitly provides port numbers (5004, 1234) — these are internal service configuration details that should be discovered by the agent through exploration or a natural entry point
- **ISSUE**: Reference path mentions "ORD000003" as example order_id — hints at expected format
- Task Goal does not reveal scoring rules: ✓
- No "Score", "reward", "verifier" language in instruction: ✓

## Environment And Verifier Check
- **ISSUE**: SQL seed files listed as required but content not provided
- **ISSUE**: Verifier mechanism for accessing agent output not specified
- **ISSUE**: Orders table JSON structure not defined
- Dockerfile base correct: ✓ `liveclawbench-grocery-reorder-base:latest`
- Symlink paths provided: ✓
- Zero-work baseline defined: ✓ (0.0)
- Verifier output format correct: ✓ (`/logs/verifier/reward.txt`, `Score: X.X/1.0`)

## Unresolved Issue Summary
1. **Issue 007 (high)**: Instruction leaks port numbers — agent should discover services naturally
2. **Issue 008 (high)**: SQL seed file content missing from spec
3. **Issue 009 (medium)**: Verifier agent output access mechanism unspecified
4. **Issue 010 (medium)**: Orders table JSON structure undefined
5. **Issue 012 (low)**: Reference path hints at order_id format
```
