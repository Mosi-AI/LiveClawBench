You are an isolated spec auditor for LiveClawBench. Your job is to audit the following spec and report findings.

You must NOT rewrite or fix the spec. You must be strict, concrete, and evidence-based.
You must verify whether previous findings were actually fixed.

You must output exactly this format:

```markdown
# Audit Round <N>: <task_name>

STATUS: PASS|FAIL

## Summary
<brief summary>

## Findings
| issue_id | severity | checklist_source | spec_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|

## Previous Round Verification
<for round 1 write: Not applicable. For later rounds, list fixed/still-open prior findings.>

## Metadata Check
<whether task.toml metadata requirements are represented correctly>

## Instruction Leakage Check
<whether agent-facing text avoids hidden answers/verifier/scoring leaks>

## Environment And Verifier Check
<whether environment, files, tests, reward outputs, and verifier plan are complete and robust>

## Unresolved Issue Summary
<only unresolved issues; write None if PASS>
```

If no issues exist, `## Findings` must say exactly `No open findings.` and `STATUS: PASS`.

---

# Spec to Audit

## 1. Case Metadata

- `task_name`: `grocery-reorder`
- `case_id`: 32
- `ability_category`: cross environment composition
- `source_domain`: E-commerce & Daily Services
- `domains_multi`: E-commerce & Daily Services
- `mock_services`: smarthome
- `difficulty`: easy (single conditional check and cross-service order)
- `factors_supported`: A1=1 (Cross-Service Dependency: smart fridge inventory → grocery ordering); A2=0; B1=0; B2=0
- `factors_extended`: None
- `registry_description`: Check smart fridge inventory and reorder eggs if running low
- `source_files`: tasks/grocery-reorder/

### Raw Collection Sheet Fields

- `xc`: E-commerce & Daily Services
- `提交人`: Gao Ying
- `id`: grocery-reorder
- `task instruction`: Check my smart fridge inventory. If we are running out of eggs (less than 1 dozen), please order 1 dozen eggs from the grocery system.
- `potential solution path`: Open smart fridge -> read egg count -> check if < 12 pieces -> open grocery system -> order 1 dozen eggs.
- `verification method`: Verify grocery order exists for 'eggs' with quantity 1 dozen if fridge count < 12 pieces.
- `data synth req`: Fridge inventory data. Grocery catalog.
- `involved other task domain`: (empty)
- `involved mock service`: smart-home-app; shop-web
- `complexity factors`: (empty)

### Suggested task.toml

```toml
version = "1.0"

[metadata]
difficulty = "easy"
category = "open-world"
tags = ["e_commerce", "smart_home", "inventory_management"]
domain = "E-commerce & Daily Svcs"
domains_multi = ["E-commerce & Daily Svcs"]
factor_a1 = 1
factor_a2 = 0
factor_b1 = 0
factor_b2 = 0
case_id = "32"

[verifier]
timeout_sec = 900.0

[agent]
timeout_sec = 1800.0

[environment]
build_timeout_sec = 600.0
cpus = 2
memory_mb = 4096
storage_mb = 10240
allow_internet = true
```

## 2. Task Goal

The agent must check the smart fridge inventory to determine the current quantity of eggs. If the quantity is low, the agent should place an order for 1 dozen eggs through the grocery ordering system within the Smart Home dashboard.

## 3. Agent Instruction Draft

Check my smart fridge inventory. If we are running low on eggs, please order 1 dozen eggs from the grocery system.

The smart home dashboard is available at http://localhost:5004/ — open it in browser to check the fridge inventory and place grocery orders.

## 4. Environment And Data Setup

### Mock Services

1. **Smart Home Mock** (port 5004) — the only mock service needed for this task
   - Provides `/api/inventory` endpoint to query fridge/pantry inventory
   - Provides `/api/grocery/products` endpoint for grocery product catalog
   - Provides `/api/grocery/orders` endpoint for placing grocery orders
   - SQLite database at `/var/lib/mock-data/smarthome/smarthome.db`
   - Verifier-readable symlink: `/tmp/mosi_smart_home.sqlite`
   - Inventory items seeded with eggs quantity below threshold (trigger condition)

