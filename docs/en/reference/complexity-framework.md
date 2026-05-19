# LiveClawBench Complexity Framework

This document is the single reference for task complexity annotations in LiveClawBench.
It covers factor definitions, the full 35-case annotation table (35 implemented),
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

## 1. 35-Case Factor Annotation Table

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
|      31 | mint-diet-snack-log               |     E      |    |    |    |    | Health & Fitness           |
|      32 | weather-aqi-report                |     E      |    |    |    |    | Deep Research & Report     |
|      33 | social-media-posting              |     E      |    |    |    |    | Social Media               |
|      34 | social-unlike-post                |     E      |    |    |    |    | Social Media               |
|      35 | expense-draft-delete              |     E      |    |    |    |    | Finance & Data Analytics   |
|      36 | insurance-deductible-selection    |     E      |    |    |    |    | E-commerce & Daily Svcs    |
|      37 | health-insurance-optimization     |     M      | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      38 | health-daily-record               |     E      |    |    |    |    | Health & Fitness           |
|      39 | meeting-reschedule-response       |     E      | ✓  |    |    |    | Calendar & Task Mgmt       |
|      40 | candidate-interview-slot-confirm  |     E      | ✓  |    |    |    | Calendar & Task Mgmt       |
|      41 | medication-prescription-sync      |     H      | ✓  | ✓  | ✓  |    | Health & Fitness           |
|      42 | health-appointment-scheduling     |     H      | ✓  | ✓  | ✓  |    | Health & Fitness           |
|      43 | content-calendar-cross-publish    |     H      | ✓  | ✓  | ✓  |    | Calendar & Task Mgmt       |

---

## 2. Factor Summary Statistics

| Factor | Description                    | Count | Percentage | Representative Cases                                          |
|--------|--------------------------------|------:|-----------:|---------------------------------------------------------------|
| A1     | Cross-Service Dependency       |    16 |      37.2% | flight-seat-selection, email-watch-shop, conflict-repair-acb, health-insurance-optimization, meeting-reschedule-response, candidate-interview-slot-confirm, medication-prescription-sync, health-appointment-scheduling, content-calendar-cross-publish |
| A2     | Contaminated Initial State     |     9 |      20.9% | blog-site-completion-from-starter, vue-build-fix-single, noise-filtering, medication-prescription-sync, health-appointment-scheduling, content-calendar-cross-publish |
| B1     | Implicit Goal Resolution       |     7 |      16.3% | flight-seat-selection-failed, flight-cancel-claim, flight-info-change-notice, baggage-tracking-application, medication-prescription-sync, health-appointment-scheduling, content-calendar-cross-publish |
| B2     | Knowledge System Maintenance   |    11 |      25.6% | skill-creation, skill-dependency-fix, noise-filtering         |

> Percentages are relative to 43 implemented cases.

Factor combination distribution:

- No factors (baseline): 15 cases (34.9%) — email-writing, email-reply, flight-booking, blog-site-from-scratch, washer-shop, watch-shop, washer-change, info-change, mint-diet-snack-log, weather-aqi-report, social-media-posting, social-unlike-post, expense-draft-delete, insurance-deductible-selection, health-daily-record
- Single factor: 17 cases (39.5%)
- Dual factor: 7 cases (16.3%) — flight-seat-selection-failed (A1+B1), flight-cancel-claim (A1+B1), flight-info-change-notice (A1+B1), noise-filtering (A2+B2), incremental-update-ctp (A2+B2), mixed-tool-memory (A1+B2), live-web-research-sqlite-fts5 (A1+B2)
- Triple factor: 4 cases (9.3%) — conflict-repair-acb (A1+A2+B2), medication-prescription-sync (A1+A2+B1), health-appointment-scheduling (A1+A2+B1), content-calendar-cross-publish (A1+A2+B1)
- **Multi-factor (≥2 factors): 11 cases (25.6%)**

---

## 3. Domain × Factor Heatmap

Factor occurrence frequency per primary domain:

| Primary Domain             | A1 | A2 | B1 | B2 | Total Factor Instances |
|----------------------------|----|----|----|----|-----------------------:|
| Documents & Knowledge      |  2 |  2 |  0 | 10 |                     14 |
| Communication & Email      |  0 |  0 |  0 |  0 |                      0 |
| E-commerce & Daily Svcs    |  6 |  0 |  2 |  0 |                      9 |
| Calendar & Task Mgmt       |  5 |  1 |  1 |  0 |                      7 |
| Coding & Software Dev      |  0 |  1 |  0 |  0 |                      1 |
| DevOps & Env Repair        |  0 |  2 |  0 |  0 |                      2 |
| Deep Research & Report     |  1 |  1 |  0 |  2 |                      4 |
| Health & Fitness           |  2 |  2 |  2 |  0 |                      6 |
| Social Media               |  0 |  0 |  0 |  0 |                      0 |
| Finance & Data Analytics   |  0 |  0 |  0 |  0 |                      0 |

Key observations:
- **B2 is highly concentrated in Documents & Knowledge** (10/11), reflecting the nature of knowledge management tasks
- **A1 is the most broadly distributed**, spanning 5 domains — cross-service coordination is a universal complexity source
- **B1 appears in E-commerce, Calendar, and Health**, where tasks most naturally produce implicit goals
- **The A1+A2+B1 triple-factor combination is novel**, first appearing in medication-prescription-sync, health-appointment-scheduling, and content-calendar-cross-publish
- **Health & Fitness gains multi-factor coverage** through 3 new hard tasks with A1+A2+B1

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
| Easy       |    27 |      62.8% | skill-conflict-resolution, skill-dependency-fix, skill-combination, email-writing, email-reply, flight-seat-selection, flight-info-change-notice, baggage-tracking-application, blog-site-from-scratch, blog-site-completion-from-starter, washer-shop, watch-shop, washer-change, info-change, email-washer-change, incremental-update-ctp, conflict-repair-acb, mixed-tool-memory, mint-diet-snack-log, weather-aqi-report, social-media-posting, social-unlike-post, expense-draft-delete, insurance-deductible-selection, meeting-reschedule-response, candidate-interview-slot-confirm, health-daily-record |
| Medium     |     8 |      18.6% | skill-creation, skill-supplementation, skill-repository-curation, flight-booking, schedule-change-request, noise-filtering, live-web-research-sqlite-fts5, health-insurance-optimization |
| Hard       |     8 |      18.6% | flight-seat-selection-failed, flight-cancel-claim, email-watch-shop, vue-build-fix-single, vue-build-fix-chain, medication-prescription-sync, health-appointment-scheduling, content-calendar-cross-publish |

Factor count vs difficulty:

| Difficulty | Avg Factor Count | Baseline (0 factors) | Single Factor | Multi-Factor |
|:----------:|:----------------:|:--------------------:|:-------------:|:------------:|
| Easy       |             0.52 |          16          |       7       |       4      |
| Medium     |             1.12 |          1           |       5       |       2      |
| Hard       |             1.75 |          0           |       3       |       5      |

The empirical reclassification (based on average solve rates across models) shows that Easy
cases dominate (62.8%). Easy cases include both baselines (59.3%) and factor-bearing tasks
(40.7%), indicating that many structural complexity factors do not pose significant difficulty
for current agents. Hard cases are concentrated in tasks requiring constraint failure handling
(B1), specific challenging environments (A2 in DevOps), or the novel A1+A2+B1 triple-factor
combination introduced by medication-prescription-sync, health-appointment-scheduling, and
content-calendar-cross-publish.
