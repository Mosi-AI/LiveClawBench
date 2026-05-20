# LiveClawBench Complexity Framework

This document is the single reference for task complexity annotations in LiveClawBench.
It covers factor definitions, the full 57-case annotation table (57 implemented),
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

## 1. 57-Case Factor Annotation Table

`✓` indicates the case carries the corresponding factor.

| case_id | Case Name                         | Difficulty | A1 | A2 | B1 | B2 | Primary Domain             |
|--------:|-----------------------------------|:----------:|:--:|:--:|:--:|:--:|----------------------------|
|       1 | skill-creation                    |     M      |    |    |    | ✓  | Documents & Knowledge      |
|       2 | skill-supplementation             |     M      |    |    |    | ✓  | Documents & Knowledge      |
|       3 | skill-conflict-resolution         |     E      |    |    |    | ✓  | Documents & Knowledge      |
|       4 | skill-repository-curation         |     M      |    |    |    | ✓  | Documents & Knowledge      |
|       5 | skill-dependency-fix              |     E      |    |    |    | ✓  | Documents & Knowledge      |
|      30 | skill-combination                 |     E      |    |    |    | ✓  | Documents & Knowledge      |
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
|      31 | mint-diet-snack-log               |     E      |    |    |    |    | Health & Wellness          |
|      32 | weather-aqi-report                |     E      |    |    |    |    | Deep Research & Report     |
|      33 | social-media-posting              |     E      |    |    |    |    | Social Media               |
|      34 | social-unlike-post                |     E      |    |    |    |    | Social Media               |
|      35 | expense-draft-delete              |     E      |    |    |    |    | Finance & Data Analytics   |
|      36 | insurance-deductible-selection    |     E      |    |    |    |    | E-commerce & Daily Svcs    |
|      37 | health-insurance-optimization     |     M      | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      38 | health-daily-record               |     E      |    |    |    |    | Health & Wellness          |
|      39 | finance-portfolio-rebalancing     |     H      |    |    | ✓  |    | Finance & Data Analytics   |
|      40 | finance-monthly-close             |     M      |    | ✓  |    |    | Finance & Data Analytics   |
|      41 | nutrition-log-meal                |     E      |    |    |    |    | Health & Wellness          |
|      42 | mint-diet-comprehensive           |     E      |    |    |    |    | Health & Wellness          |
|      43 | smarthome-test                    |     M      |    |    | ✓  |    | E-commerce & Daily Svcs    |
|      44 | grocery-reorder                   |     M      | ✓  |    | ✓  |    | E-commerce & Daily Svcs    |
|      45 | morning-comfort-setup             |     M      |    | ✓  | ✓  |    | Health & Fitness           |
|      46 | weather-city-travel-pick          |     M      |    |    |    |    | Health & Wellness          |
|      47 | weather-outdoor-window            |     H      |    |    |    |    | Health & Wellness          |
|      48 | pre-meeting-research-brief        |     M      |    |    | ✓  | ✓  | Deep Research & Report     |
|      49 | vendor-due-diligence-brief        |     M      | ✓  |    | ✓  |    | Deep Research & Report     |
|      50 | finance-expense-log               |     E      |    |    | ✓  |    | Finance & Data Analytics   |
|      51 | finance-invoice-process           |     E      | ✓  |    |    |    | Finance & Data Analytics   |
|      52 | finance-anomaly-detect            |     M      |    | ✓  | ✓  |    | Finance & Data Analytics   |
|      53 | finance-budget-alert              |     M      | ✓  | ✓  |    |    | Finance & Data Analytics   |
|      54 | finance-tax-prepare               |     H      | ✓  |    | ✓  | ✓  | Finance & Data Analytics   |
|      55 | finance-analysis-generate         |     H      | ✓  |    | ✓  | ✓  | Finance & Data Analytics   |
|      56 | finance-depreciation-audit        |     H      |    | ✓  | ✓  | ✓  | Finance & Data Analytics   |
|      57 | finance-dashboard-repair          |     H      |    | ✓  |    | ✓  | Finance & Data Analytics   |

