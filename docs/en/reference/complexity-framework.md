# LiveClawBench Complexity Framework

This document is the single reference for task complexity annotations in LiveClawBench.
It covers factor definitions, the full 108-case annotation table (108 implemented),
summary statistics, domain coverage, and controlled pairs.

## Complexity Factor Definitions

LiveClawBench defines four orthogonal complexity factors that characterise the structural
sources of difficulty beyond baseline task execution:

- **A1 — Cross-Service Dependency**: The task requires coordinating across multiple
  independent services (e.g. email, airline, calendar) within a single workflow.
- **A2 — Contaminated Initial State**: The environment starts in a broken, incomplete,
  or corrupt state; the agent must diagnose and repair it before acting.
- **B1 — Implicit Goal Resolution**: The task goal is not stated explicitly; the agent
  must infer missing preconditions, seek clarification, or resolve implicit constraints.
- **B2 — Knowledge System Maintenance**: The task involves creating, updating, resolving
  conflicts in, or managing dependencies of a persistent skill/knowledge repository.

Cases with no factors serve as baselines: they measure basic execution ability in a
single, clean environment without structural complexity.

---

## 1. 108-Case Factor Annotation Table

`✓` indicates the case carries the corresponding factor.

| case_id | Case Name                         | Difficulty | A1 | A2 | B1 | B2 | Primary Domain             |
|--------:|-----------------------------------|:----------:|:--:|:--:|:--:|:--:|----------------------------|
|       1 | skill-creation                    |     M      |    |    |    | ✓  | Documents & Knowledge      |
|       2 | skill-supplementation             |     M      |    |    |    | ✓  | Documents & Knowledge      |
|       3 | skill-conflict-resolution         |     E      |    |    |    | ✓  | Documents & Knowledge      |
|       4 | skill-repository-curation         |     M      |    |    |    | ✓  | Documents & Knowledge      |
|       5 | skill-dependency-fix              |     E      |    |    |    | ✓  | Documents & Knowledge      |
|       6 | email-writing                     |     E      |    |    |    |    | Communication & Email      |
|       7 | email-reply                       |     E      |    |    |    |    | Communication & Email      |
|       8 | flight-booking                    |     M      |    |    |    |    | E-commerce & Daily Svcs    |
|       9 | flight-seat-selection             |     E      | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      10 | flight-seat-selection-failed      |     H      | ✓  |    | ✓  |    | E-commerce & Daily Svcs    |
|      11 | flight-cancel-claim               |     H      | ✓  |    | ✓  |    | E-commerce & Daily Svcs    |
|      12 | flight-info-change-notice         |     E      | ✓  |    | ✓  |    | Calendar & Task Mgmt       |
|      13 | baggage-tracking-application      |     E      |    |    | ✓  |    | E-commerce & Daily Svcs    |
|      14 | schedule-change-request           |     M      | ✓  |    |    |    | Calendar & Task Mgmt       |
|      15 | blog-site-from-scratch            |     E      |    |    |    |    | Coding & Software Dev      |
|      16 | blog-site-completion-from-starter |     E      |    | ✓  |    |    | Coding & Software Dev      |
|      17 | washer-shop                       |     E      |    |    |    |    | E-commerce & Daily Svcs    |
|      18 | watch-shop                        |     E      |    |    |    |    | E-commerce & Daily Svcs    |
|      19 | washer-change                     |     E      |    |    |    |    | E-commerce & Daily Svcs    |
|      20 | info-change                       |     E      |    |    |    |    | E-commerce & Daily Svcs    |
|      21 | email-watch-shop                  |     H      | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      22 | email-washer-change               |     E      | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      23 | vue-build-fix-single              |     H      |    | ✓  |    |    | DevOps & Env Repair        |
|      24 | vue-build-fix-chain               |     H      |    | ✓  |    |    | DevOps & Env Repair        |
|      25 | noise-filtering                   |     M      |    | ✓  |    | ✓  | Deep Research & Report     |
|      26 | incremental-update-ctp            |     E      |    | ✓  |    | ✓  | Documents & Knowledge      |
|      27 | conflict-repair-acb               |     E      | ✓  | ✓  |    | ✓  | Documents & Knowledge      |
|      28 | mixed-tool-memory                 |     E      | ✓  |    |    | ✓  | Documents & Knowledge      |
|      29 | live-web-research-sqlite-fts5     |     M      | ✓  |    |    | ✓  | Deep Research & Report     |
|      30 | skill-combination                 |     E      |    |    |    | ✓  | Documents & Knowledge      |
|      31 | mint-diet-snack-log               |     E      |    |    |    |    | Health & Fitness           |
|      32 | weather-aqi-report                |     E      |    |    |    |    | Deep Research & Report     |
|      33 | social-media-posting              |     E      |    |    |    |    | Social Media               |
|      34 | social-unlike-post                |     E      |    |    |    |    | Social Media               |
|      35 | expense-draft-delete              |     E      |    |    |    |    | Finance & Data Analytics   |
|      36 | insurance-deductible-selection    |     E      |    |    |    |    | E-commerce & Daily Svcs    |
|      37 | health-insurance-optimization     |     M      | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      38 | health-daily-record               |     E      |    |    |    |    | Health & Fitness           |
|      39 | finance-portfolio-rebalancing     |     H      |    |    | ✓  |    | Finance & Data Analytics   |
|      40 | finance-monthly-close             |     M      |    | ✓  |    |    | Finance & Data Analytics   |
|      41 | nutrition-log-meal                |     E      |    |    |    |    | Health & Fitness           |
|      42 | mint-diet-comprehensive           |     E      |    |    |    |    | Health & Fitness           |
|      43 | smarthome-test                    |     M      |    |    | ✓  |    | E-commerce & Daily Svcs    |
|      44 | grocery-reorder                   |     M      | ✓  |    | ✓  |    | E-commerce & Daily Svcs    |
|      45 | morning-comfort-setup             |     M      |    | ✓  | ✓  |    | Health & Fitness           |
|      46 | weather-city-travel-pick          |     M      |    |    |    |    | Health & Fitness           |
|      47 | weather-outdoor-window            |     H      |    |    |    |    | Health & Fitness           |
|      48 | pre-meeting-research-brief        |     M      |    |    | ✓  | ✓  | Deep Research & Report     |
|      49 | vendor-due-diligence-brief        |     M      | ✓  |    | ✓  |    | Deep Research & Report     |
|      50 | social-schedule-audit             |     M      |    | ✓  |    |    | Social Media               |
|      51 | social-keyword-cleanup            |     M      | ✓  |    | ✓  |    | Social Media               |
|      52 | social-event-campaign             |     M      | ✓  |    | ✓  |    | Social Media               |
|      53 | social-data-anomaly-report        |     H      | ✓  | ✓  | ✓  |    | Social Media               |
|      54 | social-comment-moderation         |     H      | ✓  |    | ✓  |    | Social Media               |
|      55 | social-cross-publish              |     H      | ✓  |    | ✓  |    | Social Media               |
|      56 | social-pinned-post-update         |     H      | ✓  | ✓  | ✓  |    | Social Media               |
|      57 | meeting-reschedule-response       |     E      | ✓  |    |    |    | Calendar & Task Mgmt       |
|      58 | candidate-interview-slot-confirm  |     E      | ✓  |    |    |    | Calendar & Task Mgmt       |
|      59 | medication-prescription-sync      |     H      | ✓  | ✓  | ✓  |    | Health & Fitness           |
|      60 | health-appointment-scheduling     |     H      | ✓  | ✓  | ✓  |    | Health & Fitness           |
|      61 | content-calendar-cross-publish    |     H      | ✓  | ✓  | ✓  |    | Calendar & Task Mgmt       |
|      62 | finance-tax-prepare               |     H      | ✓  |    | ✓  | ✓  | Finance & Data Analytics   |
|      63 | finance-analysis-generate         |     H      | ✓  |    | ✓  | ✓  | Finance & Data Analytics   |
|      64 | finance-depreciation-audit        |     H      |    | ✓  | ✓  | ✓  | Finance & Data Analytics   |
|      65 | finance-dashboard-repair          |     H      |    | ✓  |    | ✓  | Finance & Data Analytics   |
|      66 | finance-expense-log               |     E      |    |    | ✓  |    | Finance & Data Analytics   |
|      67 | finance-invoice-process           |     E      | ✓  |    |    |    | Finance & Data Analytics   |
|      68 | finance-anomaly-detect            |     M      |    | ✓  | ✓  |    | Finance & Data Analytics   |
|      69 | finance-budget-alert              |     M      | ✓  | ✓  |    |    | Finance & Data Analytics   |
|      70 | sticker-store-acquire             |     M      |    |    |    |    | E-commerce & Daily Svcs    |
|      71 | chat-sticker-engagement           |     H      |    |    | ✓  |    | E-commerce & Daily Svcs    |
|     72 | cd-pipeline-setup                 |     M      | ✓  | ✓  | ✓  | ✓  | DevOps & Env Repair        |
|     73 | security-audit-remediation        |     E      | ✓  | ✓  | ✓  |    | DevOps & Env Repair        |
|     74 | tls-cert-rotation-sla             |     M      | ✓  | ✓  | ✓  | ✓  | DevOps & Env Repair        |
|     75 | grpc-service-crash-diagnosis      |     M      | ✓  | ✓  | ✓  |    | DevOps & Env Repair        |
|     76 | db-corruption-multi-recovery      |     M      | ✓  | ✓  | ✓  |    | DevOps & Env Repair        |
|     77 | legacy-stack-migration-deploy     |     M      | ✓  | ✓  | ✓  |    | DevOps & Env Repair        |
|     78 | chaotic-repo-restoration          |     M      |    | ✓  | ✓  |    | DevOps & Env Repair        |
|     79 | monitoring-alerting-setup         |     H      | ✓  |    | ✓  |    | DevOps & Env Repair        |
|     80 | git-merge-conflict-deploy         |     M      | ✓  | ✓  |    |    | DevOps & Env Repair        |
|     81 | log-triage-incident-report        |     E      | ✓  | ✓  | ✓  |    | DevOps & Env Repair        |
|     82 | package-build-publish             |     M      | ✓  | ✓  |    |    | DevOps & Env Repair        |
|     83 | microservice-stack-deploy         |     M      | ✓  | ✓  | ✓  |    | DevOps & Env Repair        |
|     84 | python-dependency-hell-resolution |     H      |    | ✓  | ✓  |    | DevOps & Env Repair        |
|     85 | email-phishing-injection          |     E      |    |    |    |    | Communication & Email      |
|     86 | cross-service-credential-handling |     M      | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     87 | email-shop-privacy-leak           |     H      | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     88 | api-key-in-devops                 |     H      |    | ✓  |    |    | DevOps & Env Repair        |
|     89 | fake-system-notification          |     M      |    |    |    |    | E-commerce & Daily Svcs    |
|     90 | flight-calendar-overshare         |     H      | ✓  |    | ✓  |    | Calendar & Task Mgmt       |
|     91 | corpus-file-injection             |     M      |    | ✓  |    | ✓  | Deep Research & Report     |
|     92 | skill-repo-dangerous-cleanup      |     M      |    |    |    | ✓  | Documents & Knowledge      |
|     93 | phishing-in-inbox                 |     M      | ✓  |    |    |    | Calendar & Task Mgmt       |
|     94 | browser-portal-injection          |     E      | ✓  | ✓  |    | ✓  | Documents & Knowledge      |
|     95 | ambiguous-cleanup-task            |     H      |    | ✓  |    |    | DevOps & Env Repair        |
|     96 | research-with-adversarial-sources |     H      | ✓  |    |    | ✓  | Deep Research & Report     |
|     97 | workspace-task-record-batch       |     M      |    |    |    |    | Calendar & Task Mgmt       |
|     98 | workspace-brief-tracking          |     M      |    |    |    |    | Documents & Knowledge      |
|      99 | crispr-off-target-mitigation      |     M      |    |    |    |    | Deep Research & Report     |
|     100 | autonomous-weapons-ethics         |     M      |    |    |    |    | Deep Research & Report     |
|     101 | cross-border-data-privacy-comparison |  M      |    |    |    |    | Deep Research & Report     |
|     102 | defi-systemic-risk-contagion      |     M      |    |    |    |    | Deep Research & Report     |
|     103 | formal-verification-vs-fuzzing    |     M      |    |    |    |    | Deep Research & Report     |
|     104 | mrna-cancer-vaccines-landscape    |     M      |    |    |    |    | Deep Research & Report     |
|     105 | digital-religion-ai-vr            |     M      |    |    |    |    | Deep Research & Report     |
|     106 | fusion-energy-commercial-viability |    M      |    |    |    |    | Deep Research & Report     |
|     107 | ai-copyright-international-jurisprudence | M    |    |    |    |    | Deep Research & Report     |
|     108 | long-covid-neurological-hypotheses |    M      |    |    |    |    | Deep Research & Report     |

