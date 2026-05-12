# Plan: grocery-reorder

## 1. Plan Metadata

- `task_name`: `grocery-reorder`
- `source_spec`: `context_create_pipeline/spec_creation_audits/grocery-reorder.md`
- `target_task_dir`: `tasks/grocery-reorder/`
- `case_id`: 32
- `difficulty`: medium
- `domain`: E-commerce & Daily Services
- `domains_multi`: E-commerce & Daily Services
- `factors_supported`: A1=1 (Cross-Service Dependency); A2=0; B1=0; B2=0
- `mock_app_sources`: smarthome (port 5004), shop (port 1234)
- `expected_outputs`: Shopping List entry for eggs with quantity=36, shop order for 3 dozen eggs, order reference linked
- `spec_snapshot_status`: complete

## 2. Context Creation Goal

Create a self-contained benchmark task where an agent must coordinate across two mock services (smart-home inventory and shop) to check egg inventory, calculate shortage, add to Shopping List, place an order with unit conversion, and link the order reference back.

### Spec Preservation Snapshot

**Task Goal (preserved):**
The agent must check the egg inventory across both fridge and pantry locations in the smart-home app, calculate the shortage against the target of 4 dozen (48 pieces), add the missing amount to the Grocery Shopping List, place an order in the shop app, and update the Shopping List entry with the shop order reference. The agent must handle the unit mismatch between pieces (inventory) and dozens (shop product) by rounding up appropriately.

**Agent Instruction Draft (preserved):**
```
I need 4 dozen eggs for next week. Please check the current egg inventory across both the fridge and pantry in the smart-home app (http://localhost:5004/, open it in browser), add the missing amount to the Grocery Shopping List, and place an order in the shop app (http://localhost:1234/, open it in browser). Let me know if you run into any situations along the way.
```

Hidden information (excluded from instruction.md):
- Expected shortage calculation: 48 - 18 = 30 pieces
- Expected rounding: 2.5 dozen → 3 dozen (36 pieces)
- Expected order_id format: ORD + 6 digits
- Scoring dimensions and weights

**Mock Services (preserved):**
- Smart Home Mock (port 5004): Inventory (Fridge/Pantry tabs), Shopping List with add/edit/delete and Order Reference field
- Shop Mock (port 1234): Product catalog, cart, checkout, order history with order_id

**Environment/Data Setup (preserved):**
- Smart Home Inventory: Fridge eggs=11 pieces, Pantry eggs=7 pieces, total=18 pieces
- Shopping List initial: Organic Whole Milk (1 gallon, ORD000001), Salted Butter (1 lb, ORD000002)
- Shop Products: Organic Whole Milk, Salted Butter, One Dozen of Eggs
- Shop Orders initial: ORD000001, ORD000002

**Expected Behavior/Reference Path (preserved):**
1. Open smart-home app → check Fridge (11 pieces) → check Pantry (7 pieces)
2. Calculate: 48 - 18 = 30 pieces shortage
3. Add to Shopping List: Eggs, 30 pieces
4. Open shop app → search eggs → find "one dozen of eggs"
5. Recognize unit mismatch → round up to 3 dozen (36 pieces)
6. Place order → get order_id from Orders page
7. Return to Shopping List → update Eggs entry: quantity=36, reference=order_id
8. Notify user of rounding decision

**Verifier Design (preserved):**
- Type: verify.py
- 5 scoring dimensions: Shopping List eggs entry (0.25), shop order (0.25), reference match (0.25), agent response rounding explanation (0.15), existing entries unchanged (0.10)
- Zero-work baseline: 0.0

**Required Files (preserved):**
- task.toml, instruction.md, environment/Dockerfile, environment/smarthome_seed.sql, environment/shop_seed.sql, solution/solve.sh, tests/test.sh, tests/verify.py

**Implementation Pitfalls (preserved):**
- Agent may check only one inventory location
- Agent may not handle unit conversion correctly
- Agent may forget to update Shopping List with order reference
- Agent may try to order 2.5 dozen instead of rounding up
- Agent may accidentally modify existing entries

