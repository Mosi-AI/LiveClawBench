# Spec: grocery-reorder

## 1. Case Metadata

- `task_name`: `grocery-reorder`
- `case_id`: 32
- `ability_category`: cross environment composition
- `source_domain`: E-commerce & Daily Services
- `domains_multi`: E-commerce & Daily Services
- `mock_services`: smarthome, shop
- `difficulty`: medium (cross-service coordination with unit conversion and rounding decision)
- `factors_supported`: A1=1 (Cross-Service Dependency: smart-home inventory → shop ordering); A2=0; B1=0; B2=0
- `factors_extended`: None
- `registry_description`: Check smart fridge inventory for eggs, calculate shortage, add to grocery shopping list, and place order in shop app with proper unit conversion
- `source_files`: tasks/grocery-reorder/
- `allow_internet_rationale`: Required for agent LLM API access during task execution

### Raw Collection Sheet Fields

- `xc`: Health & Wellness
- `提交人`: Gao Ying & Xu Rongjian
- `id`: grocery-reorder
- `task instruction`: I need 4 dozen eggs for next week. Please check the current egg inventory across both the fridge and pantry in the smart-home app, add the missing amount to the Grocery Requirement List, and place an order in the shop app. Let me know if you run into any situations along the way.
- `potential solution path`: Open smart-home-app → navigate to Inventory Fridge tab → find egg entry and read quantity (in pieces) → navigate to Inventory Pantry tab → find egg entry and read quantity (in pieces) → sum both quantities: total = 18 pieces → calculate shortage: 48 − 18 = 30 pieces → navigate to Shopping List → add new item: Product = Eggs, Quantity = 30, Unit = pieces → save → open shop app → search for egg product → discover product is listed as "one dozen of eggs" (whole units only) → recognize that 30 pieces = 2.5 dozen cannot be ordered as-is → round up to 3 dozen (36 pieces) → place order for "one dozen of eggs" with quantity = 3 → confirm order submitted → record generated order_id from order page → return to smart-home-app → Shopping List → edit Eggs entry → update quantity from 30 to 36 pieces → fill in Order Reference field with shop order_id → save → notify user
- `verification method`: 1. grocery_requirements table has entry for eggs with quantity = 36 and unit = 'pieces' (exact) → 0.25 pts. 2. shop orders table has order for "one dozen of eggs" with quantity = 3 and order_id matching format ORD + 6 digits (exact) → 0.25 pts. 3. grocery_requirements entry for eggs has reference field = order_id from shop orders table (exact match) → 0.25 pts. 4. Extract agent final response → keyword match: response must contain explanation of rounding (e.g. keywords: "2.5 dozen" OR "30 pieces" AND "round" OR "whole dozen" AND "36" OR "3 dozen") → 0.15 pts. 5. grocery_requirements existing entries unchanged: Organic Whole Milk quantity and reference = ORD000001, Salted Butter quantity and reference = ORD000002 → 0.10 pts. All five checks required. Total 1.0.
- `data synth req`: smarthome-app: (1) Inventory Fridge tab: eggs = 11 pieces; (2) Inventory Pantry tab: eggs = 7 pieces; (3) Shopping List: Organic Whole Milk / 1 / gallon / ORD000001, Salted Butter / 1 / lb / ORD000002. Initial DB state — shop-app: (1) Products: Organic Whole Milk / 1 gallon, Salted Butter / 1 lb, one dozen of eggs / 1 dozen; (2) Orders: ORD000001 / Organic Whole Milk / 1 gallon, ORD000002 / Salted Butter / 1 lb.
- `involved other task domain`: (empty)
- `involved mock service`: smart-home-app; shop-web
- `complexity factors`: (empty)

> **Note on domain discrepancy**: The `xc` field shows "Health & Wellness" from the original collection sheet, but the task's primary domain is "E-commerce & Daily Services" based on the actual task mechanics (shopping, inventory management, ordering). The `source_domain` reflects the implemented task behavior.

### Suggested task.toml

