# LiveClawBench Complexity Framework

This document is the single reference for task complexity annotations in LiveClawBench.
It covers factor definitions, the full 30-case annotation table (30 implemented),
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

## 1. 30-Case Factor Annotation Table

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

---

## 2. Factor Summary Statistics

| Factor | Description                    | Count | Percentage | Representative Cases                                          |
|--------|--------------------------------|------:|-----------:|---------------------------------------------------------------|
| A1     | Cross-Service Dependency       |    10 |      33.3% | flight-seat-selection, email-watch-shop, conflict-repair-acb  |
| A2     | Contaminated Initial State     |     6 |      20.0% | blog-site-completion-from-starter, vue-build-fix-single, noise-filtering |
| B1     | Implicit Goal Resolution       |     4 |      13.3% | flight-seat-selection-failed, flight-cancel-claim, flight-info-change-notice, baggage-tracking-application |
| B2     | Knowledge System Maintenance   |    11 |      36.7% | skill-creation, skill-dependency-fix, noise-filtering         |

> Percentages are relative to 30 implemented cases.

Factor combination distribution:

- No factors (baseline): 8 cases (26.7%) — email-writing, email-reply, flight-booking, blog-site-from-scratch, washer-shop, watch-shop, washer-change, info-change
- Single factor: 14 cases (46.7%)
- Dual factor: 7 cases (23.3%) — flight-seat-selection-failed (A1+B1), flight-cancel-claim (A1+B1), flight-info-change-notice (A1+B1), noise-filtering (A2+B2), incremental-update-ctp (A2+B2), mixed-tool-memory (A1+B2), live-web-research-sqlite-fts5 (A1+B2)
- Triple factor: 1 case (3.3%) — conflict-repair-acb (A1+A2+B2)
- **Multi-factor (≥2 factors): 8 cases (26.7%)**

---

## 3. Domain × Factor Heatmap

Factor occurrence frequency per primary domain:

| Primary Domain             | A1 | A2 | B1 | B2 | Total Factor Instances |
|----------------------------|----|----|----|----|-----------------------:|
| Documents & Knowledge      |  2 |  2 |  0 | 10 |                     14 |
| Communication & Email      |  0 |  0 |  0 |  0 |                      0 |
| E-commerce & Daily Svcs    |  5 |  0 |  2 |  0 |                      7 |
| Calendar & Task Mgmt       |  2 |  0 |  1 |  0 |                      3 |
| Coding & Software Dev      |  0 |  1 |  0 |  0 |                      1 |
| DevOps & Env Repair        |  0 |  2 |  0 |  0 |                      2 |
| Deep Research & Report     |  1 |  1 |  0 |  2 |                      4 |

Key observations:
- **B2 is highly concentrated in Documents & Knowledge** (10/11), reflecting the nature of knowledge management tasks
- **A1 is the most broadly distributed**, spanning 4 domains — cross-service coordination is a universal complexity source
- **B1 only appears in E-commerce and Calendar**, where tasks most naturally produce implicit goals
- **Communication & Email has no factors** — these cases serve as pure baselines

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
| Easy       |    18 |      60.0% | skill-conflict-resolution, skill-dependency-fix, skill-combination, email-writing, email-reply, flight-seat-selection, flight-info-change-notice, baggage-tracking-application, blog-site-from-scratch, blog-site-completion-from-starter, washer-shop, watch-shop, washer-change, info-change, email-washer-change, incremental-update-ctp, conflict-repair-acb, mixed-tool-memory |
| Medium     |     7 |      23.3% | skill-creation, skill-supplementation, skill-repository-curation, flight-booking, schedule-change-request, noise-filtering, live-web-research-sqlite-fts5 |
| Hard       |     5 |      16.7% | flight-seat-selection-failed, flight-cancel-claim, email-watch-shop, vue-build-fix-single, vue-build-fix-chain |

Factor count vs difficulty:

| Difficulty | Avg Factor Count | Baseline (0 factors) | Single Factor | Multi-Factor |
|:----------:|:----------------:|:--------------------:|:-------------:|:------------:|
| Easy       |             0.89 |          7           |       7       |       4      |
| Medium     |             1.14 |          1           |       4       |       2      |
| Hard       |             1.40 |          0           |       3       |       2      |

The empirical reclassification (based on average solve rates across models) shows that Easy
cases dominate (60%). Easy cases include both baselines (38.9%) and factor-bearing tasks
(61.1%), indicating that many structural complexity factors do not pose significant difficulty
for current agents. Hard cases are concentrated in tasks requiring constraint failure handling
(B1) or specific challenging environments (A2 in DevOps).