## 3. Source Assets And Reuse Map

| Source | Target | Action | Notes |
|---|---|---|---|
| mock-platform/mocks/smarthome/ | environment/ | Reuse existing binary | smarthome mock binary from liveclawbench-grocery-reorder-base image |
| mock-platform/mocks/shop/ | environment/ | Reuse existing binary | shop mock binary from liveclawbench-grocery-reorder-base image |
| (new) | environment/smarthome_seed.sql | Create | Task-specific seed for smarthome database |
| (new) | environment/shop_seed.sql | Create | Task-specific seed for shop database |
| (new) | environment/Dockerfile | Create | FROM liveclawbench-grocery-reorder-base:latest |
| (new) | task.toml | Create | Per spec suggested task.toml |
| (new) | instruction.md | Create | From Agent Instruction Draft |
| (new) | solution/solve.sh | Create | Reference solution following reference path |
| (new) | tests/test.sh | Create | Invokes verify.py |
| (new) | tests/verify.py | Create | 5-dimension scoring verifier |

## 4. Step-By-Step Build Plan

### Step 1: Create task skeleton

- Purpose: Create the basic task directory structure
- Files: `tasks/grocery-reorder/`, `tasks/grocery-reorder/environment/`, `tasks/grocery-reorder/solution/`, `tasks/grocery-reorder/tests/`
- Actions:
  - Create directory `tasks/grocery-reorder/`
  - Create subdirectories: `environment/`, `solution/`, `tests/`
- Acceptance check: `ls -d tasks/grocery-reorder/environment tasks/grocery-reorder/solution tasks/grocery-reorder/tests`
- Depends on: none

### Step 2: Write task.toml

- Purpose: Define task metadata, timeouts, and complexity factors
- Files: `tasks/grocery-reorder/task.toml`
- Actions:
  - Copy from spec suggested task.toml
  - Ensure `[environment].allow_internet = true`
  - Set `case_id = 32`
  - Set `factor_a1 = 1`, `factor_a2 = 0`, `factor_b1 = 0`, `factor_b2 = 0`
- Acceptance check: `cat tasks/grocery-reorder/task.toml | grep -E "case_id|factor_a1|allow_internet"`
- Depends on: Step 1

### Step 3: Write instruction.md

- Purpose: Provide agent-facing task prompt
- Files: `tasks/grocery-reorder/instruction.md`
- Actions:
  - Copy Agent Instruction Draft from spec
  - Ensure URLs include `http://localhost:5004/` and `http://localhost:1234/`
  - Ensure no hidden scoring information leaked
- Acceptance check: `cat tasks/grocery-reorder/instruction.md | grep -E "localhost:5004|localhost:1234"`
- Depends on: Step 1

### Step 4: Write SQL seed files

- Purpose: Initialize smarthome and shop databases with correct target and distractor data
- Files: `tasks/grocery-reorder/environment/smarthome_seed.sql`, `tasks/grocery-reorder/environment/shop_seed.sql`
- Actions:
  - Copy smarthome_seed.sql from spec Section 7
  - Copy shop_seed.sql from spec Section 7
  - Verify correct target data: eggs in fridge (11 pieces) and pantry (7 pieces)
  - Verify distractor data: Milk, Butter in Shopping List; Flour, Sugar in pantry
  - Verify initial orders: ORD000001, ORD000002 in shop
- Acceptance check:
  - `grep -c "INSERT INTO inventory_fridge" tasks/grocery-reorder/environment/smarthome_seed.sql`
  - `grep -c "INSERT INTO grocery_product" tasks/grocery-reorder/environment/smarthome_seed.sql`
  - `grep -c "INSERT INTO products" tasks/grocery-reorder/environment/shop_seed.sql`
- Depends on: Step 1

### Step 5: Write Dockerfile

