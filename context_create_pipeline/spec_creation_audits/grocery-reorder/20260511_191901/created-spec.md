# Spec: grocery-reorder

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
