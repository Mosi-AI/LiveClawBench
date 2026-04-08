# LiveClawBench 复杂度框架

本文档是 LiveClawBench 任务复杂度标注的唯一参考来源。
涵盖因子定义、完整的 30 case 标注表（30 个已实现）、
摘要统计、领域覆盖和控制对。

## 复杂度因子定义

LiveClawBench 定义了四个正交复杂度因子，用于描述超出基础任务执行的结构性难度来源：

- **A1 — 跨服务依赖**（Cross-Service Dependency）：任务需要在单一工作流中协调多个独立服务（如邮件、航空、日历）。
- **A2 — 初始状态污染**（Contaminated Initial State）：环境以损坏、不完整或不一致的状态启动；agent 必须先诊断并修复，再采取行动。
- **B1 — 隐式目标解析**（Implicit Goal Resolution）：任务目标没有明确说明；agent 必须推断缺失的前提条件、寻求澄清，或解决隐式约束。
- **B2 — 知识系统维护**（Knowledge System Maintenance）：任务涉及创建、更新、解决冲突，或管理持久化技能/知识库的依赖关系。

没有任何因子的 case 作为基准：衡量 agent 在单一、干净环境中不含结构性复杂度的基础执行能力。

---

## 1. 30 Case 因子标注表

`✓` 表示该 case 包含对应因子。

| case_id | Case 名称                         | 难度 | A1 | A2 | B1 | B2 | 主要领域                   |
|--------:|-----------------------------------|:----:|:--:|:--:|:--:|:--:|----------------------------|
|       1 | skill-creation                    |  M   |    |    |    | ✓  | Documents & Knowledge      |
|       2 | skill-supplementation             |  M   |    |    |    | ✓  | Documents & Knowledge      |
|       3 | skill-conflict-resolution         |  E   |    |    |    | ✓  | Documents & Knowledge      |
|       4 | skill-repository-curation         |  M   |    |    |    | ✓  | Documents & Knowledge      |
|       5 | skill-dependency-fix              |  E   |    |    |    | ✓  | Documents & Knowledge      |
|      30 | skill-combination                 |  E   |    |    |    | ✓  | Documents & Knowledge      |
|       6 | email-writing                     |  E   |    |    |    |    | Communication & Email      |
|       7 | email-reply                       |  E   |    |    |    |    | Communication & Email      |
|       8 | flight-booking                    |  M   |    |    |    |    | E-commerce & Daily Svcs    |
|       9 | flight-seat-selection             |  E   | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      10 | flight-seat-selection-failed      |  H   | ✓  |    | ✓  |    | E-commerce & Daily Svcs    |
|      11 | flight-cancel-claim               |  H   | ✓  |    | ✓  |    | E-commerce & Daily Svcs    |
|      12 | flight-info-change-notice         |  E   | ✓  |    | ✓  |    | Calendar & Task Mgmt       |
|      13 | baggage-tracking-application      |  E   |    |    | ✓  |    | E-commerce & Daily Svcs    |
|      14 | schedule-change-request           |  M   | ✓  |    |    |    | Calendar & Task Mgmt       |
|      15 | blog-site-from-scratch            |  E   |    |    |    |    | Coding & Software Dev      |
|      16 | blog-site-completion-from-starter |  E   |    | ✓  |    |    | Coding & Software Dev      |
|      17 | washer-shop                       |  E   |    |    |    |    | E-commerce & Daily Svcs    |
|      18 | watch-shop                        |  E   |    |    |    |    | E-commerce & Daily Svcs    |
|      19 | washer-change                     |  E   |    |    |    |    | E-commerce & Daily Svcs    |
|      20 | info-change                       |  E   |    |    |    |    | E-commerce & Daily Svcs    |
|      21 | email-watch-shop                  |  H   | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      22 | email-washer-change               |  E   | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      23 | vue-build-fix-single              |  H   |    | ✓  |    |    | DevOps & Env Repair        |
|      24 | vue-build-fix-chain               |  H   |    | ✓  |    |    | DevOps & Env Repair        |
|      25 | noise-filtering                   |  M   |    | ✓  |    | ✓  | Deep Research & Report     |
|      26 | incremental-update-ctp            |  E   |    | ✓  |    | ✓  | Documents & Knowledge      |
|      27 | conflict-repair-acb               |  E   | ✓  | ✓  |    | ✓  | Documents & Knowledge      |
|      28 | mixed-tool-memory                 |  E   | ✓  |    |    | ✓  | Documents & Knowledge      |
|      29 | live-web-research-sqlite-fts5     |  M   | ✓  |    |    | ✓  | Deep Research & Report     |

---

## 2. 因子摘要统计

| 因子 | 描述                     | 数量 | 占比   | 代表性 Case                                                     |
|------|--------------------------|-----:|-------:|----------------------------------------------------------------|
| A1   | 跨服务依赖               |   10 | 33.3%  | flight-seat-selection, email-watch-shop, conflict-repair-acb   |
| A2   | 初始状态污染             |    6 | 20.0%  | blog-site-completion-from-starter, vue-build-fix-single, noise-filtering |
| B1   | 隐式目标解析             |    4 | 13.3%  | flight-seat-selection-failed, flight-cancel-claim, flight-info-change-notice, baggage-tracking-application |
| B2   | 知识系统维护             |   11 | 36.7%  | skill-creation, skill-dependency-fix, noise-filtering          |

> 占比以 30 个已实现 case 总数为分母。

因子组合分布：