- Purpose: Define container image with mock services
- Files: `tasks/grocery-reorder/environment/Dockerfile`
- Actions:
  - `FROM liveclawbench-grocery-reorder-base:latest`
  - COPY smarthome_seed.sql to `/opt/mock/data/smarthome.sql`
  - COPY shop_seed.sql to `/opt/mock/data/shop.sql`
  - No additional RUN commands needed (base image has mocks)
- Acceptance check: `cat tasks/grocery-reorder/environment/Dockerfile | grep -E "FROM|COPY"`
- Depends on: Step 4

### Step 6: Write test.sh

- Purpose: Invoke verifier and handle reward output
- Files: `tasks/grocery-reorder/tests/test.sh`
- Actions:
  - Create `/logs/verifier/` directory
  - Invoke `python3 /tests/verify.py`
  - Preserve exit status
  - Ensure shebang `#!/bin/bash` and executable bit
- Acceptance check: `head -1 tasks/grocery-reorder/tests/test.sh | grep bash`
- Depends on: Step 1

### Step 7: Write verify.py

- Purpose: Implement 5-dimension scoring verifier
- Files: `tasks/grocery-reorder/tests/verify.py`
- Actions:
  - Connect to `/tmp/mosi_smart_home.sqlite` and `/tmp/mosi_shop.sqlite`
  - Implement Dimension 1: Check grocery_product for eggs entry with quantity=36, unit=pieces (0.25 pts)
  - Implement Dimension 2: Check shop orders for "one dozen of eggs" with quantity=3 (0.25 pts)
  - Implement Dimension 3: Check grocery_product.reference matches shop order_id (0.25 pts)
  - Implement Dimension 4: Keyword match in `/logs/agent/final_response.txt` for rounding explanation (0.15 pts, partial credit)
  - Implement Dimension 5: Verify existing entries (Milk, Butter) unchanged (0.10 pts) — **GATED: only awarded if Dimensions 1-3 all pass**
  - Print `Score: X.X/1.0`
  - Write to `/logs/verifier/reward.txt`
  - Exit non-zero if score < 0.5
- Acceptance check: `grep -c "def " tasks/grocery-reorder/tests/verify.py`
- Depends on: Step 6

### Step 8: Write solve.sh reference solution

- Purpose: Provide oracle path to full reward
- Files: `tasks/grocery-reorder/solution/solve.sh`
- Actions:
  - Script that uses browser automation (or direct DB manipulation for oracle) to:
    1. Check smarthome inventory: fridge eggs=11, pantry eggs=7
    2. Calculate shortage: 48-18=30 pieces
    3. Add to Shopping List: Eggs, 30 pieces
    4. Place shop order: 3 dozen eggs
    5. Get order_id from shop
    6. Update Shopping List: quantity=36, reference=order_id
  - Mark hidden values as forbidden from instruction.md
- Acceptance check: `cat tasks/grocery-reorder/solution/solve.sh | grep -E "eggs|order"`
- Depends on: Step 1

### Step 9: Update task-binary-map.json

- Purpose: Register task with required mock binaries
- Files: `mock-platform/config/task-binary-map.json`
- Actions:
  - Add entry for "grocery-reorder" with binaries: ["smarthome", "shop"]
  - Add assets for smarthome_seed.sql and shop_seed.sql
- Acceptance check: `grep -A5 "grocery-reorder" mock-platform/config/task-binary-map.json`
- Depends on: Step 4

### Step 10: Run validation

- Purpose: Verify task passes all validation checks
- Files: None (validation scripts)
- Actions:
  - Run `python scripts/validate_tasks.py`
  - Run `python scripts/validate_annotations.py`
  - Verify case_id=32 is unique
  - Verify factor annotations match task.toml
- Acceptance check: `python scripts/validate_tasks.py 2>&1 | grep -E "grocery-reorder|PASS|FAIL"`
- Depends on: Steps 2-9

## 5. Environment And Service Plan

### Base Image

- Base: `liveclawbench-base:latest`
- Per-task layer: `liveclawbench-grocery-reorder-base:latest` (built by `mock-platform/scripts/build-task-images.ts`)
- Task layer: `FROM liveclawbench-grocery-reorder-base:latest`

### Dockerfile

