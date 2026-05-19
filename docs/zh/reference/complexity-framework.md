# LiveClawBench 复杂度框架

本文档是 LiveClawBench 任务复杂度标注的唯一参考来源。
涵盖因子定义、完整的 56 case 标注表（56 个已实现）、
摘要统计、领域覆盖和控制对。

## 复杂度因子定义

LiveClawBench 定义了四个正交复杂度因子，用于描述超出基础任务执行的结构性难度来源：

- **A1 — 跨服务依赖**（Cross-Service Dependency）：任务需要在单一工作流中协调多个独立服务（如邮件、航空、日历）。
- **A2 — 初始状态污染**（Contaminated Initial State）：环境以损坏、不完整或不一致的状态启动；agent 必须先诊断并修复，再采取行动。
- **B1 — 隐式目标解析**（Implicit Goal Resolution）：任务目标没有明确说明；agent 必须推断缺失的前提条件、寻求澄清，或解决隐式约束。
- **B2 — 知识系统维护**（Knowledge System Maintenance）：任务涉及创建、更新、解决冲突，或管理持久化技能/知识库的依赖关系。

没有任何因子的 case 作为基准：衡量 agent 在单一、干净环境中不含结构性复杂度的基础执行能力。

---

## 1. 56 Case 因子标注表

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
|      31 | mint-diet-snack-log               |  E   |    |    |    |    | Health & Wellness          |
|      32 | weather-aqi-report                |  E   |    |    |    |    | Deep Research & Report     |
|      33 | social-media-posting              |  E   |    |    |    |    | Social Media               |
|      34 | social-unlike-post                |  E   |    |    |    |    | Social Media               |
|      35 | expense-draft-delete              |  E   |    |    |    |    | Finance & Data Analytics   |
|      36 | insurance-deductible-selection    |  E   |    |    |    |    | E-commerce & Daily Svcs    |
|      37 | health-insurance-optimization     |  M   | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      38 | health-daily-record               |  E   |    |    |    |    | Health & Wellness          |
|      39 | finance-portfolio-rebalancing     |  H   |    |    |    |    | Finance & Data Analytics   |
|      40 | finance-monthly-close             |  M   |    |    |    |    | Finance & Data Analytics   |
|      41 | nutrition-log-meal                |  E   |    |    |    |    | Health & Wellness          |
|      42 | mint-diet-comprehensive           |  E   |    |    |    |    | Health & Wellness          |
|      43 | smarthome-test                    |  M   |    |    | ✓  |    | E-commerce & Daily Svcs    |
|      44 | grocery-reorder                   |  M   | ✓  |    | ✓  |    | E-commerce & Daily Svcs    |
|      45 | morning-comfort-setup             |  M   |    | ✓  | ✓  |    | Health & Fitness           |
|      46 | weather-city-travel-pick          |  M   |    |    |    |    | Health & Wellness          |
|      47 | weather-outdoor-window            |  H   |    |    |    |    | Health & Wellness          |
|      48 | pre-meeting-research-brief        |  M   |    |    | ✓  | ✓  | Deep Research & Report     |
|      49 | vendor-due-diligence-brief        |  M   | ✓  |    | ✓  |    | Deep Research & Report     |
|      50 | social-schedule-audit             |  M   |    | ✓  |    |    | Social Media               |
|      51 | social-keyword-cleanup            |  M   | ✓  |    | ✓  |    | Social Media               |
|      52 | social-event-campaign             |  M   | ✓  |    | ✓  |    | Social Media               |
|      53 | social-data-anomaly-report        |  H   | ✓  | ✓  | ✓  |    | Social Media               |
|      54 | social-comment-moderation         |  H   | ✓  |    | ✓  |    | Social Media               |
|      55 | social-cross-publish              |  H   | ✓  |    | ✓  |    | Social Media               |
|      56 | social-pinned-post-update         |  H   | ✓  | ✓  | ✓  |    | Social Media               |

---

## 2. 因子摘要统计

| 因子 | 描述                     | 数量 | 占比   | 代表性 Case                                                     |
|------|--------------------------|-----:|-------:|----------------------------------------------------------------|
| A1   | 跨服务依赖               |   19 | 33.9%  | flight-seat-selection, email-watch-shop, conflict-repair-acb, grocery-reorder, social-keyword-cleanup |
| A2   | 初始状态污染             |   10 | 17.9%  | blog-site-completion-from-starter, vue-build-fix-single, noise-filtering, morning-comfort-setup, social-schedule-audit |
| B1   | 隐式目标解析             |   15 | 26.8%  | flight-seat-selection-failed, flight-cancel-claim, baggage-tracking-application, smarthome-test, grocery-reorder, morning-comfort-setup, pre-meeting-research-brief, social-comment-moderation |
| B2   | 知识系统维护             |   12 | 21.4%  | skill-creation, skill-dependency-fix, noise-filtering, pre-meeting-research-brief |

> 占比以 56 个已实现 case 总数为分母。

因子组合分布：