```toml
version = "1.0"

[metadata]
difficulty = "medium"
category = "open-world"
tags = ["e_commerce", "smart_home", "inventory_management", "cross_service"]
domain = "E-commerce & Daily Svcs"
domains_multi = ["E-commerce & Daily Svcs"]
factor_a1 = 1
factor_a2 = 0
factor_b1 = 0
factor_b2 = 0
case_id = 32

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

The agent must check the egg inventory across both fridge and pantry locations in the smart-home app, calculate the shortage against the target of 4 dozen (48 pieces), add the missing amount to the Grocery Shopping List, place an order in the shop app, and update the Shopping List entry with the shop order reference. The agent must handle the unit mismatch between pieces (inventory) and dozens (shop product) by rounding up appropriately.

## 3. Agent Instruction Draft

I need 4 dozen eggs for next week. Please check the current egg inventory across both the fridge and pantry in the smart-home app (http://localhost:5004/, open it in browser), add the missing amount to the Grocery Shopping List, and place an order in the shop app (http://localhost:1234/, open it in browser). Let me know if you run into any situations along the way.

## 4. Environment And Data Setup

### Mock Services

1. **Smart Home Mock** (port 5004)
   - Inventory page with Fridge and Pantry tabs showing item quantities
   - Shopping List page supporting add/edit/delete items with Order Reference field
   - SQLite database at `/var/lib/mock-data/smarthome/smarthome.db`
   - Verifier-readable symlink: `/tmp/mosi_smart_home.sqlite`

2. **Shop Mock** (port 1234)
   - Product catalog with "one dozen of eggs" product
   - Cart and checkout functionality
   - Order history page showing order_id after checkout
   - SQLite database at `/var/lib/mock-data/shop/shop.db`
   - Verifier-readable symlink: `/tmp/mosi_shop.sqlite`

### task-binary-map.json Entry

```json
"grocery-reorder": {
  "binaries": ["smarthome", "shop"],
  "assets": [
    { "src": "tasks/grocery-reorder/environment/smarthome_seed.sql", "dest": "/opt/mock/data/smarthome.sql" },
    { "src": "tasks/grocery-reorder/environment/shop_seed.sql", "dest": "/opt/mock/data/shop.sql" }
  ]
}
```

### Data Requirements

**Smart Home - Inventory:**
- Fridge: eggs = 11 pieces
- Pantry: eggs = 7 pieces
- Total eggs = 18 pieces

**Smart Home - Shopping List (initial):**
- Organic Whole Milk: quantity=1, unit=gallon, reference=ORD000001
- Salted Butter: quantity=1, unit=lb, reference=ORD000002

**Shop - Products:**
- Organic Whole Milk: 1 gallon
- Salted Butter: 1 lb
- One Dozen of Eggs: 1 dozen (unit is dozen, quantity must be integer)

**Shop - Orders (initial):**
- ORD000001: Organic Whole Milk, 1 gallon
- ORD000002: Salted Butter, 1 lb

**Shop - Orders.items JSON Structure:**
```json
[
  {"product_id": 1, "name": "Organic Whole Milk", "quantity": 1, "price": 4.99},
  {"product_id": 2, "name": "Salted Butter", "quantity": 1, "price": 3.49}
]
```

### State Persistence

- Smart home state: `/var/lib/mock-data/smarthome/smarthome.db`
- Shop state: `/var/lib/mock-data/shop/shop.db`
- Verifier reads from both databases via symlinks:
  - `/tmp/mosi_smart_home.sqlite` → `/var/lib/mock-data/smarthome/smarthome.db`
  - `/tmp/mosi_shop.sqlite` → `/var/lib/mock-data/shop/shop.db`

### Startup

- Smart Home Mock starts via `/opt/mock/startup.d/grocery-reorder.sh`
- Shop Mock starts via same startup script
- Entrypoint script ends with `exec "$@"`

The startup script loads SQL seed files into databases:
1. Creates SQLite databases at `/var/lib/mock-data/smarthome/smarthome.db` and `/var/lib/mock-data/shop/shop.db`
2. Executes `smarthome.sql` and `shop.sql` from `/opt/mock/data/` to seed initial data
3. Creates verifier-readable symlinks at `/tmp/mosi_smart_home.sqlite` and `/tmp/mosi_shop.sqlite`
4. Starts both mock services on ports 5004 and 1234

### Docker Image Architecture

- Base layer: `liveclawbench-base:latest`
- Per-task layer: `liveclawbench-grocery-reorder-base:latest`
- Task layer: `FROM liveclawbench-grocery-reorder-base:latest`

## 5. Expected Behavior / Reference Path

1. Agent opens smart-home app at http://localhost:5004/ in browser
2. Agent navigates to Inventory page and checks Fridge tab for eggs (11 pieces)
3. Agent navigates to Pantry tab for eggs (7 pieces)
4. Agent calculates total eggs = 18 pieces, shortage = 48 - 18 = 30 pieces
5. Agent navigates to Shopping List page
6. Agent clicks "Add Item" and adds: Name=Eggs, Quantity=30, Unit=pieces
7. Agent opens shop app at http://localhost:1234/ in browser
8. Agent searches for "eggs" and finds "one dozen of eggs" product
9. Agent recognizes unit mismatch: need 30 pieces = 2.5 dozen, but shop sells whole dozens only
10. Agent rounds up to 3 dozen (36 pieces) and adds 3 units to cart
11. Agent completes checkout
12. Agent navigates to Orders page to get the generated order_id
13. Agent returns to smart-home app Shopping List
14. Agent edits the Eggs entry: updates quantity to 36 pieces, fills Order Reference with the order_id
15. Agent saves and notifies user of the rounding decision

**IMPORTANT**: Agent must interact with web UI through browser automation (clicking, typing, form submission). Direct API calls are NOT allowed for this task.

### Web UI Navigation Structure

**Smart Home App (port 5004):**
- Navigation: Dashboard, Thermostat, Coffee, Inventory, Shopping List, Wearable, Calendar, Meal Plan
- Inventory page: Fridge tab and Pantry tab, each showing items with Quantity and Unit columns
- Shopping List page: Add Item button, table with Product/Quantity/Unit/Stock/Order Reference/Actions columns

**Shop App (port 1234):**
- Home page with search bar
- Search results page
- Product detail with "Add to Cart" button
- Cart page with checkout button
- Orders page showing order history with order_id

## 6. Verifier Design

### Verifier Type

`verify.py`

### Database Schema Reference

**Smart Home - grocery_product table:**
```sql
CREATE TABLE grocery_product (
    product_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    stock_status TEXT NOT NULL,
    substitute_for TEXT,
    reference TEXT
);
```

**Shop - orders table:**
```sql
CREATE TABLE orders (
    order_id TEXT PRIMARY KEY,
    user_id TEXT,
    items JSON,
    total_amount REAL,
    status TEXT,
    create_time TEXT,
    shipping_address TEXT
);
```

**Shop - products table:**
```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    description TEXT,
    category TEXT,
    rating REAL,
    image_url TEXT
);
```

### Verifier State Paths

| Database | Primary Path | Verifier Symlink |
|----------|--------------|------------------|
| Smart Home | `/var/lib/mock-data/smarthome/smarthome.db` | `/tmp/mosi_smart_home.sqlite` |
| Shop | `/var/lib/mock-data/shop/shop.db` | `/tmp/mosi_shop.sqlite` |

### Agent Output Access

For Dimension 4 (agent response keyword matching), the verifier reads the agent's final response from:
- Path: `/logs/agent/final_response.txt`
- This file is populated by harbor's agent output capture mechanism after the agent completes its task
- The verifier performs keyword matching on the content of this file

### Scoring Dimensions

| Dimension | Weight | State Read | Failure Policy |
|-----------|--------|------------|----------------|
| Shopping List has eggs entry with quantity=36, unit=pieces | 0.25 | Query `grocery_product` WHERE `name LIKE '%egg%'` | 0.0 if no matching entry |
| Shop has order for "one dozen of eggs" with quantity=3 | 0.25 | Query shop orders for egg product | 0.0 if no order |
| Shopping List eggs entry has reference = shop order_id | 0.25 | Check `grocery_product.reference` matches shop `order_id` | 0.0 if no match |
| Agent response explains rounding decision | 0.15 | Keyword match in `/logs/agent/final_response.txt` | Partial credit: 0.05 for mentioning "2.5 dozen" or "30 pieces"; 0.10 for explaining rounding with keywords "round", "whole dozen", or "3 dozen"; full 0.15 for complete explanation |
| Existing entries unchanged (Milk/Butter) | 0.10 | Verify existing entries preserved | 0.0 if modified |

### Precondition Checks

Before scoring, verify:
1. Smart home inventory has eggs in fridge and pantry
2. Shop product catalog has "one dozen of eggs"
3. Initial Shopping List has Milk and Butter entries

### Reward Output

- Write to `/logs/verifier/reward.txt`
- Print `Score: X.X/1.0`
- Exit non-zero if score < 0.5

### Zero-Work Baseline

If agent does nothing, no eggs entry in Shopping List, no shop order → score 0.0

## 7. Required Files

- `task.toml`
- `instruction.md`
- `environment/Dockerfile`
- `environment/smarthome_seed.sql`
- `environment/shop_seed.sql`
- `solution/solve.sh`
- `tests/test.sh`
- `tests/verify.py`

### SQL Seed File Content

**smarthome_seed.sql:**
```sql
-- Smart Home Database Seed for grocery-reorder task

