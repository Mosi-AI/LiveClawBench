# Audit Round 3: grocery-reorder

STATUS: FAIL

## Summary

The spec has improved significantly from previous rounds. Most prior findings have been addressed. However, one critical issue remains unresolved (F3 - task-binary-map.json entry), and one new issue was introduced regarding instruction leakage of the exact threshold.

## Findings

| issue_id | severity | checklist_source | spec_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|
| F3 | medium | Environment And Data Completeness | 4. Environment And Data Setup | The spec shows a task-binary-map.json entry in the spec document, but Round 2 noted this is an "implementation issue" meaning the actual `mock-platform/config/task-binary-map.json` file may not have been updated. The spec cannot enforce implementation; this is outside spec auditor scope but must be tracked. | Verify actual file is updated during implementation | Unresolved - implementation tracking |
| F10 | medium | Task Goal And Instruction Leakage | 3. Agent Instruction Draft | Agent instruction says "If we are running low on eggs" but Section 1 Raw Collection Sheet says "less than 1 dozen" - the spec removed the exact threshold from the main instruction, but the Raw Collection Sheet still contains it. More critically, Section 4 says "Inventory items seeded with eggs quantity below threshold (trigger condition)" and Section 8 says "Seed eggs quantity to be below threshold (e.g., 6 or 10 pieces)" - this reveals the hidden threshold to anyone reading the full spec. | Remove or generalize the threshold examples in Section 8 Implementation Notes; the Raw Collection Sheet is historical and can remain | Open |
| F11 | low | Verifier Contract | 6. Verifier Design | Precondition checks are now documented, but the verifier should also verify that the eggs quantity in inventory is actually below the ordering threshold. If the seed data accidentally has 12+ eggs, the task becomes trivially passable without agent action. | Add precondition check that initial eggs quantity < 12 | Open |

## Previous Round Verification

| issue_id | round | claimed_fix | verification |
|---|---|---|---|
| F1 | 1 | Remove precise threshold from instruction | **Partially fixed** - Main instruction now says "running low" instead of "less than 1 dozen", but Section 8 still reveals threshold examples |
| F2 | 1 | Clarify mock service ports | **Fixed** - Port 5004 is now specified in instruction and Section 4 |
| F3 | 1 | Add task-binary-map.json entry | **Unresolved** - Entry is in spec but Round 2 noted implementation issue |
| F4 | 1 | Document Docker image architecture | **Fixed** - Section 4 now includes full Docker Image Architecture subsection |
| F5 | 1 | Specify verifier state read path | **Fixed** - Section 6 specifies `/tmp/mosi_smart_home.sqlite` and table names |
| F6 | 1 | Clarify mock service responsibilities | **Fixed** - Section 4 clearly states Smart Home Mock provides both inventory and grocery APIs |
| F7 | 1 | Set case_id | **Fixed** - case_id = 32 in metadata and task.toml |
| F8 | 1 | Fix required files list | **Fixed** - Section 7 lists all 7 required files correctly |
| F9 | 2 | Add precondition checks and seed.sql requirements | **Fixed** - Section 6 has Precondition Checks subsection; Section 8 has CRITICAL note about seed.sql requirements |

## Metadata Check

- `task_name`: `grocery-reorder` ✓ (kebab-case)
- `case_id`: 32 ✓
- `ability_category`: cross environment composition ✓
- `source_domain`: E-commerce & Daily Services ✓
- `domains_multi`: ["E-commerce & Daily Svcs"] ✓ (matches domain)
- `mock_services`: smarthome ✓
- `difficulty`: easy ✓
- `factors_supported`: A1=1, A2=0, B1=0, B2=0 ✓
- Tags: `["e_commerce", "smart_home", "inventory_management"]` ✓ (snake_case, align with domains)
- No deprecated `capability_dimension` ✓

## Instruction Leakage Check

- Main instruction: "Check my smart fridge inventory. If we are running low on eggs, please order 1 dozen eggs from the grocery system." ✓ (no exact threshold)
- URL format: `http://localhost:5004/` ✓
- "open it in browser" present ✓
- Instruction length: adequate ✓
- **Issue**: Section 8 Implementation Notes reveals threshold examples ("e.g., 6 or 10 pieces") which could leak hidden constants if spec is shared with agent developers

## Environment And Verifier Check

### Environment
- Dockerfile base: `liveclawbench-grocery-reorder-base:latest` ✓
- Port 5004 specified ✓
- SQLite path: `/var/lib/mock-data/smarthome/smarthome.db` with verifier symlink ✓
- Startup script: `/opt/mock/startup.d/grocery-reorder.sh` ✓
- Entrypoint ends with `exec "$@"` ✓
- `allow_internet = true` ✓

### Verifier
- Type: `verify.py` ✓
- Dimensions: 3 dimensions with weights (0.5 + 0.3 + 0.2 = 1.0) ✓
- State read paths specified ✓
- Failure policies defined ✓
- Precondition checks added ✓
- Reward output: `/logs/verifier/reward.txt` ✓
- Zero-work baseline: 0.0 ✓
- **Missing**: Precondition should verify initial eggs quantity is below threshold

## Unresolved Issue Summary

1. **F3** (medium): task-binary-map.json implementation - outside spec scope, track during implementation
2. **F10** (medium): Section 8 reveals threshold examples - should generalize or remove
3. **F11** (low): Verifier precondition should verify initial eggs quantity is below ordering threshold
