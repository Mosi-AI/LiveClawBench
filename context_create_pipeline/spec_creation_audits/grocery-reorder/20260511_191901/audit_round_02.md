现在我已经收集了足够的信息来进行 Round 2 审计。让我验证所有 Round 1 的修复是否有效，并检查是否有新问题。

# Audit Round 2: grocery-reorder

STATUS: FAIL

## Summary
Round 1 的 8 个 findings 中有 7 个已修复，但 F3（task-binary-map.json 映射）仍未添加到实际文件中。此外发现 1 个新问题：verifier 设计中缺少对 eggs 产品是否存在于 grocery catalog 的前提检查说明。

## Findings
| issue_id | severity | checklist_source | spec_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|
| F3 | medium | 3. Environment And Data Completeness | 4. Environment And Data Setup | `mock-platform/config/task-binary-map.json` 中没有 `grocery-reorder` 条目；spec 声明了映射但实际文件未更新 | 将 `grocery-reorder` 条目添加到 `task-binary-map.json` 的 `tasks` 对象中 | open |
| F9 | low | 4. Verifier Contract | 6. Verifier Design | Verifier 假设 eggs 产品存在于 grocery catalog，但未说明如何验证此前提；如果 seed.sql 缺少 eggs 产品，verifier 会误判 | 在 "Data Synthesis Notes" 或 verifier design 中明确说明 seed.sql 必须包含 eggs 产品，且 verifier 应检查产品存在性 | open |

## Previous Round Verification

| issue_id | fix_claimed | actual_status | evidence |
|---|---|---|---|
| F1 | Removed precise threshold | **FIXED** | Spec 第 67 行: "If we are running low on eggs" — 无精确阈值 |
| F2 | Clarified only Smart Home Mock (port 5004) | **FIXED** | Spec 第 75 行: "Smart Home Mock (port 5004) — the only mock service needed" |
| F3 | Added task-binary-map.json entry | **NOT FIXED** | `mock-platform/config/task-binary-map.json` 第 88-93 行只有 `smarthome-test`，没有 `grocery-reorder` |
| F4 | Added Docker Image Architecture section | **FIXED** | Spec 第 110-114 行: 三层架构说明完整 |
| F5 | Specified exact verifier state read path | **FIXED** | Spec 第 137-139 行: `/tmp/mosi_smart_home.sqlite` + 表名明确 |
| F6 | Clarified Smart Home Mock provides both APIs | **FIXED** | Spec 第 76-78 行: `/api/inventory`, `/api/grocery/products`, `/api/grocery/orders` 都在 Smart Home Mock 中 |
| F7 | Set case_id to 32 | **FIXED** | Spec 第 6 行: `case_id`: 32 |
| F8 | Removed startup.sh from required files | **FIXED** | Spec 第 153-159 行: Required Files 列表中无 startup.sh |

## Metadata Check
- `task_name`: `grocery-reorder` ✓ (kebab-case)
- `case_id`: 32 ✓
- `ability_category`: cross environment composition ✓
- `source_domain`: E-commerce & Daily Services ✓
- `domains_multi`: E-commerce & Daily Services ✓ (与 domain 一致)
- `mock_services`: smarthome ✓
- `difficulty`: easy ✓
- `factors_supported`: A1=1 ✓
- `factors_extended`: None ✓
- `registry_description`: ✓
- `source_files`: ✓
- Raw collection sheet fields preserved ✓
- Suggested task.toml 完整 ✓
- Tags 使用 snake_case ✓
- 无 deprecated `capability_dimension` ✓

## Instruction Leakage Check
- Task Goal 描述用户可见目标 ✓
- Agent Instruction Draft 无精确阈值 ✓
- 无 scoring/reward/verifier 语言 ✓
- Instruction 长度 > 100 字符 ✓ (第 67-69 行)
- URL 使用 `http://localhost:5004/` 并说明 "open it in browser" ✓

## Environment And Verifier Check
- Mock 服务端口与实际实现一致 ✓ (smarthome 在 5004)
- API 端点与实际实现一致 ✓ (`/api/inventory`, `/api/grocery/products`, `/api/grocery/orders`)
- 数据库路径正确 ✓ (`/tmp/mosi_smart_home.sqlite` 是实际 symlink 路径)
- 表名正确 ✓ (`grocery_order`, `grocery_order_item` 与实际实现一致)
- Dockerfile base 说明完整 ✓
- Verifier 设计覆盖所有评分点 ✓
- Zero-work baseline 为 0.0 ✓
- **缺失**: task-binary-map.json 中无 grocery-reorder 条目 (F3)
- **缺失**: seed.sql 必须包含 eggs 产品的前提条件未明确 (F9)

## Unresolved Issue Summary
1. **F3**: `mock-platform/config/task-binary-map.json` 缺少 `grocery-reorder` 条目。Spec 声明了映射但实际配置文件未更新。
2. **F9**: Verifier 设计假设 eggs 产品存在于 grocery catalog，但未说明 seed.sql 的前提条件或 verifier 的前提检查。
