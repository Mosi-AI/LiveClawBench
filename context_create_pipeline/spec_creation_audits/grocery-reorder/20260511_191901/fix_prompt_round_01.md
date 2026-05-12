You are an isolated spec fixer for LiveClawBench. Your job is to fix the following spec based on the audit findings.

You must preserve correct spec content and all CSV row facts.
You must modify only the spec markdown.
You must address every open finding that can be fixed from available information.
You must not hide unresolved issues; unresolved items must be logged.

You must output exactly this format:

```text
===SPEC_START===
<complete revised spec markdown>
===SPEC_END===

===FIX_LOG_START===
# Fix Log Round <N>: <task_name>

## Fixed Findings

| issue_id | change made | spec sections changed |
|---|---|---|

## Unresolved Findings

| issue_id | reason not fixed | user action needed |
|---|---|---|
===FIX_LOG_END===
```

---

# Current Spec

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

# Audit Report Round 1

STATUS: FAIL

## Summary

规格结构完整，但存在多处问题：指令泄露（包含阈值"less than 1 dozen"）、环境描述中 mock 服务端口与实际 mock snapshot 不匹配、缺少 task-binary-map.json 映射、verifier 设计中状态读取路径不明确。

## Findings

| issue_id | severity | checklist_source | spec_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|
| F1 | high | 2. Task Goal And Instruction Leakage | 3. Agent Instruction Draft | "If we are running out of eggs (less than 1 dozen)" 暴露了精确阈值 12 pieces，这是 verifier 判断条件 | 移除精确阈值，改为自然语言如 "running low on eggs" 或 "need more eggs" | open |
| F2 | medium | 3. Environment And Data Completeness | 4. Environment And Data Setup | Shop Mock 端口声明为 1234，但 mock snapshot 显示 Shop Mock 端口未明确；Smart Home Mock 端口 5004 与 snapshot 一致 | 确认 Shop Mock 端口并统一；或明确说明端口来源 | open |
| F3 | medium | 3. Environment And Data Completeness | 4. Environment And Data Setup | 缺少 `mock-platform/config/task-binary-map.json` 映射声明 | 添加 task-binary-map.json 映射要求，说明该任务需要哪些 mock binaries | open |
| F4 | medium | 3. Environment And Data Completeness | 4. Environment And Data Setup | Dockerfile base 声明 `liveclawbench-grocery-reorder-base:latest`，但未说明这是由 setup.sh step 4 构建 | 明确说明 per-task layer 构建来源，与 CLAUDE.md 架构一致 | open |
| F5 | medium | 4. Verifier Contract | 6. Verifier Design | 状态读取路径不明确："Query `/api/grocery/orders` or read order history" 缺少具体文件路径 | 明确 verifier 读取的具体路径（如 `/var/lib/mock-data/shop/orders.json` 或 API endpoint） | open |
| F6 | medium | 3. Environment And Data Completeness | 4. Environment And Data Setup | Smart Home Mock 的 grocery API 与 Shop Mock 功能重叠，未说明两者关系 | 明确两个 mock 的职责分工：Smart Home grocery API vs Shop Mock grocery API | open |
| F7 | low | 1. Structure And Metadata | 1. Case Metadata | `case_id` 为 "TODO from CSV"，需从 `docs/metadata/cases_registry.csv` 获取 | 从 cases_registry.csv 获取下一个可用 case_id | open |
| F8 | low | 3. Environment And Data Completeness | 7. Required Files | `environment/startup.sh` 列为必需文件，但实际应使用 `/opt/mock/startup.d/grocery-reorder.sh` | 统一 startup 脚本路径命名，与 CLAUDE.md 架构一致 | open |

---

# Additional Context for Fixes

## Mock Snapshot Facts

From `mock-platform/mocks/smarthome/src/index.tsx`:
- Port: 5004
- Smart Home Mock includes BOTH inventory API AND grocery API:
  - `/api/inventory` - for fridge/pantry inventory
  - `/api/grocery/products` - for grocery product catalog
  - `/api/grocery/orders` - for placing grocery orders
- SQLite database at `/var/lib/mock-data/smarthome/smarthome.db`
- Verifier-readable symlink: `/tmp/mosi_smart_home.sqlite`

From `mock-platform/mocks/shop/src/index.tsx`:
- Port: 1234
- Shop Mock is for e-commerce shopping (products, cart, orders)
- NOT the same as grocery ordering in smarthome

## Key Insight for F6

The Smart Home Mock already has grocery ordering built-in. The task should use ONLY the Smart Home Mock (port 5004) for both inventory checking AND grocery ordering. The "shop-web" in `involved mock service` from CSV is misleading - the grocery system is part of the Smart Home Mock.

## task-binary-map.json Format

```json
"grocery-reorder": {
  "binaries": ["smarthome"],
  "assets": [
    { "src": "tasks/grocery-reorder/environment/seed.sql", "dest": "/opt/mock/data/smarthome.sql" }
  ]
}
```

## Next case_id

From `docs/metadata/cases_registry.csv`, the last case_id is 31 (smarthome-test). Next available is 32.

## ability_category

Based on the task nature (conditional check and cross-service action), this fits "proactive decision making" or "cross environment composition". Given A1=1, "cross environment composition" is more appropriate.