```dockerfile
FROM liveclawbench-grocery-reorder-base:latest

COPY smarthome_seed.sql /opt/mock/data/smarthome.sql
COPY shop_seed.sql /opt/mock/data/shop.sql
```

### Startup Script

- Path: `/opt/mock/startup.d/grocery-reorder.sh` (provided by per-task layer)
- Actions:
  1. Create SQLite databases at `/var/lib/mock-data/smarthome/smarthome.db` and `/var/lib/mock-data/shop/shop.db`
  2. Execute `/opt/mock/data/smarthome.sql` and `/opt/mock/data/shop.sql`
  3. Create symlinks: `/tmp/mosi_smart_home.sqlite` → smarthome.db, `/tmp/mosi_shop.sqlite` → shop.db
  4. Start smarthome mock on port 5004
  5. Start shop mock on port 1234

### Entrypoint

- Path: `/opt/mock/entrypoint.sh` (provided by base image)
- Must end with `exec "$@"`

### Ports

- Smart Home Mock: 5004
- Shop Mock: 1234

### Readiness Check

- After startup, both `http://localhost:5004/` and `http://localhost:1234/` should be accessible

## 6. Data And State Plan

### Correct Target Data

**Smart Home - Inventory:**
- Fridge: Eggs (11 pieces, Dairy, expiry 2026-05-20)
- Pantry: Eggs (7 pieces, Dairy)
- Total eggs: 18 pieces

**Smart Home - Shopping List (initial):**
- GP001: Organic Whole Milk, 1 gallon, ordered, ORD000001
- GP002: Salted Butter, 1 lb, ordered, ORD000002

**Shop - Products:**
- id=1: Organic Whole Milk, $4.99, Dairy
- id=2: Salted Butter, $3.49, Dairy
- id=3: One Dozen of Eggs, $5.99, Dairy

**Shop - Orders (initial):**
- ORD000001: Organic Whole Milk, 1 gallon, $4.99, completed
- ORD000002: Salted Butter, 1 lb, $3.49, completed

### Distractor/Noise Data

**Smart Home - Inventory (non-target items):**
- Fridge: Milk (1 gallon), Butter (0.5 lb)
- Pantry: Flour (2 kg), Sugar (1 kg)

**Purpose:**
- Milk and Butter in fridge match Shopping List entries (cross-reference realism)
- Flour and Sugar are unrelated items (noise)
- Multiple egg locations require agent to check both (A1 complexity)

### Initial State

- Smart Home DB: inventory_fridge (3 rows), inventory_pantry (3 rows), grocery_product (2 rows)
- Shop DB: products (3 rows), orders (2 rows), cart (empty)

### Expected Final State

- Smart Home DB: grocery_product has new row for Eggs with quantity=36, unit=pieces, reference matching new order_id
- Shop DB: orders has new row for 3 dozen eggs with generated order_id
- Existing entries unchanged: GP001, GP002, ORD000001, ORD000002

### Verifier-Readable State

- `/tmp/mosi_smart_home.sqlite` → Smart Home DB
- `/tmp/mosi_shop.sqlite` → Shop DB
- `/logs/agent/final_response.txt` → Agent response for keyword matching

### Cross-Service Information Flow

1. Agent reads inventory from smarthome (fridge + pantry)
2. Agent writes to smarthome Shopping List
3. Agent reads products from shop
4. Agent writes order to shop
5. Agent reads order_id from shop
6. Agent updates smarthome Shopping List with shop order_id

### Hidden Values (allowed in plan/solution/verifier, forbidden in instruction.md)

- Expected shortage: 30 pieces
- Expected rounding: 3 dozen (36 pieces)
- Expected order_id format: ORD + 6 digits
- Scoring weights: 0.25, 0.25, 0.25, 0.15, 0.10

## 7. Instruction Plan

### instruction.md Content

```
I need 4 dozen eggs for next week. Please check the current egg inventory across both the fridge and pantry in the smart-home app (http://localhost:5004/, open it in browser), add the missing amount to the Grocery Shopping List, and place an order in the shop app (http://localhost:1234/, open it in browser). Let me know if you run into any situations along the way.
```

