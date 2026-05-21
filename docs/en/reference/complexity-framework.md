# LiveClawBench Complexity Framework

This document is the single reference for task complexity annotations in LiveClawBench.
It covers factor definitions, the full 71-case annotation table (71 implemented),
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

## 1. 71-Case Factor Annotation Table

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

---

## 2. Factor Summary Statistics

| Factor | Description                    | Count | Percentage | Representative Cases                                          |
|--------|--------------------------------|------:|-----------:|---------------------------------------------------------------|
| A1     | Cross-Service Dependency       |    28 |      39.4% | flight-seat-selection, email-watch-shop, conflict-repair-acb, grocery-reorder, content-calendar-cross-publish |
| A2     | Contaminated Initial State     |    18 |      25.4% | blog-site-completion-from-starter, vue-build-fix-single, noise-filtering, morning-comfort-setup, social-schedule-audit |
| B1     | Implicit Goal Resolution       |    25 |      35.2% | flight-seat-selection-failed, flight-cancel-claim, baggage-tracking-application, smarthome-test, pre-meeting-research-brief |
| B2     | Knowledge System Maintenance   |    16 |      22.5% | skill-creation, skill-dependency-fix, noise-filtering, pre-meeting-research-brief |

> Percentages are relative to 71 implemented cases.

Factor combination distribution:

- No factors (baseline): 20 cases (28.2%) — email-writing, email-reply, flight-booking, blog-site-from-scratch, washer-shop, watch-shop, washer-change, info-change, mint-diet-snack-log, weather-aqi-report, social-media-posting, social-unlike-post, expense-draft-delete, insurance-deductible-selection, health-daily-record, nutrition-log-meal, mint-diet-comprehensive, weather-city-travel-pick, weather-outdoor-window, sticker-store-acquire
- Single factor: 24 cases (33.8%)
- Dual factor: 18 cases (25.4%) — flight-seat-selection-failed (A1+B1), flight-cancel-claim (A1+B1), flight-info-change-notice (A1+B1), noise-filtering (A2+B2), incremental-update-ctp (A2+B2), mixed-tool-memory (A1+B2), live-web-research-sqlite-fts5 (A1+B2), grocery-reorder (A1+B1), morning-comfort-setup (A2+B1), pre-meeting-research-brief (B1+B2), vendor-due-diligence-brief (A1+B1), social-keyword-cleanup (A1+B1), social-event-campaign (A1+B1), social-comment-moderation (A1+B1), social-cross-publish (A1+B1)
- Triple factor: 9 cases (12.7%) — conflict-repair-acb (A1+A2+B2), social-data-anomaly-report (A1+A2+B1), social-pinned-post-update (A1+A2+B1), medication-prescription-sync (A1+A2+B1), health-appointment-scheduling (A1+A2+B1), content-calendar-cross-publish (A1+A2+B1)
- **Multi-factor (≥2 factors): 27 cases (38.0%)**

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
| Finance & Data Analytics   |   4 |   5 |   6 |   4 |                      19 |

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
| Easy       |    31 |      43.7% | skill-conflict-resolution, skill-dependency-fix, email-writing, email-reply, flight-seat-selection, flight-info-change-notice, baggage-tracking-application, blog-site-from-scratch, blog-site-completion-from-starter, washer-shop, watch-shop, washer-change, info-change, email-washer-change, incremental-update-ctp, conflict-repair-acb, mixed-tool-memory, skill-combination, mint-diet-snack-log, weather-aqi-report, social-media-posting, social-unlike-post, expense-draft-delete, insurance-deductible-selection, health-daily-record, nutrition-log-meal, mint-diet-comprehensive, meeting-reschedule-response, candidate-interview-slot-confirm, finance-expense-log, finance-invoice-process |
| Medium     |    21 |      29.6% | skill-creation, skill-supplementation, skill-repository-curation, flight-booking, schedule-change-request, noise-filtering, live-web-research-sqlite-fts5, health-insurance-optimization, finance-monthly-close, smarthome-test, grocery-reorder, morning-comfort-setup, weather-city-travel-pick, pre-meeting-research-brief, vendor-due-diligence-brief, social-schedule-audit, social-keyword-cleanup, social-event-campaign, finance-anomaly-detect, finance-budget-alert, sticker-store-acquire |
| Hard       |    19 |      26.8% | flight-seat-selection-failed, flight-cancel-claim, email-watch-shop, vue-build-fix-single, vue-build-fix-chain, finance-portfolio-rebalancing, weather-outdoor-window, social-data-anomaly-report, social-comment-moderation, social-cross-publish, social-pinned-post-update, medication-prescription-sync, health-appointment-scheduling, content-calendar-cross-publish, finance-tax-prepare, finance-analysis-generate, finance-depreciation-audit, finance-dashboard-repair, chat-sticker-engagement |

Factor count vs difficulty:

| Difficulty | Avg Factor Count | Baseline (0 factors) | Single Factor | Multi-Factor |
|:----------:|:----------------:|:--------------------:|:-------------:|:------------:|
| Easy       |             0.61 |          16 |       11 |       4 |
| Medium     |             1.33 |           3 |       8 |       10 |
| Hard       |             1.63 |           1 |       5 |       13 |

The empirical reclassification (based on average solve rates across models) shows that Easy
cases dominate (47.5%). Easy cases include both baselines (55.2%) and factor-bearing tasks
(44.8%), indicating that many structural complexity factors do not pose significant difficulty
for current agents. Hard cases concentrate around tasks combining B1 with A1 or A2
(e.g. social-data-anomaly-report, social-pinned-post-update, medication-prescription-sync),
contaminated DevOps environments, and high-precision domain execution (finance-portfolio-rebalancing, weather-outdoor-window).
