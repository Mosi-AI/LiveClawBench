You are an isolated spec auditor for LiveClawBench. Your job is to audit the following spec and report findings.

You must NOT rewrite or fix the spec. You must be strict, concrete, and evidence-based.

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
- `case_id`: TODO from CSV
- `ability_category`: TODO from CSV
- `source_domain`: E-commerce & Daily Services
- `domains_multi`: E-commerce & Daily Services
- `mock_services`: smart-home-app; shop-web
- `difficulty`: easy (single conditional check and cross-service order)
- `factors_supported`: A1=1 (Cross-Service Dependency: smart fridge inventory → grocery ordering); A2=0; B1=0; B2=0
- `factors_extended`: None
- `registry_description`: Check smart fridge inventory and reorder eggs if running low
- `source_files`: TODO from CSV

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
case_id = "TODO"

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

The agent must check the smart fridge inventory to determine the current quantity of eggs. If the quantity is less than 12 pieces (1 dozen), the agent should place an order for 1 dozen eggs through the grocery ordering system.

## 3. Agent Instruction Draft

Check my smart fridge inventory. If we are running out of eggs (less than 1 dozen), please order 1 dozen eggs from the grocery system.

The smart home dashboard is available at http://localhost:5004/ — open it in browser to check the fridge inventory. The grocery ordering system is available at http://localhost:1234/ — open it in browser to place orders.

## 4. Environment And Data Setup

### Mock Services

1. **Smart Home Mock** (port 5004)
   - Provides `/api/inventory` endpoint to query fridge inventory
   - SQLite database at `/var/lib/mock-data/smarthome/smarthome.db`
   - Verifier-readable symlink: `/tmp/mosi_smart_home.sqlite`
   - Inventory items seeded with eggs quantity < 12 pieces (trigger condition)

2. **Shop Mock** (port 1234)
   - Provides `/api/grocery/products` and `/api/grocery/orders` endpoints
   - Grocery catalog includes eggs product
   - Order history persisted in JSON files

### Data Requirements

- Fridge inventory: eggs with quantity < 12 pieces (e.g., 6 pieces)
- Grocery catalog: eggs product with `product_id`, `name`, `price`, `stock_status`
- Distractor items: other fridge items (milk, butter, vegetables) and grocery products

### State Persistence

- Smart home state: `/var/lib/mock-data/smarthome/smarthome.db`
- Shop orders: JSON files in mock data directory
- Verifier reads grocery orders from `/api/grocery/orders` or order history

### Startup

- Both mocks start via `/opt/mock/startup.d/grocery-reorder.sh`
- Entrypoint script ends with `exec "$@"`

## 5. Expected Behavior / Reference Path

1. Agent opens smart home dashboard at http://localhost:5004/
2. Agent navigates to inventory page or calls `/api/inventory?location=fridge`
3. Agent finds eggs item with quantity < 12
4. Agent opens grocery system at http://localhost:1234/
5. Agent finds eggs product in catalog
6. Agent adds 1 dozen eggs (quantity=1 unit of 1 dozen) to cart
7. Agent places order
8. Order is created with eggs product

## 6. Verifier Design

### Verifier Type

`verify.py`

### Scoring Dimensions

| Dimension | Weight | State Read | Failure Policy |
|-----------|--------|------------|----------------|
| Grocery order exists for eggs | 0.5 | Query `/api/grocery/orders` or read order history | 0.0 if no order |
| Order quantity is 1 dozen | 0.3 | Check order item quantity | Partial credit if wrong quantity |
| Order created after task start | 0.2 | Compare order timestamp with task start | 0.0 if pre-existing order |

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
- `environment/startup.sh`
- `solution/solve.sh`
- `tests/test.sh`
- `tests/verify.py`

## 8. Implementation Notes And Pitfalls

### Critical Requirements

- `[environment].allow_internet = true` required for agent LLM API access
- Dockerfile inherits `liveclawbench-grocery-reorder-base:latest` (built by setup.sh)
- Both mocks must be running before agent starts

### Mock Integration

- Smart home mock uses SQLite with deterministic benchmark clock
- Shop mock uses JSON file storage
- Inventory snapshot captured at startup for comparison

### Potential Pitfalls

- Agent may check wrong inventory location (pantry vs fridge)
- Agent may order wrong quantity (pieces vs dozen)
- Agent may not find eggs product if catalog search fails
- Need to ensure eggs product exists in grocery catalog with correct unit (dozen)

### Data Synthesis Notes

- Seed eggs quantity to be exactly less than 12 pieces (e.g., 6 or 10)
- Ensure grocery catalog has eggs with unit "dozen" or equivalent
- Distractor products should not confuse the agent

---

# CSV Row

xc,提交人,id,task instruction,potential solution path,verification method,data synth req,involved other task domain ,involved mock service,complexity factors,,,,,,,,,,,

E-commerce & Daily Services,Gao Ying,grocery-reorder,"Check my smart fridge inventory. If we are running out of eggs (less than 1 dozen), please order 1 dozen eggs from the grocery system.",Open smart fridge -> read egg count -> check if < 12 pieces -> open grocery system -> order 1 dozen eggs.,Verify grocery order exists for 'eggs' with quantity 1 dozen if fridge count <  12 pieces.,Fridge inventory data. Grocery catalog.,E-commerce & Daily Services,smart-home-app; shop-web,,,,,,,,,,,,

