# LiveClawBench 复杂度框架

本文档是 LiveClawBench 任务复杂度标注的唯一参考来源。
涵盖因子定义、完整的 134 case 标注表（134 个已实现）、
摘要统计、领域覆盖和控制对。

## 复杂度因子定义

LiveClawBench 定义了六个正交复杂度因子，用于描述超出基础任务执行的结构性难度来源：

- **A1 — 跨服务依赖**（Cross-Service Dependency）：任务需要在单一工作流中协调多个独立服务（如邮件、航空、日历）。
- **A2 — 初始状态污染**（Contaminated Initial State）：环境以损坏、不完整或不一致的状态启动；agent 必须先诊断并修复，再采取行动。
- **B1 — 隐式目标解析**（Implicit Goal Resolution）：任务目标没有明确说明；agent 必须推断缺失的前提条件、寻求澄清，或解决隐式约束。
- **B2 — 知识系统维护**（Knowledge System Maintenance）：任务涉及创建、更新、解决冲突，或管理持久化技能/知识库的依赖关系。
- **C1 — 环境状态失效**（Environmental State Invalidation）：在 agent 开始执行后，环境状态因外部原因发生变化，使 agent 已建立的假设失效，迫使其重新规划。与 A2 的关键区别：A2 从一开始就损坏；C1 在执行中途失效。
- **C2 — 变更状态下结果验证**（Outcome Verification under Altered State）：agent 必须观察环境状态来判断任务是否真正成功，而非依赖简单的通过/失败信号。Mock 服务可能返回成功响应但不实际持久化变更（一次性：首次尝试静默失败，后续尝试成功）。

没有任何因子的 case 作为基准：衡量 agent 在单一、干净环境中不含结构性复杂度的基础执行能力。

---

## 1. 134 Case 因子标注表

`✓` 表示该 case 包含对应因子。

