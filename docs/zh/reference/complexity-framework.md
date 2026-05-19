# LiveClawBench 复杂度框架

本文档是 LiveClawBench 任务复杂度标注的唯一参考来源。
涵盖因子定义、完整的 54 case 标注表（54 个已实现）、
摘要统计、领域覆盖和控制对。

## 复杂度因子定义

LiveClawBench 定义了四个正交复杂度因子，用于描述超出基础任务执行的结构性难度来源：

- **A1 — 跨服务依赖**（Cross-Service Dependency）：任务需要在单一工作流中协调多个独立服务（如邮件、航空、日历）。
- **A2 — 初始状态污染**（Contaminated Initial State）：环境以损坏、不完整或不一致的状态启动；agent 必须先诊断并修复，再采取行动。
- **B1 — 隐式目标解析**（Implicit Goal Resolution）：任务目标没有明确说明；agent 必须推断缺失的前提条件、寻求澄清，或解决隐式约束。
- **B2 — 知识系统维护**（Knowledge System Maintenance）：任务涉及创建、更新、解决冲突，或管理持久化技能/知识库的依赖关系。

没有任何因子的 case 作为基准：衡量 agent 在单一、干净环境中不含结构性复杂度的基础执行能力。

---

## 1. 54 Case 因子标注表

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
|      31 | mint-diet-snack-log               |  E   |    |    |    |    | Health & Fitness          |
|      32 | weather-aqi-report                |  E   |    |    |    |    | Deep Research & Report     |
|      33 | social-media-posting              |  E   |    |    |    |    | Social Media               |
|      34 | social-unlike-post                |  E   |    |    |    |    | Social Media               |
|      35 | expense-draft-delete              |  E   |    |    |    |    | Finance & Data Analytics   |
|      36 | insurance-deductible-selection    |  E   |    |    |    |    | E-commerce & Daily Svcs    |
|      37 | health-insurance-optimization     |  M   | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      38 | health-daily-record               |  E   |    |    |    |    | Health & Fitness          |
|      39 | finance-portfolio-rebalancing     |  H   |    |    |    |    | Finance & Data Analytics   |
|      40 | finance-monthly-close             |  M   |    |    |    |    | Finance & Data Analytics   |
|      41 | nutrition-log-meal                |  E   |    |    |    |    | Health & Fitness          |
|      42 | mint-diet-comprehensive           |  E   |    |    |    |    | Health & Fitness          |
|      43 | smarthome-test                    |  M   |    |    | ✓  |    | E-commerce & Daily Svcs    |
|      44 | grocery-reorder                   |  M   | ✓  |    | ✓  |    | E-commerce & Daily Svcs    |
|      45 | morning-comfort-setup             |  M   |    | ✓  | ✓  |    | Health & Fitness           |
|      46 | weather-city-travel-pick          |  M   |    |    |    |    | Health & Fitness          |
|      47 | weather-outdoor-window            |  H   |    |    |    |    | Health & Fitness          |
|      48 | pre-meeting-research-brief        |  M   |    |    | ✓  | ✓  | Deep Research & Report     |
|      49 | vendor-due-diligence-brief        |  M   | ✓  |    | ✓  |    | Deep Research & Report     |
|      50 | meeting-reschedule-response       |  E   | ✓  |    |    |    | Calendar & Task Mgmt        |
|      51 | candidate-interview-slot-confirm  |  E   | ✓  |    |    |    | Calendar & Task Mgmt        |
|      52 | medication-prescription-sync      |  H   | ✓  | ✓  | ✓  |    | Health & Fitness            |
|      53 | health-appointment-scheduling     |  H   | ✓  | ✓  | ✓  |    | Health & Fitness            |
|      54 | content-calendar-cross-publish    |  H   | ✓  | ✓  | ✓  |    | Calendar & Task Mgmt        |

---

## 2. 因子摘要统计