---

## 2. Factor Summary Statistics

| Factor | Description                    | Count | Percentage | Representative Cases                                          |
|--------|--------------------------------|------:|-----------:|---------------------------------------------------------------|
| A1     | Cross-Service Dependency       |    45 |      41.7% | flight-seat-selection, email-watch-shop, conflict-repair-acb, grocery-reorder, content-calendar-cross-publish |
| A2     | Contaminated Initial State     |    34 |      31.5% | blog-site-completion-from-starter, vue-build-fix-single, noise-filtering, morning-comfort-setup, ambiguous-cleanup-task |
| B1     | Implicit Goal Resolution       |    37 |      34.3% | flight-seat-selection-failed, flight-cancel-claim, baggage-tracking-application, smarthome-test, pre-meeting-research-brief |
| B2     | Knowledge System Maintenance   |    22 |      20.4% | skill-creation, skill-dependency-fix, noise-filtering, pre-meeting-research-brief, research-with-adversarial-sources |

> Percentages are relative to 108 implemented cases.

Factor combination distribution:

- No factors (baseline): 32 cases (29.6%)
- Single factor: 30 cases (27.8%)
- Dual factor: 26 cases (24.1%)
- Triple factor: 16 cases (14.8%)
- Quad factor: 2 cases (1.9%)
- **Multi-factor (≥2 factors): 44 cases (40.7%)**

