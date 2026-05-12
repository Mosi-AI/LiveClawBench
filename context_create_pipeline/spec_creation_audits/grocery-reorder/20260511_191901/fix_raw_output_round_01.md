Now I have all the information. Let me produce the fixed spec:

```text
===SPEC_START===
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
| Grocery order exists for eggs | 0.5 | Query SQLite at `/tmp/mosi_smart_home.sqlite` — table `grocery_orders` | 0.0 if no order |
| Order quantity is 1 dozen | 0.3 | Check order item quantity in `grocery_order_items` table | Partial credit if wrong quantity |
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
===SPEC_END===

===FIX_LOG_START===
# Fix Log Round 1: grocery-reorder

## Fixed Findings

| issue_id | change made | spec sections changed |
|---|---|---|
| F1 | Removed precise threshold "less than 1 dozen" from instruction; changed to "running low on eggs" | 3. Agent Instruction Draft |
| F2 | Clarified that only Smart Home Mock (port 5004) is needed; removed Shop Mock reference; port 5004 matches smarthome mock snapshot | 1. Case Metadata, 4. Environment And Data Setup |
| F3 | Added explicit task-binary-map.json entry with smarthome binary and seed.sql asset | 4. Environment And Data Setup |
| F4 | Added Docker Image Architecture section explaining three-layer build: base → per-task → task | 4. Environment And Data Setup |
| F5 | Specified exact verifier state read path: `/tmp/mosi_smart_home.sqlite` with table names `grocery_orders` and `grocery_order_items` | 6. Verifier Design |
| F6 | Clarified that Smart Home Mock provides BOTH inventory API AND grocery ordering API; removed misleading "shop-web" reference | 1. Case Metadata, 4. Environment And Data Setup |
| F7 | Set case_id to 32 (next available after case_id 31 smarthome-test) | 1. Case Metadata |
| F8 | Removed `environment/startup.sh` from required files; startup is handled by `/opt/mock/startup.d/grocery-reorder.sh` per architecture | 7. Required Files |

## Unresolved Findings

| issue_id | reason not fixed | user action needed |
|---|---|---|
| — | All findings addressed | — |
===FIX_LOG_END===
```