---

## 2. Factor Summary Statistics

| Factor | Description                    | Count | Percentage | Representative Cases                                          |
|--------|--------------------------------|------:|-----------:|---------------------------------------------------------------|
| A1     | Cross-Service Dependency       |    17 |      29.8% | flight-seat-selection, email-watch-shop, conflict-repair-acb, health-insurance-optimization, grocery-reorder, vendor-due-diligence-brief, finance-invoice-process, finance-budget-alert |
| A2     | Contaminated Initial State     |    12 |      21.1% | blog-site-completion-from-starter, vue-build-fix-single, noise-filtering, finance-monthly-close, morning-comfort-setup, finance-anomaly-detect, finance-depreciation-audit |
| B1     | Implicit Goal Resolution       |    16 |      28.1% | flight-seat-selection-failed, flight-cancel-claim, flight-info-change-notice, baggage-tracking-application, smarthome-test, pre-meeting-research-brief, vendor-due-diligence-brief, finance-portfolio-rebalancing, finance-expense-log |
| B2     | Knowledge System Maintenance   |    16 |      28.1% | skill-creation, skill-dependency-fix, noise-filtering, pre-meeting-research-brief, finance-tax-prepare, finance-depreciation-audit |

> Percentages are relative to 57 implemented cases.

Factor combination distribution:

- No factors (baseline): 19 cases (33.3%) — email-writing, email-reply, flight-booking, blog-site-from-scratch, washer-shop, watch-shop, washer-change, info-change, mint-diet-snack-log, weather-aqi-report, social-media-posting, social-unlike-post, expense-draft-delete, insurance-deductible-selection, nutrition-log-meal, mint-diet-comprehensive, weather-city-travel-pick, weather-outdoor-window
- Single factor: 20 cases (35.1%) — includes finance-expense-log (B1), finance-invoice-process (A1), finance-portfolio-rebalancing (B1), finance-monthly-close (A2), smarthome-test (B1)
- Dual factor: 15 cases (26.3%) — flight-seat-selection-failed (A1+B1), flight-cancel-claim (A1+B1), flight-info-change-notice (A1+B1), noise-filtering (A2+B2), incremental-update-ctp (A2+B2), mixed-tool-memory (A1+B2), live-web-research-sqlite-fts5 (A1+B2), finance-anomaly-detect (A2+B1), finance-budget-alert (A1+A2), finance-dashboard-repair (A2+B2), grocery-reorder (A1+B1), morning-comfort-setup (A2+B1), vendor-due-diligence-brief (A1+B1), pre-meeting-research-brief (B1+B2)
- Triple factor: 4 cases (7.0%) — conflict-repair-acb (A1+A2+B2), finance-tax-prepare (A1+B1+B2), finance-analysis-generate (A1+B1+B2), finance-depreciation-audit (A2+B1+B2)
- **Multi-factor (≥2 factors): 19 cases (33.3%)**
- **Total factor instances: 61 across 38 factor-bearing cases**

---

## 3. Domain × Factor Heatmap

Factor occurrence frequency per primary domain:

| Primary Domain             | A1 | A2 | B1 | B2 | Total Factor Instances |
|----------------------------|----|----|----|----|-----------------------:|
| Documents & Knowledge      |  2 |  2 |  0 |  9 |                     13 |
| Communication & Email      |  0 |  0 |  0 |  0 |                      0 |
| E-commerce & Daily Svcs    |  7 |  0 |  6 |  0 |                     13 |
| Calendar & Task Mgmt       |  2 |  0 |  1 |  0 |                      3 |
| Coding & Software Dev      |  0 |  1 |  0 |  0 |                      1 |
| DevOps & Env Repair        |  0 |  2 |  0 |  0 |                      2 |
| Deep Research & Report     |  2 |  1 |  2 |  3 |                      8 |
| Health & Fitness           |  0 |  1 |  1 |  0 |                      2 |
| Social Media               |  0 |  0 |  0 |  0 |                      0 |
| Finance & Data Analytics   |  4 |  5 |  6 |  4 |                     19 |
| Health & Wellness          |  0 |  0 |  0 |  0 |                      0 |