### task-binary-map.json Entry

```json
"grocery-reorder": {
  "binaries": ["smarthome"],
  "assets": [
    { "src": "tasks/grocery-reorder/environment/seed.sql", "dest": "/opt/mock/data/smarthome.sql" }
  ]
}
```

### Data Requirements

- Fridge inventory: eggs with quantity below threshold (e.g., 6 pieces)
- Grocery catalog: eggs product with `product_id`, `name`, `price`, `unit` (dozen)
- Distractor items: other fridge items (milk, butter, vegetables) and grocery products

### State Persistence

- Smart home state: `/var/lib/mock-data/smarthome/smarthome.db`
- Verifier reads grocery orders from `/api/grocery/orders` endpoint or directly from SQLite at `/tmp/mosi_smart_home.sqlite`

### Startup

- Smart Home Mock starts via `/opt/mock/startup.d/grocery-reorder.sh`
- Entrypoint script ends with `exec "$@"`

### Docker Image Architecture

- Base layer: `liveclawbench-base:latest` (built by `setup.sh` step 3)
- Per-task layer: `liveclawbench-grocery-reorder-base:latest` (built by `setup.sh` step 4 via `mock-platform/scripts/build-task-images.ts`)
- Task layer: `FROM liveclawbench-grocery-reorder-base:latest` in `environment/Dockerfile`

## 5. Expected Behavior / Reference Path

1. Agent opens smart home dashboard at http://localhost:5004/
2. Agent navigates to inventory page or calls `/api/inventory?location=fridge`
3. Agent finds eggs item with low quantity
4. Agent navigates to grocery section or calls `/api/grocery/products`
5. Agent finds eggs product in catalog
6. Agent adds 1 dozen eggs (quantity=1 unit of 1 dozen) to cart
7. Agent places order via `/api/grocery/orders`
8. Order is created with eggs product

## 6. Verifier Design

### Verifier Type

`verify.py`

### Scoring Dimensions

| Dimension | Weight | State Read | Failure Policy |
|-----------|--------|------------|----------------|
| Grocery order exists for eggs | 0.5 | Query SQLite at `/tmp/mosi_smart_home.sqlite` — table `grocery_order` | 0.0 if no order |
| Order quantity is 1 dozen | 0.3 | Check order item quantity in `grocery_order_item` table | Partial credit if wrong quantity |
| Order created after task start | 0.2 | Compare order timestamp with task start | 0.0 if pre-existing order |

### Precondition Checks

Before scoring, the verifier MUST verify that:
1. The grocery catalog contains an eggs product (query `grocery_product` table for `name LIKE '%egg%'`)
2. The fridge inventory contains an eggs item (query `inventory_item` table for `item_name LIKE '%egg%'`)

If either precondition fails, the verifier should log an error and return score 0.0 with a clear message indicating the data setup issue (this indicates a task implementation bug, not agent failure).

### Reward Output

- Write to `/logs/verifier/reward.txt`
- Print `Score: X.X/1.0`
- Exit non-zero if score < 0.5

### Zero-Work Baseline

If agent does nothing, no grocery order exists → score 0.0

## 7. Required Files

- `task.toml`
- `instruction.md`
- `environment/Dockerfile`
- `environment/seed.sql`
- `solution/solve.sh`
- `tests/test.sh`
- `tests/verify.py`

## 8. Implementation Notes And Pitfalls

### Critical Requirements

- `[environment].allow_internet = true` required for agent LLM API access
- Dockerfile inherits `liveclawbench-grocery-reorder-base:latest` (built by setup.sh step 4)
- Smart Home Mock must be running before agent starts

### Mock Integration

- Smart Home Mock uses SQLite with deterministic benchmark clock
- The same mock provides both inventory checking AND grocery ordering APIs
- Inventory snapshot captured at startup for comparison

### Potential Pitfalls