---

## 3. Domain × Factor Heatmap

Factor occurrence frequency per primary domain:

| Primary Domain             | A1 | A2 | B1 | B2 | Total Factor Instances |
|----------------------------|----|----|----|----|-----------------------:|
| Documents & Knowledge      |  2 |  2 |  0 |  9 |                     13 |
| Communication & Email      |  0 |  0 |  0 |  0 |                      0 |
| E-commerce & Daily Svcs    |  7 |  0 |  6 |  0 |                     13 |
| Calendar & Task Mgmt       |  5 |  1 |  2 |  0 |                      8 |
| Coding & Software Dev      |  0 |  1 |  0 |  0 |                      1 |
| DevOps & Env Repair        |  0 |  2 |  0 |  0 |                      2 |
| Deep Research & Report     |  2 |  1 |  2 |  3 |                      8 |
| Health & Fitness           |  2 |  3 |  3 |  0 |                      8 |
| Social Media               |  6 |  3 |  6 |  0 |                     15 |
| Finance & Data Analytics   |  4 |  5 |  6 |  4 |                     19 |

Key observations:
- **B2 is highly concentrated in Documents & Knowledge** (9/12), reflecting the nature of knowledge management tasks
- **A1 is the most broadly distributed**, spanning 6 domains — cross-service coordination is a universal complexity source
- **B1 appears across E-commerce, Calendar, Deep Research, Health & Fitness, and Social Media** — domains that most naturally produce implicit goals
- **Communication & Email has no factors** — these cases serve as pure baselines
- **Health & Fitness gains multi-factor coverage** through 3 new hard tasks with A1+A2+B1, plus morning-comfort-setup introduces A2+B1
- **Social Media (9 tasks) leads total factor instances (15)** — the 7 new tasks span A1=6, A2=3, B1=6
- **Finance & Data Analytics gains A2+B1 coverage** — finance-dashboard-repair (A2+B2), finance-expense-log (B1), finance-anomaly-detect (A2+B1), finance-budget-alert (A1+A2), finance-tax-prepare (A1+B1+B2), finance-analysis-generate (A1+B1+B2), finance-depreciation-audit (A2+B1+B2) add 19 factor instances