Key observations:
- **B2 is highly concentrated in Documents & Knowledge** (9/16), reflecting the nature of knowledge management tasks
- **A1 is the most broadly distributed**, spanning 5 domains — cross-service coordination is a universal complexity source
- **B1 appears across E-commerce, Calendar, Health & Fitness, Deep Research, and Finance**, where tasks most naturally produce implicit goals
- **Communication & Email has no factors** — these cases serve as pure baselines
- **Social Media has no factors** — the two social tasks serve as domain baselines
- **Finance & Data Analytics has rich factor coverage** (A1=4, A2=5, B1=6, B2=4) — all four factors are exercised through finance-expense-log (B1), finance-invoice-process (A1), finance-portfolio-rebalancing (B1), finance-monthly-close (A2), finance-budget-alert (A1+A2), finance-anomaly-detect (A2+B1), finance-tax-prepare (A1+B1+B2), finance-analysis-generate (A1+B1+B2), finance-depreciation-audit (A2+B1+B2), and finance-dashboard-repair (A2+B2)
- **Health & Wellness has no factors** — nutrition-log-meal, mint-diet-comprehensive, weather-city-travel-pick, and weather-outdoor-window serve as domain baselines

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
| Easy       |    29 |      50.9% | skill-conflict-resolution, skill-dependency-fix, skill-combination, email-writing, email-reply, flight-seat-selection, flight-info-change-notice, baggage-tracking-application, blog-site-from-scratch, blog-site-completion-from-starter, washer-shop, watch-shop, washer-change, info-change, email-washer-change, incremental-update-ctp, conflict-repair-acb, mixed-tool-memory, mint-diet-snack-log, weather-aqi-report, social-media-posting, social-unlike-post, expense-draft-delete, insurance-deductible-selection, health-daily-record, nutrition-log-meal, mint-diet-comprehensive, finance-expense-log, finance-invoice-process |
| Medium     |    17 |      29.8% | skill-creation, skill-supplementation, skill-repository-curation, flight-booking, schedule-change-request, noise-filtering, live-web-research-sqlite-fts5, health-insurance-optimization, smarthome-test, grocery-reorder, morning-comfort-setup, weather-city-travel-pick, pre-meeting-research-brief, vendor-due-diligence-brief, finance-monthly-close, finance-anomaly-detect, finance-budget-alert |
| Hard       |    11 |      19.3% | flight-seat-selection-failed, flight-cancel-claim, email-watch-shop, vue-build-fix-single, vue-build-fix-chain, weather-outdoor-window, finance-portfolio-rebalancing, finance-tax-prepare, finance-analysis-generate, finance-depreciation-audit, finance-dashboard-repair |

Factor count vs difficulty:

| Difficulty | Avg Factor Count | Baseline (0 factors) | Single Factor | Multi-Factor |
|:----------:|:----------------:|:--------------------:|:-------------:|:------------:|
| Easy       |             0.62 |          16          |       9       |       4      |
| Medium     |             1.35 |           2          |       7       |       8      |
| Hard       |             1.73 |           1          |       4       |       6      |

The empirical reclassification (based on average solve rates across models) shows that Easy
cases dominate (64.9%). Easy cases include both baselines (54.2%) and factor-bearing tasks
(45.8%), indicating that many structural complexity factors do not pose significant difficulty
for current agents. Hard cases are concentrated in tasks requiring constraint failure handling
(B1) or specific challenging environments (A2 in DevOps).