| 因子 | 描述                     | 数量 | 占比   | 代表性 Case                                                     |
|------|--------------------------|-----:|-------:|----------------------------------------------------------------|
| A1   | 跨服务依赖               |   18 |  33.3% | flight-seat-selection, flight-seat-selection-failed, flight-cancel-claim, flight-info-change-notice |
| A2   | 初始状态污染             |   10 |  18.5% | blog-site-completion-from-starter, vue-build-fix-single, vue-build-fix-chain, noise-filtering |
| B1   | 隐式目标解析             |   12 |  22.2% | flight-seat-selection-failed, flight-cancel-claim, flight-info-change-notice, baggage-tracking-application |
| B2   | 知识系统维护             |   12 |  22.2% | skill-creation, skill-supplementation, skill-conflict-resolution, skill-repository-curation |

> 占比以 54 个已实现 case 总数为分母。

因子组合分布：

- 无因子（基准）：21 个 case（38.9%）— email-writing, email-reply, flight-booking, blog-site-from-scratch, washer-shop, watch-shop, washer-change, info-change, mint-diet-snack-log, weather-aqi-report, social-media-posting, social-unlike-post, expense-draft-delete, insurance-deductible-selection, health-daily-record, finance-portfolio-rebalancing, finance-monthly-close, nutrition-log-meal, mint-diet-comprehensive
- 单因子：18 个 case（33.3%）
- 双因子：11 个 case（20.4%）— flight-seat-selection-failed (A1+B1), flight-cancel-claim (A1+B1), flight-info-change-notice (A1+B1), noise-filtering (A2+B2), incremental-update-ctp (A2+B2), mixed-tool-memory (A1+B2), live-web-research-sqlite-fts5 (A1+B2), grocery-reorder (A1+B1), morning-comfort-setup (A2+B1), pre-meeting-research-brief (B1+B2), vendor-due-diligence-brief (A1+B1)
- 三因子：4 个 case（7.4%）— conflict-repair-acb (A1+A2+B2), medication-prescription-sync (A1+A2+B1), health-appointment-scheduling (A1+A2+B1), content-calendar-cross-publish (A1+A2+B1)
- **多因子（≥2 个因子）：15 个 case（27.8%）**

---

## 3. 领域 × 因子热力图

各主要领域的因子出现频次：

| 主要领域                   | A1 | A2 | B1 | B2 | 因子实例总数 |
|----------------------------|----|----|----|----|:------------:|
| Documents & Knowledge      |  2 |  2 |  0 | 10 |           14 |
| Communication & Email      |  0 |  0 |  0 |  0 |            0 |
| E-commerce & Daily Svcs    |  7 |  0 |  5 |  0 |           12 |
| Calendar & Task Mgmt       |  5 |  1 |  2 |  0 |            8 |
| Coding & Software Dev      |  0 |  1 |  0 |  0 |            1 |
| DevOps & Env Repair        |  0 |  2 |  0 |  0 |            2 |
| Deep Research & Report     |  2 |  1 |  2 |  3 |            8 |
| Health & Fitness           |  2 |  3 |  3 |  0 |            8 |
| Social Media               |  0 |  0 |  0 |  0 |            0 |
| Finance & Data Analytics   |  0 |  0 |  0 |  0 |            0 |

关键观察：
- **B2 高度集中在 Documents & Knowledge**（10/12），反映了知识管理任务的本质
- **A1 分布最广**，横跨 5 个领域——跨服务协调是普遍的复杂度来源
- **B1 出现在 E-commerce、Calendar 和 Health & Fitness** ——这些领域最自然地产生隐式目标
- **A1+A2+B1 三因子组合首次出现** ——medication-prescription-sync、health-appointment-scheduling 和 content-calendar-cross-publish
- **Health & Fitness 通过 3 个困难任务获得多因子覆盖** ——加上 morning-comfort-setup 引入 A2+B1
- **Social Media 和 Finance & Data Analytics 没有因子** ——这些领域作为纯基准

---

## 4. 控制对

