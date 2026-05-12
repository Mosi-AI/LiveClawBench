现在我已经收集了所有必要的信息。让我进行审计并输出审计报告。

---

# Audit Round 1: grocery-reorder

STATUS: FAIL

## Summary

Spec 结构完整，包含所有八个必需章节。但存在多个严重问题：instruction 泄露了阈值信息、verifier 设计缺少 precondition 检查的数据库表名细节、seed.sql 缺少对 eggs 产品 unit 字段的明确说明、以及 mock 服务描述中存在不准确的 API 路径。

## Findings

| issue_id | severity | checklist_source | spec_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|
| I001 | HIGH | 2. Task Goal And Instruction Leakage | 3. Agent Instruction Draft | Instruction says "If we are running low on eggs" but CSV says "less than 1 dozen" — the threshold "12 pieces" is leaked from verification method into agent-facing text | Remove explicit threshold from instruction; use natural language like "running low" without numeric threshold | OPEN |
| I002 | HIGH | 4. Verifier Contract | 6. Verifier Design | Precondition checks mention querying tables but do not specify exact table names (`grocery_product` vs `inventory_item`) and column names needed for implementation | Add exact table/column names: `grocery_product` table with `name` column, `inventory_item` table with `item_name` and `location` columns | OPEN |
| I003 | MEDIUM | 3. Environment And Data Completeness | 4. Environment And Data Setup | seed.sql requirement says eggs product with "unit (dozen)" but smarthome mock schema shows `grocery_product` table has no `unit` column — only `product_id, name, price, stock_status, substitute_for` | Clarify that the "dozen" unit is encoded in the product name (e.g., "Free Range Eggs (12 pack)") not in a separate unit column; or note that inventory_item.unit stores "pieces" while grocery product name encodes the dozen | OPEN |
| I004 | MEDIUM | 3. Environment And Data Completeness | 4. Environment And Data Setup | Mock snapshot says `/api/inventory` but spec section 4 lists `/api/inventory` endpoint without clarifying that inventory items have `location` field to distinguish fridge vs pantry | Add explicit note that inventory items must have `location = 'fridge'` for eggs item to match the task requirement | OPEN |
| I005 | LOW | 1. Structure And Metadata | 1. Case Metadata | `mock_services` field says "smarthome" but CSV `involved mock service` says "smart-home-app; shop-web" — these are inconsistent naming conventions | Normalize to single mock service name "smarthome" (matches task-binary-map.json and actual mock directory) | OPEN |
| I006 | LOW | 5. Security And Network | 1. Case Metadata / Suggested task.toml | `[environment].allow_internet = true` is correctly set but spec does not explain why (agent needs LLM API access) — this is implicit | Add rationale note: "Required for agent LLM API access" in Implementation Notes | OPEN |
| I007 | LOW | 3. Environment And Data Completeness | 5. Expected Behavior / Reference Path | Reference path says "Agent must interact with the web UI through browser automation" but does not clarify that the smarthome mock provides both Inventory page and Grocery page via web UI navigation | Clarify that the Dashboard has navigation links to Inventory and Grocery pages; agent should use web navigation, not direct URL jumps | OPEN |

## Previous Round Verification

Not applicable.

## Metadata Check

- `task_name`: `grocery-reorder` ✓ (kebab-case, matches CSV `id`)
- `case_id`: 32 ✓ (next available after case 31 in registry)
- `ability_category`: `cross environment composition` ✓
- `source_domain`: `E-commerce & Daily Services` ✓
- `domains_multi`: `E-commerce & Daily Svcs` ✓ (matches domain)
- `mock_services`: `smarthome` ✓ (normalized from CSV)
- `difficulty`: `easy` ✓
- `factors_supported`: A1=1 ✓ (Cross-Service Dependency: smart fridge → grocery ordering)
- `registry_description`: Present ✓
- `source_files`: `tasks/grocery-reorder/` ✓
- Suggested `task.toml`: All required fields present ✓
- No deprecated `capability_dimension` ✓

## Instruction Leakage Check

**FAIL**: Instruction draft contains leaked threshold information:
- CSV `task instruction` says: "If we are running out of eggs (less than 1 dozen)"
- Spec instruction says: "If we are running low on eggs"
- CSV `verification method` says: "if fridge count < 12 pieces"
- The threshold "12 pieces" / "1 dozen" is implicitly leaked through the phrase "running low" combined with the explicit "less than 1 dozen" in the raw CSV instruction

The instruction should avoid numeric thresholds entirely and use natural language like "running low" without specifying what constitutes "low". The verifier determines the threshold, not the agent instruction.

## Environment And Verifier Check

**Partial FAIL**:

Environment:
- Mock service correctly identified as smarthome (port 5004) ✓
- task-binary-map.json entry format correct ✓
- Dockerfile inheritance chain correct ✓
- Startup script path correct ✓

Verifier:
- Scoring dimensions defined ✓
- Weight distribution reasonable (0.5 + 0.3 + 0.2 = 1.0) ✓
- Zero-work baseline = 0.0 ✓
- **Missing**: Exact table/column names for precondition checks
- **Missing**: Clarification on how "dozen" unit is represented in grocery_product table (schema shows no unit column)

Data:
- seed.sql requirement mentions eggs product and eggs inventory item ✓
- **Missing**: Explicit requirement that inventory eggs item must have `location = 'fridge'`
- **Missing**: Clarification that grocery_product.name encodes the dozen unit (e.g., "Free Range Eggs (12 pack)")

## Unresolved Issue Summary

- I001: Instruction leaks threshold — remove numeric threshold from agent-facing text
- I002: Verifier precondition checks need exact table/column names
- I003: Clarify how "dozen" unit is represented in grocery_product table (no unit column in schema)
- I004: Add explicit requirement for inventory eggs item `location = 'fridge'`
- I005: Normalize mock service naming to "smarthome" consistently
- I006: Add rationale for `allow_internet = true`
- I007: Clarify web UI navigation structure for Inventory and Grocery pages