| case_id | Case 名称                         | 难度 | A1 | A2 | B1 | B2 | C1 | C2 | 主要领域                   |
|--------:|-----------------------------------|:----:|:--:|:--:|:--:|:--:|:--:|:--:|----------------------------|
|      1 | skill-creation                    |  H   |    |    |    | ✓  |    |    | Documents & Knowledge      |
|      2 | skill-supplementation             |  E   |    |    |    | ✓  |    |    | Documents & Knowledge      |
|      3 | skill-conflict-resolution         |  E   |    |    |    | ✓  |    |    | Documents & Knowledge      |
|      4 | skill-repository-curation         |  M   |    |    |    | ✓  |    |    | Documents & Knowledge      |
|      5 | skill-dependency-fix              |  M   |    |    |    | ✓  |    |    | Documents & Knowledge      |
|      6 | email-writing                     |  E   |    |    |    |    |    |    | Communication & Email      |
|      7 | email-reply                       |  E   |    |    |    |    |    |    | Communication & Email      |
|      8 | flight-booking                    |  H   |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|      9 | flight-seat-selection             |  E   | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     10 | flight-seat-selection-failed      |  M   | ✓  |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     11 | flight-cancel-claim               |  H   | ✓  |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     12 | flight-info-change-notice         |  M   | ✓  |    | ✓  |    |    |    | Calendar & Task Mgmt       |
|     13 | baggage-tracking-application      |  E   |    |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     14 | schedule-change-request           |  E   | ✓  |    |    |    |    |    | Calendar & Task Mgmt       |
|     15 | blog-site-from-scratch            |  E   |    |    |    |    |    |    | Coding & Software Dev      |
|     16 | blog-site-completion-from-starter |  E   |    | ✓  |    |    |    |    | Coding & Software Dev      |
|     17 | washer-shop                       |  M   |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     18 | watch-shop                        |  E   |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     19 | washer-change                     |  E   |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     20 | info-change                       |  E   |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     21 | email-watch-shop                  |  E   | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     22 | email-washer-change               |  E   | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     23 | vue-build-fix-single              |  M   |    | ✓  |    |    |    |    | DevOps & Env Repair        |
|     24 | vue-build-fix-chain               |  E   |    | ✓  |    |    |    |    | DevOps & Env Repair        |
|     25 | noise-filtering                   |  M   |    | ✓  |    | ✓  |    |    | Deep Research & Report     |
|     26 | incremental-update-ctp            |  E   |    | ✓  |    | ✓  |    |    | Documents & Knowledge      |
|     27 | conflict-repair-acb               |  E   | ✓  | ✓  |    | ✓  |    |    | Documents & Knowledge      |
|     28 | mixed-tool-memory                 |  E   | ✓  |    |    | ✓  |    |    | Documents & Knowledge      |
|     29 | live-web-research-sqlite-fts5     |  M   | ✓  |    |    | ✓  |    |    | Deep Research & Report     |
|     30 | skill-combination                 |  E   |    |    |    | ✓  |    |    | Documents & Knowledge      |
|     31 | mint-diet-snack-log               |  E   |    |    |    |    |    |    | Health & Fitness           |
|     32 | weather-aqi-report                |  M   |    |    |    |    |    |    | Deep Research & Report     |
|     33 | social-media-posting              |  E   |    |    |    |    |    |    | Social Media               |
|     34 | social-unlike-post                |  M   |    |    |    |    |    |    | Social Media               |
|     35 | expense-draft-delete              |  E   |    |    |    |    |    |    | Finance & Data Analytics   |
|     36 | insurance-deductible-selection    |  E   |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     37 | health-insurance-optimization     |  E   | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     38 | health-daily-record               |  H   |    |    |    |    |    |    | Health & Fitness           |
|     39 | finance-portfolio-rebalancing     |  E   |    |    | ✓  |    |    |    | Finance & Data Analytics   |
|     40 | finance-monthly-close             |  E   |    | ✓  |    |    |    |    | Finance & Data Analytics   |
|     41 | nutrition-log-meal                |  M   |    |    |    |    |    |    | Health & Fitness           |
|     42 | mint-diet-comprehensive           |  M   |    |    |    |    |    |    | Health & Fitness           |
|     43 | smarthome-test                    |  M   |    |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     44 | grocery-reorder                   |  H   | ✓  |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     45 | morning-comfort-setup             |  M   |    | ✓  | ✓  |    |    |    | Health & Fitness           |
|     46 | weather-city-travel-pick          |  E   |    |    |    |    |    |    | Health & Fitness           |
|     47 | weather-outdoor-window            |  E   |    |    |    |    |    |    | Health & Fitness           |
|     48 | pre-meeting-research-brief        |  E   |    |    | ✓  | ✓  |    |    | Deep Research & Report     |
|     49 | vendor-due-diligence-brief        |  E   | ✓  |    | ✓  |    |    |    | Deep Research & Report     |
|     50 | social-schedule-audit             |  H   |    | ✓  |    |    |    |    | Social Media               |
|     51 | social-keyword-cleanup            |  H   | ✓  |    | ✓  |    |    |    | Social Media               |
|     52 | social-event-campaign             |  H   | ✓  |    | ✓  |    |    |    | Social Media               |
|     53 | social-data-anomaly-report        |  H   | ✓  | ✓  | ✓  |    |    |    | Social Media               |
|     54 | social-comment-moderation         |  H   | ✓  |    | ✓  |    |    |    | Social Media               |
|     55 | social-cross-publish              |  E   | ✓  |    | ✓  |    |    |    | Social Media               |
|     56 | social-pinned-post-update         |  H   | ✓  | ✓  | ✓  |    |    |    | Social Media               |
|     57 | meeting-reschedule-response       |  E   | ✓  |    |    |    |    |    | Calendar & Task Mgmt       |
|     58 | candidate-interview-slot-confirm  |  M   | ✓  |    |    |    |    |    | Calendar & Task Mgmt       |
|     59 | medication-prescription-sync      |  E   | ✓  | ✓  | ✓  |    |    |    | Health & Fitness           |
|     60 | health-appointment-scheduling     |  M   | ✓  | ✓  | ✓  |    |    |    | Health & Fitness           |
|     61 | content-calendar-cross-publish    |  H   | ✓  | ✓  | ✓  |    |    |    | Calendar & Task Mgmt       |
|     62 | finance-tax-prepare               |  E   | ✓  |    | ✓  | ✓  |    |    | Finance & Data Analytics   |
|     63 | finance-analysis-generate         |  E   | ✓  |    | ✓  | ✓  |    |    | Finance & Data Analytics   |
|     64 | finance-depreciation-audit        |  E   |    | ✓  | ✓  | ✓  |    |    | Finance & Data Analytics   |
|     65 | finance-dashboard-repair          |  M   |    | ✓  |    | ✓  |    |    | Finance & Data Analytics   |
|     66 | finance-expense-log               |  E   |    |    | ✓  |    |    |    | Finance & Data Analytics   |
|     67 | finance-invoice-process           |  M   | ✓  |    |    |    |    |    | Finance & Data Analytics   |
|     68 | finance-anomaly-detect            |  M   |    | ✓  | ✓  |    |    |    | Finance & Data Analytics   |
|     69 | finance-budget-alert              |  M   | ✓  | ✓  |    |    |    |    | Finance & Data Analytics   |
|     70 | sticker-store-acquire             |  M   |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     71 | chat-sticker-engagement           |  E   |    |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     72 | cd-pipeline-setup                 |  E   | ✓  | ✓  | ✓  | ✓  |    |    | DevOps & Env Repair        |
|     73 | security-audit-remediation        |  E   | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     74 | tls-cert-rotation-sla             |  M   | ✓  | ✓  | ✓  | ✓  |    |    | DevOps & Env Repair        |
|     75 | grpc-service-crash-diagnosis      |  M   | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     76 | db-corruption-multi-recovery      |  E   | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     77 | legacy-stack-migration-deploy     |  E   | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     78 | chaotic-repo-restoration          |  E   |    | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     79 | monitoring-alerting-setup         |  M   | ✓  |    | ✓  |    |    |    | DevOps & Env Repair        |
|     80 | git-merge-conflict-deploy         |  E   | ✓  | ✓  |    |    |    |    | DevOps & Env Repair        |
|     81 | log-triage-incident-report        |  M   | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     82 | package-build-publish             |  M   | ✓  | ✓  |    |    |    |    | DevOps & Env Repair        |
|     83 | microservice-stack-deploy         |  M   | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     84 | python-dependency-hell-resolution |  H   |    | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     85 | email-phishing-injection          |  E   |    |    |    |    |    |    | Communication & Email      |
|     86 | cross-service-credential-handling |  M   | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     87 | email-shop-privacy-leak           |  E   | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     88 | api-key-in-devops                 |  H   |    | ✓  |    |    |    |    | DevOps & Env Repair        |
|     89 | fake-system-notification          |  H   |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     90 | flight-calendar-overshare         |  H   | ✓  |    | ✓  |    |    |    | Calendar & Task Mgmt       |
|     91 | corpus-file-injection             |  M   |    | ✓  |    | ✓  |    |    | Deep Research & Report     |
|     92 | skill-repo-dangerous-cleanup      |  M   |    |    |    | ✓  |    |    | Documents & Knowledge      |
|     93 | phishing-in-inbox                 |  E   | ✓  |    |    |    |    |    | Calendar & Task Mgmt       |
|     94 | browser-portal-injection          |  E   | ✓  | ✓  |    | ✓  |    |    | Documents & Knowledge      |
|     95 | ambiguous-cleanup-task            |  M   |    | ✓  |    |    |    |    | DevOps & Env Repair        |
|     96 | research-with-adversarial-sources |  H   | ✓  |    |    | ✓  |    |    | Deep Research & Report     |
|     97 | workspace-task-record-batch       |  E   |    |    |    |    |    |    | Calendar & Task Mgmt       |
|     98 | workspace-brief-tracking          |  E   |    |    |    |    |    |    | Documents & Knowledge      |
|     99 | crispr-off-target-mitigation      |  M   |    |    |    |    |    |    | Deep Research & Report     |
|    100 | autonomous-weapons-ethics         |  M   |    |    |    |    |    |    | Deep Research & Report     |
|    101 | cross-border-data-privacy-comparison |  H   |    |    |    |    |    |    | Deep Research & Report     |
|    102 | defi-systemic-risk-contagion      |  E   |    |    |    |    |    |    | Deep Research & Report     |
|    103 | formal-verification-vs-fuzzing    |  M   |    |    |    |    |    |    | Deep Research & Report     |
|    104 | mrna-cancer-vaccines-landscape    |  M   |    |    |    |    |    |    | Deep Research & Report     |
|    105 | digital-religion-ai-vr            |  H   |    |    |    |    |    |    | Deep Research & Report     |
|    106 | fusion-energy-commercial-viability |  H   |    |    |    |    |    |    | Deep Research & Report     |
|    107 | ai-copyright-international-jurisprudence |  M   |    |    |    |    |    |    | Deep Research & Report     |
|    108 | long-covid-neurological-hypotheses |  H   |    |    |    |    |    |    | Deep Research & Report     |
|    109 | ansible-iptables-ipset            |  E   |    | ✓  | ✓  |    |    |    | Coding & Software Dev      |
|    110 | citation-network-influence        |  E   |    |    | ✓  |    |    |    | Coding & Software Dev      |
|    111 | element-web-unverified-device     |  H   |    | ✓  | ✓  |    |    |    | Coding & Software Dev      |
|    112 | ga-classical-optimization         |  M   |    |    | ✓  | ✓  |    |    | Coding & Software Dev      |
|    113 | ga-gol-persistent-structures      |  H   |    |    | ✓  |    |    |    | Coding & Software Dev      |
|    114 | openlibrary-3rd-metadata-source   |  H   | ✓  |    |    | ✓  |    |    | Coding & Software Dev      |
|    115 | teleport-gcp-cert-identity        |  H   | ✓  |    |    | ✓  |    |    | Coding & Software Dev      |
|    116 | vuls-kernel-detection             |  H   |    | ✓  |    | ✓  |    |    | Coding & Software Dev      |
|     117 | email-reply-context-shift          |  H   |    |    |    |    | ✓  |    | Communication & Email      |
|     118 | email-sending-verify               |  E   |    |    |    |    |    | ✓  | Communication & Email      |
|     119 | watch-shop-stockout                 |  E   |    |    |    |    | ✓  |    | E-commerce & Daily Svcs    |
|     120 | watch-shop-silent-fail              |  M   |    |    |    |    |    | ✓  | E-commerce & Daily Svcs    |
|     121 | meeting-slot-race                   |  M   | ✓  |    |    |    | ✓  |    | Calendar & Task Mgmt       |
|     122 | interview-slot-verify               |  H   | ✓  |    |    |    |    | ✓  | Calendar & Task Mgmt       |
|     123 | mint-diet-stockout                  |  E   |    |    |    |    | ✓  |    | Health & Fitness           |
|     124 | health-record-verify                |  H   |    |    |    |    |    | ✓  | Health & Fitness           |
|     125 | social-post-rate-limit              |  M   |    |    |    |    | ✓  |    | Social Media               |
|     126 | social-unlike-verify                |  H   |    |    |    |    |    | ✓  | Social Media               |
|     127 | expense-submit-verify               |  M   |    |    |    |    |    | ✓  | Finance & Data Analytics   |
|     128 | finance-budget-shift                |  H   | ✓  | ✓  |    |    | ✓  |    | Finance & Data Analytics   |
|     129 | vue-fix-rebreak                     |  M   |    | ✓  |    |    | ✓  |    | DevOps & Env Repair        |
|     130 | vendor-requirement-followup       |  E   | ✓  |    | ✓  | ✓  |    |    | Communication & Email      |
|     131 | invoice-to-expense-draft          |  M   | ✓  |    | ✓  |    |    |    | Communication & Email      |
|     132 | newsletter-digest-forward         |  M   | ✓  |    | ✓  |    |    |    | Communication & Email      |
|     133 | procurement-quote-compare-reply   |  H   |    |    | ✓  |    |    |    | Communication & Email      |
|     134 | stale-client-escalation           |  M   | ✓  |    | ✓  | ✓  |    |    | Communication & Email      |