- Agent may check wrong inventory location (pantry vs fridge)
- Agent may order wrong quantity (pieces vs dozen)
- Agent may not find eggs product if catalog search fails
- Need to ensure eggs product exists in grocery catalog with correct unit (dozen)

### Data Synthesis Notes

- Seed eggs quantity to be below threshold (e.g., 6 or 10 pieces)
- Ensure grocery catalog has eggs with unit "dozen" or equivalent
- Distractor products should not confuse the agent
- **CRITICAL**: `seed.sql` MUST include:
  - An eggs product in `grocery_product` table with appropriate product details
  - An eggs item in `inventory_item` table with `location = 'fridge'` and quantity below threshold
  - Without these records, the task is unsolvable and the verifier will fail with a precondition error

---

# Previous Audit Reports

## Round 1 Findings (all claimed fixed)

| issue_id | severity | required_fix |
|---|---|---|
| F1 | high | Remove precise threshold from instruction |
| F2 | medium | Clarify mock service ports |
| F3 | medium | Add task-binary-map.json entry |
| F4 | medium | Document Docker image architecture |
| F5 | medium | Specify verifier state read path |
| F6 | medium | Clarify mock service responsibilities |
| F7 | low | Set case_id |
| F8 | low | Fix required files list |

## Round 2 Findings

| issue_id | severity | required_fix | status |
|---|---|---|---|
| F3 | medium | Add entry to actual task-binary-map.json file | Unresolved - implementation issue |
| F9 | low | Add precondition checks and seed.sql requirements | Claimed fixed |

---

# Spec Checklist Rules

## 1. Structure And Metadata

- Top-level sections are exactly the eight required sections, in order.
- No extra peer-level sections.
- `task_name` is kebab-case and matches selected row/output file.
- `Case Metadata` preserves all required fields.
- Suggested `task.toml` includes all required fields.
- `domains_multi[0]` matches `domain`.
- Tags align with domains and use stable snake_case.
- Only A1/A2/B1/B2 become task.toml fields.
- No deprecated `capability_dimension`.

## 2. Task Goal And Instruction Leakage

- `Task Goal` describes only the user-visible objective.
- `Task Goal` and `Agent Instruction Draft` do not reveal scoring rules, correct answers, hidden state, verifier file names, exact thresholds, hidden IDs, verifier-only database fields, or hidden oracle constants.
- No `Score`, `reward`, `checkpoint`, `pass/fail`, `full credit`, `partial credit`, or `verifier requires` language.
- Instruction is at least 100 characters and reads like a real single-turn user request.
- URL-bearing instructions use `http://localhost:<port>/` and say `open it in browser`.
- Paths are Linux container paths or natural relative paths.

## 3. Environment And Data Completeness

- Environment files, ports, and data sources map to planned implementation files.
- Dockerfile base is `liveclawbench-base:latest` or uses ARG.
- COPY paths align with startup, entrypoint, and verifier reads.
- Background services include startup scripts, ports, readiness order, and persistence paths.
- `entrypoint.sh` ends with `exec "$@"`.
- Instruction ports match service ports.
- Data has correct targets plus useful distractors.

## 4. Verifier Contract

- Verifier design covers all scoring points.
- Reward is normalized to 0.0-1.0.
- Each dimension has state read, weight, failure policy, and partial credit.
- `tests/test.sh` is non-stub and calls real verifier code.
- `tests/test.sh` creates `/logs/verifier` and writes `/logs/verifier/reward.txt`.
- Zero-work baseline is 0.0 or explicitly guarded.

## 5. Security And Network

- `[environment].allow_internet = true` is explicit.
- No hard-coded credentials or model settings.

## 6. Syntax And A2 Boundaries

- Python, JSON, YAML/TOML, shell, and Dockerfile content is planned as statically parseable.
- Tests, solution, Dockerfile, and shell scripts must remain syntactically valid.

## 7. Open Questions

- Missing mock assets are explicitly noted.
- No uncertain fact is presented as confirmed.