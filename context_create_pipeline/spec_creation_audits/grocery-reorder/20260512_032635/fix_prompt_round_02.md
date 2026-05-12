You are an isolated spec fixer for LiveClawBench. Your role is to fix the identified issues in the spec while preserving correct content and all CSV row facts. You must modify only the spec markdown.

**IMPORTANT USER CONSTRAINT**: The user has explicitly stated that the agent must interact through browser UI only, NOT direct API calls. Therefore, providing URLs with port numbers in the instruction is REQUIRED and NOT a leakage issue. The agent cannot discover services without being told where to access them.

## Current Spec

Read from: context_create_pipeline/spec_creation_audits/grocery-reorder/20260512_032635/grocery-reorder.md

## Current Audit Report (Round 2)

```markdown
# Audit Round 2: grocery-reorder

STATUS: FAIL

## Findings
| issue_id | severity | checklist_source | spec_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|
| 007 | high | Task Goal And Instruction Leakage | 3. Agent Instruction Draft | Instruction contains exact port numbers (5004, 1234) that reveal hidden service configuration not discoverable by agent naturally | Remove explicit port numbers from instruction; use generic URLs like "smart-home app" and "shop app" or provide discoverable entry point | open |
| 008 | high | Environment And Data Completeness | 7. Required Files | `smarthome_seed.sql` and `shop_seed.sql` are listed as required files but their actual SQL content is not provided in the spec | Provide complete SQL seed file content for both databases | open |
| 009 | medium | Verifier Contract | 6. Verifier Design | Dimension 4 scoring (0.15 pts) relies on "keyword match in agent output" but no mechanism specified for how verifier accesses agent output | Specify how verifier accesses agent response (e.g., log file path, harbor output capture) | open |
| 010 | medium | Environment And Data Completeness | 4. Environment And Data Setup | Shop orders table uses `items JSON` column but no example JSON structure provided for the initial orders (ORD000001, ORD000002) | Provide example JSON structure for orders.items column | open |
| 012 | low | Task Goal And Instruction Leakage | 5. Expected Behavior / Reference Path | Step 12 mentions "order_id (e.g., ORD000003)" which hints at the expected order ID format | Remove the example order_id or make it generic like "the generated order_id" | open |
```

## Fix Instructions

1. **Issue 007**: DO NOT FIX. The user explicitly requires browser-only interaction. URLs with port numbers are necessary for the agent to access services. This is NOT instruction leakage - it's required configuration.

2. **Issue 008**: Provide complete SQL seed file content for both smarthome_seed.sql and shop_seed.sql.

3. **Issue 009**: Specify how verifier accesses agent output (harbor captures agent output in `/logs/agent/` directory).

4. **Issue 010**: Provide example JSON structure for orders.items column.

5. **Issue 012**: Remove the example order_id "ORD000003" from reference path, make it generic.

Address every open finding that can be fixed. Do not hide unresolved issues.

## Output Format

Output exactly:

```
===SPEC_START===
<complete revised spec markdown>
===SPEC_END===

===FIX_LOG_START===
# Fix Log Round 2: grocery-reorder

## Fixed Findings

| issue_id | change made | spec sections changed |
|---|---|---|

## Unresolved Findings

| issue_id | reason not fixed | user action needed |
|---|---|---|
===FIX_LOG_END===
```