---

## 2. 因子摘要统计

| 因子 | 描述                     | 数量 | 占比   | 代表性 Case                                                     |
|------|--------------------------|-----:|-------:|----------------------------------------------------------------|
| A1   | 跨服务依赖               |    54 |  40.3% | flight-seat-selection, email-watch-shop, conflict-repair-acb, grocery-reorder, content-calendar-cross-publish |
| A2   | 初始状态污染             |    39 |  29.1% | blog-site-completion-from-starter, vue-build-fix-single, noise-filtering, morning-comfort-setup, ambiguous-cleanup-task |
| B1   | 隐式目标解析             |    47 |  35.1% | flight-seat-selection-failed, flight-cancel-claim, baggage-tracking-application, smarthome-test, pre-meeting-research-brief |
| B2   | 知识系统维护             |    28 |  20.9% | skill-creation, skill-dependency-fix, noise-filtering, pre-meeting-research-brief, research-with-adversarial-sources |
| C1   | 环境状态失效             |     7 |   5.4% | email-reply-context-shift, watch-shop-stockout, meeting-slot-race, social-post-rate-limit, vue-fix-rebreak |
| C2   | 变更状态下结果验证       |     6 |   4.7% | email-sending-verify, watch-shop-silent-fail, interview-slot-verify, health-record-verify, expense-submit-verify |