- 无因子（基准）：21 个 case（37.5%）— email-writing, email-reply, flight-booking, blog-site-from-scratch, washer-shop, watch-shop, washer-change, info-change, mint-diet-snack-log, weather-aqi-report, social-media-posting, social-unlike-post, expense-draft-delete, insurance-deductible-selection, health-daily-record, finance-portfolio-rebalancing, finance-monthly-close, nutrition-log-meal, mint-diet-comprehensive, weather-city-travel-pick, weather-outdoor-window
- 单因子：17 个 case（30.4%）
- 双因子：15 个 case（26.8%）— flight-seat-selection-failed (A1+B1), flight-cancel-claim (A1+B1), flight-info-change-notice (A1+B1), noise-filtering (A2+B2), incremental-update-ctp (A2+B2), mixed-tool-memory (A1+B2), live-web-research-sqlite-fts5 (A1+B2), grocery-reorder (A1+B1), morning-comfort-setup (A2+B1), pre-meeting-research-brief (B1+B2), vendor-due-diligence-brief (A1+B1), social-keyword-cleanup (A1+B1), social-event-campaign (A1+B1), social-comment-moderation (A1+B1), social-cross-publish (A1+B1)
- 三因子：3 个 case（5.4%）— conflict-repair-acb (A1+A2+B2), social-data-anomaly-report (A1+A2+B1), social-pinned-post-update (A1+A2+B1)
- **多因子（≥2 个因子）：18 个 case（32.1%）**

---

## 3. 领域 × 因子热力图

各主要领域的因子出现频次：

| 主要领域                   | A1 | A2 | B1 | B2 | 因子实例总数 |
|----------------------------|----|----|----|----|:------------:|
| Documents & Knowledge      |  2 |  2 |  0 |  9 |           13 |
| Communication & Email      |  0 |  0 |  0 |  0 |            0 |
| E-commerce & Daily Svcs    |  7 |  0 |  5 |  0 |           12 |
| Calendar & Task Mgmt       |  2 |  0 |  1 |  0 |            3 |
| Coding & Software Dev      |  0 |  1 |  0 |  0 |            1 |
| DevOps & Env Repair        |  0 |  2 |  0 |  0 |            2 |
| Deep Research & Report     |  2 |  1 |  2 |  3 |            8 |
| Health & Fitness           |  0 |  1 |  1 |  0 |            2 |
| Social Media               |  6 |  3 |  6 |  0 |           15 |
| Finance & Data Analytics   |  0 |  0 |  0 |  0 |            0 |
| Health & Wellness          |  0 |  0 |  0 |  0 |            0 |

关键观察：
- **B2 高度集中在 Documents & Knowledge**（9/12），反映了知识管理任务的本质
- **A1 分布最广**，横跨 6 个领域——跨服务协调是普遍的复杂度来源
- **B1 出现在 E-commerce、Calendar、Deep Research、Health & Fitness 和 Social Media** ——这些领域最自然地产生隐式目标
- **Communication & Email 没有任何因子** ——这些 case 作为纯基准
- **Health & Fitness 现在带有 A2+B1** ——通过 morning-comfort-setup，把该领域从基准升级为多因子
- **Social Media（9 个任务）以 15 个因子实例领跑** ——7 个新增任务覆盖 A1=6、A2=3、B1=6
- **Finance & Data Analytics 与 Health & Wellness 仍为基准** ——finance-* 与 weather-*/health-daily-record/mint-diet-* 系列作为领域控制点

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
| 简单 |   27 | 48.2%  | skill-conflict-resolution, skill-dependency-fix, skill-combination, email-writing, email-reply, flight-seat-selection, flight-info-change-notice, baggage-tracking-application, blog-site-from-scratch, blog-site-completion-from-starter, washer-shop, watch-shop, washer-change, info-change, email-washer-change, incremental-update-ctp, conflict-repair-acb, mixed-tool-memory, mint-diet-snack-log, weather-aqi-report, social-media-posting, social-unlike-post, expense-draft-delete, insurance-deductible-selection, health-daily-record, nutrition-log-meal, mint-diet-comprehensive |
| 中等 |   18 | 32.1%  | skill-creation, skill-supplementation, skill-repository-curation, flight-booking, schedule-change-request, noise-filtering, live-web-research-sqlite-fts5, health-insurance-optimization, finance-monthly-close, smarthome-test, grocery-reorder, morning-comfort-setup, weather-city-travel-pick, pre-meeting-research-brief, vendor-due-diligence-brief, social-schedule-audit, social-keyword-cleanup, social-event-campaign |
| 困难 |   11 | 19.6%  | flight-seat-selection-failed, flight-cancel-claim, email-watch-shop, vue-build-fix-single, vue-build-fix-chain, finance-portfolio-rebalancing, weather-outdoor-window, social-data-anomaly-report, social-comment-moderation, social-cross-publish, social-pinned-post-update |

因子数量与难度关系：

| 难度 | 平均因子数 | 基准（0 因子） | 单因子 | 多因子 |
|:----:|:----------:|:--------------:|:------:|:------:|
| 简单 |       0.59 |             16 |      7 |      4 |
| 中等 |       1.28 |              3 |      7 |      8 |
| 困难 |       1.55 |              2 |      3 |      6 |

基于多模型平均通过率的经验重分类显示，简单 case 占主导（48.2%）。简单 case 同时包含基准任务（59.3%）和带因子任务（40.7%），
表明许多结构性复杂度因子对当前 agent 并不构成显著难度。困难 case 集中在 B1 与 A1 或 A2 组合的任务（如 social-data-anomaly-report、social-pinned-post-update）、
污染初始状态的 DevOps 环境，以及高精度领域执行（finance-portfolio-rebalancing、weather-outdoor-window）。