LiveClawBench 包含 2 个经验证具有有效难度梯度的控制对。
每个控制对共享相同的核心任务逻辑；变体恰好新增一个复杂度因子，
由此产生的难度提升证实了该因子的可测量影响。

| 对 | 控制对                          | 基准 Case（难度）                    | 新增因子                    | 变体 Case（难度）                        |
|---:|---------------------------------|--------------------------------------|-----------------------------|------------------------------------------|
|  1 | 购物 → 跨环境购物               | watch-shop (E)                       | +A1（邮件集成）             | email-watch-shop (H)                     |
|  2 | 选座 → 选座失败                 | flight-seat-selection (E)            | +B1（约束失败）             | flight-seat-selection-failed (H)         |

控制对设计说明：
- **对 1** 验证 A1（跨服务依赖）：添加邮件集成将难度从 E 提升至 H，证实跨服务协调在经验上具有挑战性
- **对 2** 验证 B1（隐式目标解析）：为选座添加约束失败处理将难度从 E 提升至 H，证实自主回退推理在经验上具有挑战性

> **覆盖缺口。** 试点 benchmark 尚无 A2（初始状态污染）或 B2（知识系统维护）的有效控制对。
> 曾评估三个候选对，但在经验重校准后（PR #25）已失去难度梯度：washer-shop→email-washer-change
>（A1, E→E）、vue-build-fix-single→chain（A2, H→H）、skill-creation→skill-dependency-fix
>（B2, M→E 倒置）。合成新的 A2 和 B2 隔离对需要新增专门设计的任务——参见
> [未来因子路线图](../../en/roadmap/future_factors.md#controlled-pair-expansion)。

---

## 5. 难度分布

| 难度 | 数量 | 占比   | Case 列表 |
|:----:|-----:|-------:|-----------|
| 简单 |   29 |  53.7% | skill-conflict-resolution, skill-dependency-fix, skill-combination, email-writing, email-reply, flight-seat-selection, flight-info-change-notice, baggage-tracking-application, blog-site-from-scratch, blog-site-completion-from-starter, washer-shop, watch-shop, washer-change, info-change, email-washer-change, incremental-update-ctp, conflict-repair-acb, mixed-tool-memory, mint-diet-snack-log, weather-aqi-report, social-media-posting, social-unlike-post, expense-draft-delete, insurance-deductible-selection, health-daily-record, nutrition-log-meal, mint-diet-comprehensive, meeting-reschedule-response, candidate-interview-slot-confirm |
| 中等 |   15 |  27.8% | skill-creation, skill-supplementation, skill-repository-curation, flight-booking, schedule-change-request, noise-filtering, live-web-research-sqlite-fts5, health-insurance-optimization, finance-monthly-close, smarthome-test, grocery-reorder, morning-comfort-setup, weather-city-travel-pick, pre-meeting-research-brief, vendor-due-diligence-brief |
| 困难 |   10 |  18.5% | flight-seat-selection-failed, flight-cancel-claim, email-watch-shop, vue-build-fix-single, vue-build-fix-chain, finance-portfolio-rebalancing, weather-outdoor-window, medication-prescription-sync, health-appointment-scheduling, content-calendar-cross-publish |

因子数量与难度关系：

| 难度 | 平均因子数 | 基准（0 因子） | 单因子 | 多因子 |
|:----:|:----------:|:--------------:|:------:|:------:|
| 简单 |       0.62 |             16 |      9 |      4 |
| 中等 |       1.20 |              3 |      6 |      6 |
| 困难 |       1.60 |              2 |      3 |      5 |

基于多模型平均通过率的经验重分类显示，简单 case 占主导（53.7%）。简单 case 同时包含基准任务（55.2%）和带因子任务（44.8%），
表明许多结构性复杂度因子对当前 agent 并不构成显著难度。困难 case 集中在需要约束失败处理（B1）、特定挑战性环境（DevOps 中的 A2）或 A1+A2+B1 三因子组合的任务上。
