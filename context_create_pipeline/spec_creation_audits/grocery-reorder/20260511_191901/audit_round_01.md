现在我已加载了审计协议和检查清单。根据用户提供的规格内容，我将直接进行审计分析（这是 Round 1）。

---

# Audit Round 1: grocery-reorder

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
| F6 | low | 3. Environment And Data Completeness | 4. Environment And Data Setup | Smart Home Mock 的 grocery API 与 Shop Mock 功能重叠，未说明两者关系 | 明确两个 mock 的职责分工：Smart Home grocery API vs Shop Mock grocery API | open |
| F7 | low | 1. Structure And Metadata | 1. Case Metadata | `case_id` 为 "TODO from CSV"，需从 `docs/metadata/cases_registry.csv` 获取 | 从 cases_registry.csv 获取下一个可用 case_id | open |
| F8 | low | 3. Environment And Data Completeness | 7. Required Files | `environment/startup.sh` 列为必需文件，但实际应使用 `/opt/mock/startup.d/grocery-reorder.sh` | 统一 startup 脚本路径命名，与 CLAUDE.md 架构一致 | open |

## Previous Round Verification

Not applicable.

## Metadata Check

- `task_name`: `grocery-reorder` ✓ (kebab-case)
- `case_id`: TODO from CSV ✗ (需从 registry 获取)
- `ability_category`: TODO from CSV ✗ (需从 CSV 获取)
- `source_domain`: E-commerce & Daily Services ✓
- `domains_multi`: ["E-commerce & Daily Svcs"] ✓ (与 domain 一致)
- `mock_services`: smart-home-app; shop-web ✓
- `difficulty`: easy ✓
- `factors_supported`: A1=1 ✓
- `task.toml` 结构完整 ✓
- 无 deprecated `capability_dimension` ✓

## Instruction Leakage Check

**问题**: Agent Instruction Draft 包含精确阈值 "less than 1 dozen"，这是 verifier 的判断条件。虽然这是从原始 CSV `task instruction` 字段直接复制，但按照 checklist 规则，agent-facing text 不应暴露精确阈值。

**建议**: 改为自然语言表述，如 "Check my smart fridge inventory. If we're running low on eggs, please order more from the grocery system." 让 agent 自行判断 "running low" 的含义。

## Environment And Verifier Check

**环境问题**:
1. Shop Mock 端口 1234 未在 mock snapshot 中确认
2. 缺少 task-binary-map.json 映射
3. Smart Home Mock 的 grocery API (`/api/grocery/products`, `/api/grocery/orders`) 与 Shop Mock 功能重叠，职责不清
4. Verifier 状态读取路径不明确

**Verifier 问题**:
- "Order created after task start" 维度的状态读取方法不明确（如何获取 task start timestamp？）
- Zero-work baseline 正确：无订单 → 0.0 ✓

## Unresolved Issue Summary

1. **F1**: 指令泄露精确阈值 "less than 1 dozen"
2. **F2**: Shop Mock 端口未确认
3. **F3**: 缺少 task-binary-map.json 映射
4. **F4**: Dockerfile base 来源说明不完整
5. **F5**: Verifier 状态读取路径不明确
6. **F6**: Smart Home grocery API 与 Shop Mock 职责重叠
7. **F7**: case_id 缺失
8. **F8**: startup.sh 路径命名不一致