-- Inventory tables
CREATE TABLE IF NOT EXISTS inventory_fridge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    category TEXT,
    expiry_date TEXT
);

CREATE TABLE IF NOT EXISTS inventory_pantry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    category TEXT
);

-- Shopping List / Grocery Requirements table
CREATE TABLE IF NOT EXISTS grocery_product (
    product_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    stock_status TEXT NOT NULL DEFAULT 'pending',
    substitute_for TEXT,
    reference TEXT
);

-- Seed inventory_fridge
INSERT INTO inventory_fridge (name, quantity, unit, category, expiry_date) VALUES
('Eggs', 11, 'pieces', 'Dairy', '2026-05-20'),
('Milk', 1, 'gallon', 'Dairy', '2026-05-15'),
('Butter', 0.5, 'lb', 'Dairy', '2026-06-01');

-- Seed inventory_pantry
INSERT INTO inventory_pantry (name, quantity, unit, category) VALUES
('Eggs', 7, 'pieces', 'Dairy'),
('Flour', 2, 'kg', 'Baking'),
('Sugar', 1, 'kg', 'Baking');

-- Seed grocery_product (Shopping List with existing entries)
INSERT INTO grocery_product (product_id, name, quantity, unit, stock_status, reference) VALUES
('GP001', 'Organic Whole Milk', 1, 'gallon', 'ordered', 'ORD000001'),
('GP002', 'Salted Butter', 1, 'lb', 'ordered', 'ORD000002');
```

**shop_seed.sql:**
```sql
-- Shop Database Seed for grocery-reorder task

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    description TEXT,
    category TEXT,
    rating REAL,
    image_url TEXT
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    order_id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'user001',
    items JSON,
    total_amount REAL,
    status TEXT DEFAULT 'completed',
    create_time TEXT,
    shipping_address TEXT
);