> 占比以 134 个已实现 case 总数为分母。

因子组合分布：

- 无因子（基准）：34 个 case（25.4%）
- 单因子：42 个 case（31.3%）
- 双因子：37 个 case（27.6%）
- 三因子：19 个 case（14.2%）
- 四因子：2 个 case（1.5%）
- **多因子（≥2 个因子）：58 个 case（43.3%）**


---

## 3. 领域 × 因子热力图

各主要领域的因子出现频次：

| 主要领域                   | A1 | A2 | B1 | B2 | C1 | C2 | 因子实例总数 |
|----------------------------|----|----|----|----|----|----|:------------:|
| Documents & Knowledge      |  3 |  3 |  0 | 11 |  0 |  0 |           17 |
| Communication & Email      |  4 |  0 |  5 |  2 |  1 |  1 |           13 |
| E-commerce & Daily Svcs    |  9 |  0 |  6 |  0 |  1 |  1 |           17 |
| Calendar & Task Mgmt       |  9 |  1 |  3 |  0 |  1 |  1 |           15 |
| Coding & Software Dev      |  2 |  4 |  5 |  4 |  0 |  0 |           15 |
| DevOps & Env Repair        | 11 | 17 | 11 |  2 |  1 |  0 |           42 |
| Deep Research & Report     |  3 |  2 |  2 |  5 |  0 |  0 |           12 |
| Health & Fitness           |  2 |  3 |  3 |  0 |  1 |  1 |           10 |
| Social Media               |  6 |  3 |  6 |  0 |  1 |  1 |           17 |
| Finance & Data Analytics   |  5 |  6 |  6 |  4 |  1 |  1 |           23 |