### Leakage Check

- No scoring rules or weights mentioned
- No expected order_id values
- No database field names
- No verifier internals
- URLs with ports are REQUIRED for browser-only interaction (per spec constraint)

## 8. Verifier And Reward Plan

### Verifier Type

`verify.py`

### Verifier Integrity Trace

| Spec scoring dimension | Weight | Verifier file/function | State read | Failure/partial policy | Zero-work baseline result | Domain-specific assertion |
|---|---:|---|---|---|---|---|
| Shopping List has eggs entry with quantity=36, unit=pieces | 0.25 | verify.py:check_shopping_list_eggs() | Query `/tmp/mosi_smart_home.sqlite` grocery_product WHERE name LIKE '%egg%' | 0.0 if no entry; check quantity=36 AND unit='pieces' | 0.0 | E-commerce: grocery item with correct quantity and unit |
| Shop has order for "one dozen of eggs" with quantity=3 | 0.25 | verify.py:check_shop_order() | Query `/tmp/mosi_shop.sqlite` orders for items containing "egg" or "dozen" | 0.0 if no order; check quantity=3 in items JSON | 0.0 | E-commerce: order with correct product and quantity |
| Shopping List eggs entry has reference = shop order_id | 0.25 | verify.py:check_reference_match() | Read grocery_product.reference and match against shop orders.order_id | 0.0 if no match; exact string match required | 0.0 | Cross-service: order reference linked correctly |
| Agent response explains rounding decision | 0.15 | verify.py:check_rounding_explanation() | Read `/logs/agent/final_response.txt` | Partial: 0.05 for "2.5 dozen" or "30 pieces"; 0.10 for "round"/"whole dozen"/"3 dozen"; 0.15 for complete | 0.0 | Agent reasoning: unit conversion and rounding explained |
| Existing entries unchanged (Milk/Butter) | 0.10 | verify.py:check_existing_entries() | Query grocery_product for GP001, GP002 | 0.0 if modified; check quantity, unit, reference unchanged | **0.0 (gated: only awarded if Dimensions 1-3 all pass)** | Data integrity: no unintended modifications |

### test.sh Contract

```bash
#!/bin/bash
set -e

mkdir -p /logs/verifier

python3 /tests/verify.py
exit_code=$?

exit $exit_code
```

### Precondition Checks

Before scoring, verify.py should check:
1. `/tmp/mosi_smart_home.sqlite` exists and is readable
2. `/tmp/mosi_shop.sqlite` exists and is readable
3. grocery_product table has rows for GP001 and GP002
4. products table has row for "One Dozen of Eggs"

### Weight Consistency

- Sum: 0.25 + 0.25 + 0.25 + 0.15 + 0.10 = 1.0 ✓
- No single dimension >= 0.5 ✓
- All dimensions have concrete state reads ✓

### Zero-Work Baseline

- Agent does nothing → no eggs entry in Shopping List → Dimension 1 = 0.0
- No shop order → Dimension 2 = 0.0
- No reference match → Dimension 3 = 0.0
- No agent response → Dimension 4 = 0.0
- Existing entries unchanged → Dimension 5 = 0.0 (gated by Dimensions 1-3 failure)

**Resolution (IMPLEMENTED):** The zero-work baseline is 0.0 as specified. The verifier implements a gate condition: Dimension 5 is only awarded if Dimensions 1-3 all pass. This ensures that if the agent does nothing (Dimensions 1-3 all fail), Dimension 5 also yields 0.0, resulting in a total score of 0.0 for zero-work. The Verifier Integrity Trace table above reflects this gate condition in the "Zero-work baseline result" column.

### Boundary Handling

- File existence: Check `/tmp/mosi_smart_home.sqlite` and `/tmp/mosi_shop.sqlite` exist
- Empty file: Check databases have expected tables
- JSON parse: Handle orders.items JSON parsing with try/except
- No fragile inline Python: All logic in verify.py, not in test.sh