-- Cart table (for agent interaction)
CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Seed products
INSERT INTO products (name, price, description, category, rating) VALUES
('Organic Whole Milk', 4.99, 'Fresh organic whole milk, 1 gallon', 'Dairy', 4.5),
('Salted Butter', 3.49, 'Premium salted butter, 1 lb', 'Dairy', 4.7),
('One Dozen of Eggs', 5.99, 'Farm fresh eggs, one dozen (12 pieces)', 'Dairy', 4.6);

-- Seed orders (existing orders matching Shopping List references)
INSERT INTO orders (order_id, user_id, items, total_amount, status, create_time, shipping_address) VALUES
('ORD000001', 'user001', '[{"product_id": 1, "name": "Organic Whole Milk", "quantity": 1, "price": 4.99}]', 4.99, 'completed', '2026-05-10 10:30:00', '123 Main St'),
('ORD000002', 'user001', '[{"product_id": 2, "name": "Salted Butter", "quantity": 1, "price": 3.49}]', 3.49, 'completed', '2026-05-10 11:00:00', '123 Main St');
```

## 8. Implementation Notes And Pitfalls

### Critical Requirements

- `[environment].allow_internet = true` required for agent LLM API access
- Dockerfile inherits `liveclawbench-grocery-reorder-base:latest`
- Both mocks must be running before agent starts
- **Agent must use browser-based UI interaction only** — direct API calls are NOT permitted

### Mock Integration

- Smart Home Mock uses SQLite with deterministic benchmark clock
- Shop Mock uses SQLite with order_id generation
- Both mocks share the same container but run on different ports

### Potential Pitfalls

- Agent may check only one inventory location (fridge OR pantry) — must check both
- Agent may not handle unit conversion (pieces vs dozen) correctly
- Agent may forget to update Shopping List with order reference after placing order
- Agent may try to order 2.5 dozen instead of rounding up to 3
- Agent may accidentally modify existing Shopping List entries (Milk, Butter)

### Data Synthesis Notes

- Seed eggs in both fridge (11 pieces) and pantry (7 pieces) locations
- Ensure shop has "one dozen of eggs" product with clear naming
- Pre-populate Shopping List with Milk and Butter entries with existing order references
- Pre-populate shop with ORD000001 and ORD000002 orders matching those references