- 无因子（基准）：8 个 case（26.7%）— email-writing, email-reply, flight-booking, blog-site-from-scratch, washer-shop, watch-shop, washer-change, info-change
- 单因子：14 个 case（46.7%）
- 双因子：7 个 case（23.3%）— flight-seat-selection-failed (A1+B1), flight-cancel-claim (A1+B1), flight-info-change-notice (A1+B1), noise-filtering (A2+B2), incremental-update-ctp (A2+B2), mixed-tool-memory (A1+B2), live-web-research-sqlite-fts5 (A1+B2)
- 三因子：1 个 case（3.3%）— conflict-repair-acb (A1+A2+B2)
- **多因子（≥2 个因子）：8 个 case（26.7%）**

---

## 3. 领域 × 因子热力图

各主要领域的因子出现频次：

| 主要领域                   | A1 | A2 | B1 | B2 | 因子实例总数 |
|----------------------------|----|----|----|----|:------------:|
| Documents & Knowledge      |  2 |  2 |  0 | 10 |           14 |
| Communication & Email      |  0 |  0 |  0 |  0 |            0 |
| E-commerce & Daily Svcs    |  5 |  0 |  2 |  0 |            7 |
| Calendar & Task Mgmt       |  2 |  0 |  1 |  0 |            3 |
| Coding & Software Dev      |  0 |  1 |  0 |  0 |            1 |
| DevOps & Env Repair        |  0 |  2 |  0 |  0 |            2 |
| Deep Research & Report     |  1 |  1 |  0 |  2 |            4 |

关键观察：
- **B2 高度集中在 Documents & Knowledge**（10/11），反映了知识管理任务的本质
- **A1 分布最广**，横跨 4 个领域——跨服务协调是普遍的复杂度来源
- **B1 仅出现在 E-commerce 和 Calendar** ——这些领域最自然地产生隐式目标
- **Communication & Email 没有任何因子** ——这些 case 作为纯基准

---

## 4. 控制对

LiveClawBench 包含 5 个控制对，用于隔离单一因子对 agent 性能的影响：

- **因子增加对**：变体在基准上恰好新增一个复杂度因子
- **强度梯度对**：两个 case 共享同一因子，但深度/严重程度不同

| 对 ID | 控制对                          | 基准 Case（难度）                    | 新增因子                    | 变体 Case（难度）                        |
|------:|---------------------------------|--------------------------------------|-----------------------------|------------------------------------------|
|     1 | 购物 → 跨环境购物               | washer-shop (E)                      | +A1（邮件集成）             | email-washer-change (E)                  |
|     2 | 购物 → 跨环境购物               | watch-shop (E)                       | +A1（邮件集成）             | email-watch-shop (H)                     |
|     3 | 选座 → 选座失败                 | flight-seat-selection (E)            | +B1（约束失败）             | flight-seat-selection-failed (H)         |
|     4 | Vue 修复 single → chain         | vue-build-fix-single (H)             | +A2（更复杂的故障）         | vue-build-fix-chain (H)                  |
|     5 | 技能创建 → 依赖修复             | skill-creation (M)                   | +B2（依赖链）               | skill-dependency-fix (E)                 |

控制对设计说明：
- **对 1–2** 验证 A1（跨服务依赖）：对 2 证实 A1 提升难度（E→H）。对 1 在重新校准后已失去难度梯度（E→E）；**它已无法作为 A1 隔离实验**，应被视为基准 case 的鲁棒性复现，而非受控的 A1 探针。
- **对 3** 验证 B1（隐式目标解析）：为选座添加约束失败处理将难度从 E 提升至 H，证实自主回退推理在经验上具有挑战性
- **对 4** 是强度梯度：两个变体经验上均为 H —— **它已无法作为 A2 隔离实验**，因为不存在可测量的难度梯度。当前经验难度分级的粒度不足以区分故障链深度差异。
- **对 5** 是结果倒置的强度梯度：经验上变体 (E) 比基准 (M) 更简单 —— **它已无法作为 B2 隔离实验**。倒置结果表明 agent 处理依赖链修复比开放式技能创建更得心应手，但这不能单独归因于 B2 因子。

---

## 5. 难度分布

| 难度 | 数量 | 占比   | Case 列表 |
|:----:|-----:|-------:|-----------|
| 简单 |   18 | 60.0%  | skill-conflict-resolution, skill-dependency-fix, skill-combination, email-writing, email-reply, flight-seat-selection, flight-info-change-notice, baggage-tracking-application, blog-site-from-scratch, blog-site-completion-from-starter, washer-shop, watch-shop, washer-change, info-change, email-washer-change, incremental-update-ctp, conflict-repair-acb, mixed-tool-memory |
| 中等 |    7 | 23.3%  | skill-creation, skill-supplementation, skill-repository-curation, flight-booking, schedule-change-request, noise-filtering, live-web-research-sqlite-fts5 |
| 困难 |    5 | 16.7%  | flight-seat-selection-failed, flight-cancel-claim, email-watch-shop, vue-build-fix-single, vue-build-fix-chain |

因子数量与难度关系：

| 难度 | 平均因子数 | 基准（0 因子） | 单因子 | 多因子 |
|:----:|:----------:|:--------------:|:------:|:------:|
| 简单 |       0.89 |              7 |      7 |      4 |
| 中等 |       1.14 |              1 |      4 |      2 |
| 困难 |       1.40 |              0 |      3 |      2 |

基于多模型平均通过率的经验重分类显示，简单 case 占主导（60%）。简单 case 同时包含基准任务（38.9%）和带因子任务（61.1%），
表明许多结构性复杂度因子对当前 agent 并不构成显著难度。困难 case 集中在需要约束失败处理（B1）或特定挑战性环境（DevOps 中的 A2）的任务上。