## 9. Reference Solution Plan

### solve.sh Overview

The reference solution follows the reference path exactly:

1. Open smarthome app at http://localhost:5004/
2. Navigate to Inventory → Fridge tab → read eggs quantity (11 pieces)
3. Navigate to Inventory → Pantry tab → read eggs quantity (7 pieces)
4. Calculate: total = 18, shortage = 48 - 18 = 30 pieces
5. Navigate to Shopping List → Add Item → enter: Eggs, 30, pieces → Save
6. Open shop app at http://localhost:1234/
7. Search for "eggs" → find "One Dozen of Eggs"
8. Recognize: 30 pieces = 2.5 dozen → round up to 3 dozen (36 pieces)
9. Add 3 units to cart → Checkout
10. Navigate to Orders page → read generated order_id
11. Return to smarthome → Shopping List → Edit Eggs entry
12. Update: quantity = 36, Order Reference = order_id → Save
13. Output message explaining rounding decision

### Hidden Values Used (forbidden from instruction.md)

- Expected fridge eggs: 11 pieces
- Expected pantry eggs: 7 pieces
- Expected shortage: 30 pieces
- Expected rounding: 3 dozen
- Expected order_id format: ORD + 6 digits

### Implementation Notes

- For oracle solution, can use direct DB manipulation instead of browser automation
- Browser automation solution would use Playwright or similar
- Solution should be deterministic and achieve score 1.0

## 10. Validation And Audit Plan

### Static Validation

```bash
python scripts/validate_tasks.py
python scripts/validate_annotations.py
```

### Syntax Checks

- Python: `python3 -m py_compile tasks/grocery-reorder/tests/verify.py`
- TOML: `python3 -c "import tomllib; tomllib.load(open('tasks/grocery-reorder/task.toml', 'rb'))"`
- Shell: `bash -n tasks/grocery-reorder/tests/test.sh && bash -n tasks/grocery-reorder/solution/solve.sh`
- Dockerfile: `docker build --check tasks/grocery-reorder/environment/` (if supported)

### Docker Build Check

```bash
docker build -t liveclawbench-grocery-reorder-test tasks/grocery-reorder/environment/
```

### Service Readiness Check

```bash
docker run --rm liveclawbench-grocery-reorder-test curl -s http://localhost:5004/ && curl -s http://localhost:1234/
```

### Oracle-Run Reward Check

```bash
# Run task with oracle solution, expect score 1.0
harbor run -p tasks/grocery-reorder -a openclaw ... --oracle
```

### Zero-Work Reward Check

```bash
# Run task with no agent action, expect score 0.0
# (manual verification that verifier correctly scores zero-work)
```

### Downstream Construction Gate

Proceed to task construction only when plan audit summary has terminal state `PASS`.

## 11. Risks And Open Questions

### Risk 1: Zero-Work Baseline Discrepancy — **RESOLVED**

- **What was unknown**: Spec says zero-work baseline is 0.0, but Dimension 5 (existing entries unchanged) would give 0.10 if agent does nothing.
- **Resolution implemented**: Added gate in verify.py: Dimension 5 only awarded if Dimensions 1-3 all pass. This ensures zero-work gives 0.0. The Verifier Integrity Trace table in Section 8 reflects this gate condition.
- **Status**: RESOLVED

### Risk 2: Order ID Format

- **What is unknown**: Shop mock generates order_id dynamically. Need to verify format matches expected "ORD + 6 digits".
- **Blocking impact**: Verifier may fail to match reference if format differs.
- **Suggested resolution**: Check shop mock order_id generation logic; ensure it uses format "ORD" + 6-digit zero-padded counter.

### Risk 3: Agent Response Capture

- **What is unknown**: Harbor's agent output capture mechanism must populate `/logs/agent/final_response.txt`.
- **Blocking impact**: Dimension 4 scoring may fail if file is missing or empty.
- **Suggested resolution**: Verify harbor configuration includes agent output capture; add fallback in verify.py to handle missing file (award 0.0 for Dimension 4).