---

# Mock Snapshot Listing

Smart Home Mock (mock-platform/mocks/smarthome/):
- src/index.tsx: 1974 lines, implements 8 domains including inventory and grocery ordering
- Port: 5004
- Database: SQLite at /var/lib/mock-data/smarthome/smarthome.db
- Inventory API: GET /api/inventory, POST /api/inventory, PUT /api/inventory/:id, DELETE /api/inventory/:id
- Grocery API: GET /api/grocery/products, POST /api/grocery/orders, GET /api/grocery/orders

Shop Mock (mock-platform/mocks/shop/):
- src/index.tsx: Shop mock service for e-commerce
- Port: 1234
- Note: Shop mock is separate from smarthome grocery domain

---

# Spec Checklist Rules

## 1. Structure And Metadata

- Top-level sections are exactly the eight required sections, in order.
- No extra peer-level sections.
- `task_name` is kebab-case and matches selected row/output file.
- `Case Metadata` preserves `task_name`, `case_id`, `ability_category`, `source_domain`, `domains_multi`, `mock_services`, `difficulty`, `factors_supported`, `factors_extended`, `registry_description`, and `source_files`.
- For raw collection-sheet rows, `Case Metadata` records missing canonical fields as `TODO from CSV` and preserves mapping notes.
- Suggested `task.toml` includes `version = "1.0"`, `category = "open-world"`, `difficulty`, `domain`, `domains_multi`, `tags`, factors, and `case_id`.
- `domains_multi[0]` matches `domain`.
- Tags align with domains and use stable snake_case.
- Only A1/A2/B1/B2 become task.toml fields; A3/A4/C1/C2 remain notes.
- No deprecated `capability_dimension`.

## 2. Task Goal And Instruction Leakage

- `Task Goal` describes only the user-visible objective.
- `Task Goal` and `Agent Instruction Draft` do not reveal scoring rules, correct answers, hidden state, verifier file names, exact thresholds, hidden IDs, verifier-only database fields, or hidden oracle constants.
- Raw collection-sheet fields named `potential solution path` and `verification method` are not copied into `Agent Instruction Draft`.
- No `Score`, `reward`, `checkpoint`, `pass/fail`, `full credit`, `partial credit`, or `verifier requires` language.
- Instruction is at least 100 characters and reads like a real single-turn user request.
- URL-bearing instructions use `http://localhost:<port>/` and say `open it in browser`.
- Paths are Linux container paths or natural relative paths, not Windows paths.
- Implicit-goal tasks expose natural user intent, not all verifier predicates.

## 3. Environment And Data Completeness

- Environment files, ports, and data sources map to planned implementation files.
- Raw collection-sheet `data synth req` and `involved mock service` facts are reflected in environment/data requirements or explicitly marked missing/uncertain.
- Dockerfile base is `liveclawbench-base:latest` or `ARG OPENCLAW_BASE_IMAGE=liveclawbench-base:latest`.
- COPY paths align with startup, entrypoint, and verifier reads.
- Pip installs include `--break-system-packages` when relevant.
- Background services include startup scripts, ports, readiness order, and persistence paths.
- `entrypoint.sh` ends with `exec "$@"`.
- Executed shell scripts require LF, shebang, and executable bit.
- Instruction ports match service ports.
- Data has correct targets plus useful distractors; distractors are similar enough to matter.
- Domain realism is addressed: dates, units, status transitions, money, time zones, roles, cross-table joins, source freshness, or code fixture boundaries.

## 4. Verifier Contract

- Verifier design covers all scoring points from the CSV/scoring overview.
- Reward is normalized to 0.0-1.0.
- Each dimension has state read, weight, failure policy, and partial credit.
- `tests/test.sh` is non-stub and calls real verifier code.
- `tests/test.sh` creates `/logs/verifier` and writes `/logs/verifier/reward.txt`.
- `reward.json` has numeric `reward`; non-numeric fields use `_meta_` prefix.
- `verify.py` mode prints `Score: X.X/1.0` or writes reward directly and uses a clear exit convention.
- `evaluate.py` mode has structured pass/fail output or equivalent numeric scoring.
- `llm_judge.py` mode includes deterministic gates and companion files.
- LLM judge credentials are runtime `--ee` variables only.
- Zero-work baseline is 0.0 or explicitly guarded so agent action is required to pass.
- Verifier does not depend on `tests/` at Docker build time.

## 5. Security And Network

- `[environment].allow_internet = true` is explicit.
- No hard-coded `*_API_KEY`, `JUDGE_*`, `CUSTOM_*`, model id, temperature, or reasoning setting.
- Real external services are not required unless the task explicitly needs internet and a fallback/snapshot strategy exists.
- Public datasets have source/license/privacy notes when used.
- No real personal sensitive data.

## 6. Syntax And A2 Boundaries

- Python, JSON, YAML/TOML, shell, and Dockerfile content is planned as statically parseable.
- A2 tasks may intentionally break only the target environment fixture.
- Tests, solution, Dockerfile, and shell scripts must remain syntactically valid.
- Historical non-compliant verifier behavior is not treated as target design; conflicts are listed in pitfalls.

## 7. Open Questions

- Missing mock assets are explicitly noted.
- Missing noise/domain constraints are noted with impact and resolution.
- Missing scoring or verifier state paths are noted with impact and resolution.
- No uncertain fact is presented as confirmed.