关键观察：
- **B2 高度集中在 Documents & Knowledge**（11/17），反映了知识管理任务的本质
- **A1 分布最广**，横跨 8 个领域——跨服务协调是普遍的复杂度来源
- **B1 出现在除 Documents & Knowledge 外的所有领域** ——隐式目标解析是跨领域的基础复杂度
- **Communication & Email 不再是纯零因子领域** ——通过 email-reply-context-shift、email-sending-verify 等任务获得 C1/C2 覆盖，同时 vendor-requirement-followup 和 invoice-to-expense-draft 引入 A1+B1
- **DevOps & Env Repair 是因子密度最高的领域**（42 个实例）——A2 和 B1 负载极重，反映了环境修复任务的诊断-执行双重难度
- **Social Media（11 个任务）与 E-commerce（22 个任务）并列因子实例数第三**（各 17 个）——Social Media 覆盖 A1=6、A2=3、B1=6，E-commerce 覆盖 A1=9、B1=6

---

## 4. 控制对

LiveClawBench 包含 2 个经验证具有有效难度梯度的控制对。
每个控制对共享相同的核心任务逻辑；变体恰好新增一个复杂度因子，
由此产生的难度提升证实了该因子的可测量影响。

| 对 | 控制对                          | 基准 Case（难度）                    | 新增因子                    | 变体 Case（难度）                        |
|---:|---------------------------------|--------------------------------------|-----------------------------|------------------------------------------|
|  1 | 购物 → 跨环境购物               | watch-shop (E)                       | +A1（邮件集成）             | email-watch-shop (E)                     |
|  2 | 选座 → 选座失败                 | flight-seat-selection (E)            | +B1（约束失败）             | flight-seat-selection-failed (M)         |

控制对设计说明：
- **对 1** 验证 A1（跨服务依赖）：添加邮件集成意图提升难度，但两个任务当前均为 E；跨服务协调的结构复杂性仍然存在
- **对 2** 验证 B1（隐式目标解析）：为选座添加约束失败处理将难度从 E 提升至 M，证实自主回退推理在经验上增加了可测量的复杂性

> **覆盖缺口。** 试点 benchmark 尚无 A2（初始状态污染）或 B2（知识系统维护）的有效控制对。
> 曾评估三个候选对，但在经验重校准后（PR #25）已失去难度梯度：washer-shop→email-washer-change
>（A1, M→E）、vue-build-fix-single→chain（A2, M→E）、skill-creation→skill-dependency-fix
>（B2, H→M 倒置）。合成新的 A2 和 B2 隔离对需要新增专门设计的任务——参见
> [未来因子路线图](../../en/roadmap/future_factors.md#controlled-pair-expansion)。

---

## 5. 难度分布

| 难度 | 数量 | 占比   | Case 列表 |
|:----:|-----:|-------:|-----------|
| 简单 |    57 |  42.5% | （详见 registry；57 个简单 case） |
| 中等 |    45 |  33.6% | （详见 registry；45 个中等 case） |
| 困难 |    32 |  23.9% | （详见 registry；32 个困难 case） |

因子数量与难度关系：

| 难度 | 平均因子数 | 基准（0 因子） | 单因子 | 多因子 |
|:----:|:----------:|:--------------:|:------:|:------:|
| 简单 |       1.26 |             16 |       22 |      19 |
| 中等 |       1.40 |             11 |       12 |      22 |
| 困难 |       1.44 |             7 |       8 |      17 |

基于 deepseek-v4-pro 的 3-trial 平均通过率的经验重分类显示，简单 case 占比最大（42.5%）。简单 case 包含基准任务（28.1%）和带因子任务（71.9%），
中等 case 占比 33.6%，困难 case 集中在需要约束失败处理（B1）或特定挑战性环境（DevOps 中的 A2）的任务上。