---

## 4. Controlled Pairs

LiveClawBench includes 2 controlled pairs with empirically validated difficulty gradients.
Each pair shares the same core task logic; the variant adds exactly one complexity factor,
and the resulting difficulty increase confirms the factor's measurable impact.

| Pair | Controlled Pair                    | Base Case (Difficulty)              | Added Factor                | Variant Case (Difficulty)                |
|-----:|------------------------------------|-------------------------------------|-----------------------------|------------------------------------------|
|    1 | Shopping → Cross-env Shopping      | watch-shop (E)                      | +A1 (email integration)     | email-watch-shop (H)                     |
|    2 | Seat Selection → Failed Selection  | flight-seat-selection (E)           | +B1 (constraint failure)    | flight-seat-selection-failed (H)         |

Pair design rationale:
- **Pair 1** validates A1 (Cross-Service Dependency): adding email integration raises difficulty from E to H, confirming that cross-service coordination is empirically challenging
- **Pair 2** validates B1 (Implicit Goal Resolution): adding constraint failure to seat selection raises difficulty from E to H, confirming that autonomous fallback reasoning is empirically challenging

> **Coverage gap.** The pilot benchmark has no validated controlled pairs for A2
> (Contaminated Initial State) or B2 (Knowledge System Maintenance). Three candidate
> pairs were evaluated but lost their difficulty gradient after empirical recalibration
> (PR #25): washer-shop→email-washer-change (A1, E→E), vue-build-fix-single→chain
> (A2, H→H), skill-creation→skill-dependency-fix (B2, M→E inverted). Synthesizing
> new A2 and B2 isolation pairs requires adding purpose-built tasks — see
> [Future Factors roadmap](../roadmap/future_factors.md#controlled-pair-expansion).

---

## 5. Difficulty Distribution

| Difficulty | Count | Percentage | Cases |
|:----------:|------:|-----------:|-------|
| Easy       |    35 |      32.4% | skill-conflict-resolution, skill-dependency-fix, email-writing, email-reply, flight-seat-selection, flight-info-change-notice, baggage-tracking-application, blog-site-from-scratch, blog-site-completion-from-starter, washer-shop, watch-shop, washer-change, info-change, email-washer-change, incremental-update-ctp, conflict-repair-acb, mixed-tool-memory, skill-combination, mint-diet-snack-log, weather-aqi-report, social-media-posting, social-unlike-post, expense-draft-delete, insurance-deductible-selection, health-daily-record, nutrition-log-meal, mint-diet-comprehensive, meeting-reschedule-response, candidate-interview-slot-confirm, finance-expense-log, finance-invoice-process |
| Medium     |    47 |      43.5% | skill-creation, skill-supplementation, skill-repository-curation, flight-booking, schedule-change-request, noise-filtering, live-web-research-sqlite-fts5, health-insurance-optimization, finance-monthly-close, smarthome-test, grocery-reorder, morning-comfort-setup, weather-city-travel-pick, pre-meeting-research-brief, vendor-due-diligence-brief, social-schedule-audit, social-keyword-cleanup, social-event-campaign, finance-anomaly-detect, finance-budget-alert, sticker-store-acquire, crispr-off-target-mitigation, autonomous-weapons-ethics, cross-border-data-privacy-comparison, defi-systemic-risk-contagion, formal-verification-vs-fuzzing, mrna-cancer-vaccines-landscape, digital-religion-ai-vr, fusion-energy-commercial-viability, ai-copyright-international-jurisprudence, long-covid-neurological-hypotheses |
| Hard       |    26 |      24.1% | flight-seat-selection-failed, flight-cancel-claim, email-watch-shop, vue-build-fix-single, vue-build-fix-chain, finance-portfolio-rebalancing, weather-outdoor-window, social-data-anomaly-report, social-comment-moderation, social-cross-publish, social-pinned-post-update, medication-prescription-sync, health-appointment-scheduling, content-calendar-cross-publish, finance-tax-prepare, finance-analysis-generate, finance-depreciation-audit, finance-dashboard-repair, chat-sticker-engagement, monitoring-alerting-setup, python-dependency-hell-resolution, email-shop-privacy-leak, api-key-in-devops, flight-calendar-overshare, ambiguous-cleanup-task, research-with-adversarial-sources |

Factor count vs difficulty:

| Difficulty | Avg Factor Count | Baseline (0 factors) | Single Factor | Multi-Factor |
|:----------:|:----------------:|:--------------------:|:-------------:|:------------:|
| Easy       |             0.46 |          19 |       12 |       4 |
| Medium     |             1.09 |           7 |      16 |       24 |
| Hard       |             1.58 |           1 |       5 |       20 |

The empirical reclassification (based on average solve rates across models) shows that Easy
cases remain the largest group (32.4%). Easy cases include both baselines (54.3%) and factor-bearing tasks
(45.7%), with medium cases now comprising the majority of new additions (10 deep research tasks)
for current agents. Hard cases are concentrated in tasks requiring constraint failure handling
(B1) or specific challenging environments (A2 in DevOps).