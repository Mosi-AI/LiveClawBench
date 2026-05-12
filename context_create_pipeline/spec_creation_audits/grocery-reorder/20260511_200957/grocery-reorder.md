# Spec: grocery-reorder

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
- `allow_internet_rationale`: Required for agent LLM API access during task execution

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

The agent must check the smart fridge inventory to determine the current quantity of eggs. If the quantity indicates we are running low, the agent should place an order for 1 dozen eggs through the grocery ordering system within the Smart Home dashboard.

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

- Fridge inventory: eggs with quantity below threshold (e.g., 6 pieces with unit "pieces")
- Grocery catalog: eggs product with `product_id`, `name` (e.g., "Eggs (1 dozen)"), `price`, `stock_status`
- Distractor items: other fridge items (milk, butter, vegetables) and grocery products

**Note**: The `grocery_product` table does NOT have a `unit` column. The unit information (dozen) should be encoded in the product `name` field (e.g., "Eggs (1 dozen)" or "Eggs - 12 count").

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

1. Agent opens smart home dashboard at http://localhost:5004/ in browser
2. Agent clicks "Inventory" navigation link to access `/inventory` page
3. Agent visually identifies eggs item with low quantity in the **Fridge** section (items are grouped by location: Fridge and Pantry)
4. Agent clicks "Grocery" navigation link to access `/grocery` page
5. Agent finds eggs product in the product list displayed on the page (product name indicates "dozen" unit)
6. Agent sets quantity to 1 and clicks "Add" button to add eggs to shopping cart
7. Agent clicks "Place Order" button to submit the order
8. Order confirmation is displayed and order is created

**IMPORTANT**: Agent must interact with the web UI through browser automation (clicking, typing, form submission). Direct API calls are NOT allowed for this task.

### Web UI Navigation Structure

The Smart Home dashboard has a navigation bar with links to:
- Dashboard (`/`)
- Thermostat (`/thermostat`)
- Coffee (`/coffee`)
- **Inventory** (`/inventory`) — where fridge/pantry items are displayed
- **Grocery** (`/grocery`) — where products can be browsed and ordered
- Wearable (`/wearable`)
- Calendar (`/calendar`)
- Meal Plan (`/meal-plan`)

The Inventory page displays items in two separate sections: "Fridge" and "Pantry". Each section shows a table with columns: Item, Quantity, Unit, Expiry, Actions.

The Grocery page displays a product table with columns: Product, Price, Stock, Qty, Action. Below the product table is a Shopping Cart section and an Order History section.

## 6. Verifier Design

### Verifier Type

`verify.py`

### Database Schema Reference

The verifier queries the following tables and columns:

**`grocery_product` table**:
- `product_id` TEXT PRIMARY KEY
- `name` TEXT NOT NULL
- `price` REAL NOT NULL
- `stock_status` TEXT NOT NULL (in_stock, low_stock, out_of_stock)
- `substitute_for` TEXT

**`inventory_item` table**:
- `id` INTEGER PRIMARY KEY
- `item_name` TEXT NOT NULL
- `quantity` REAL NOT NULL
- `unit` TEXT NOT NULL
- `location` TEXT NOT NULL (fridge, pantry)
- `expiry_date` TEXT
- `category` TEXT
- `updated_at` TEXT

**`grocery_order` table**:
- `order_id` TEXT PRIMARY KEY
- `total` REAL NOT NULL
- `created_at` TEXT NOT NULL

**`grocery_order_item` table**:
- `id` INTEGER PRIMARY KEY
- `order_id` TEXT NOT NULL
- `product_id` TEXT NOT NULL
- `quantity` INTEGER NOT NULL
- `unit_price` REAL NOT NULL
- `substitute_for` TEXT

### Scoring Dimensions

| Dimension | Weight | State Read | Failure Policy |
|-----------|--------|------------|----------------|
| Grocery order exists for eggs | 0.5 | Query `grocery_order_item` JOIN `grocery_product` WHERE `grocery_product.name LIKE '%egg%'` | 0.0 if no order |
| Order quantity is 1 dozen | 0.3 | Check `grocery_order_item.quantity` for the eggs product order item | Partial credit if wrong quantity |
| Order created after task start | 0.2 | Compare `grocery_order.created_at` with task start time | 0.0 if pre-existing order |

### Precondition Checks

Before scoring, the verifier MUST verify that:
1. The grocery catalog contains an eggs product: `SELECT product_id FROM grocery_product WHERE name LIKE '%egg%'`
2. The fridge inventory contains an eggs item: `SELECT id FROM inventory_item WHERE item_name LIKE '%egg%' AND location = 'fridge'`

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
- **Agent must use browser-based UI interaction only** — direct API calls are NOT permitted

### Mock Integration

- Smart Home Mock uses SQLite with deterministic benchmark clock
- The same mock provides both inventory checking AND grocery ordering APIs
- Inventory snapshot captured at startup for comparison

### Potential Pitfalls

- Agent may check wrong inventory location (pantry vs fridge) — the Inventory page separates items by location
- Agent may order wrong quantity (pieces vs dozen) — product name should clearly indicate "dozen"
- Agent may not find eggs product if catalog search fails — product list is alphabetical
- Agent may attempt to use direct API calls instead of browser UI — this is NOT allowed
- Need to ensure eggs product exists in grocery catalog with clear naming (e.g., "Eggs (1 dozen)")

### Data Synthesis Notes

- Seed eggs quantity to be below threshold (e.g., 6 pieces with `location = 'fridge'`)
- Ensure grocery catalog has eggs with clear naming indicating dozen unit (e.g., "Eggs (1 dozen)")
- Distractor products should not confuse the agent
- **CRITICAL**: `seed.sql` MUST include:
  - An eggs product in `grocery_product` table: `INSERT INTO grocery_product (product_id, name, price, stock_status) VALUES ('eggs-001', 'Eggs (1 dozen)', 4.99, 'in_stock');`
  - An eggs item in `inventory_item` table with `location = 'fridge'` and quantity below threshold: `INSERT INTO inventory_item (item_name, quantity, unit, location) VALUES ('Eggs', 6, 'pieces', 'fridge');`
  - Without these records, the task is unsolvable and the verifier will fail with a precondition error