### Open Questions

None beyond the risks above.

---

## Domain-Specific Data Trace

**Main Domain:** E-commerce & Daily Services

| Domain checklist item | Spec fact preserved | Plan-added concrete detail | Seed/fixture action | Verifier assertion |
|---|---|---|---|---|
| E-commerce: product inventory | Inventory has eggs in fridge (11) and pantry (7) | inventory_fridge and inventory_pantry tables with Eggs rows | smarthome_seed.sql INSERT statements | verify.py reads inventory to confirm initial state (precondition) |
| E-commerce: shopping list/cart | Shopping List has Milk and Butter entries | grocery_product table with GP001, GP002 rows | smarthome_seed.sql INSERT for grocery_product | verify.py checks existing entries unchanged (Dimension 5) |
| E-commerce: product catalog | Shop has "One Dozen of Eggs" product | products table with id=3, name="One Dozen of Eggs", price=5.99 | shop_seed.sql INSERT for products | verify.py queries products for egg product (Dimension 2) |
| E-commerce: order creation | Shop generates order_id after checkout | orders table with new row after agent action | Agent action creates order; shop mock generates order_id | verify.py reads orders for egg order (Dimension 2) |
| Task characteristic: Cross-service coordination | Shopping List entry links to shop order_id | grocery_product.reference field matches orders.order_id | Agent updates reference field | verify.py checks reference match (Dimension 3) |
| Task characteristic: Unit conversion (pieces vs dozen) | Inventory uses pieces, shop uses dozen | inventory unit='pieces', product description says "one dozen (12 pieces)" | Seed data includes unit fields | verify.py checks quantity=36 pieces in Shopping List (Dimension 1) |
| Agent reasoning: rounding explanation | Agent must explain rounding decision | Keyword match in agent response | N/A (agent output) | verify.py reads /logs/agent/final_response.txt (Dimension 4) |
| Data integrity: existing entries | Milk and Butter entries must remain unchanged | GP001 and GP002 rows with specific values | smarthome_seed.sql INSERT for grocery_product | verify.py checks GP001, GP002 unchanged (Dimension 5) |

> **Note:** "Cross-service coordination" and "Unit conversion" are task characteristics within the main domain (E-commerce & Daily Services), not secondary domains. All 8 trace rows belong to the main domain.

---

## Verifier Integrity Trace

| Spec scoring dimension | Weight | Verifier file/function | State read | Failure/partial policy | Zero-work baseline result | Domain-specific assertion |
|---|---:|---|---|---|---|---|
| Shopping List has eggs entry with quantity=36, unit=pieces | 0.25 | verify.py:check_shopping_list_eggs() | SQLite query on /tmp/mosi_smart_home.sqlite | 0.0 if no entry or wrong values | 0.0 | E-commerce: correct grocery item |
| Shop has order for "one dozen of eggs" with quantity=3 | 0.25 | verify.py:check_shop_order() | SQLite query on /tmp/mosi_shop.sqlite | 0.0 if no order or wrong quantity | 0.0 | E-commerce: correct order |
| Shopping List eggs entry has reference = shop order_id | 0.25 | verify.py:check_reference_match() | SQLite queries on both DBs | 0.0 if no match | 0.0 | Cross-service: reference linked |
| Agent response explains rounding decision | 0.15 | verify.py:check_rounding_explanation() | Read /logs/agent/final_response.txt | Partial: 0.05/0.10/0.15 based on keywords | 0.0 if file missing or no keywords | Agent reasoning: rounding explained |
| Existing entries unchanged (Milk/Butter) | 0.10 | verify.py:check_existing_entries() | SQLite query on /tmp/mosi_smart_home.sqlite | 0.0 if modified | **0.0 (gated by Dimensions 1-3 pass)** | Data integrity: no unintended changes |

> **Gate condition for Dimension 5:** The verifier implements a gate that only awards Dimension 5 points if Dimensions 1, 2, and 3 all pass. This ensures the zero-work baseline is 0.0 as specified, not 0.10.
===PLAN_END===
