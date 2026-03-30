# LiveClawBench Complexity Framework

This document is the single reference for task complexity annotations in LiveClawBench.
It covers factor definitions, the full 30-case annotation table (29 implemented + 1 planned),
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

`✓` indicates the case carries the corresponding factor. Cases marked *(planned)* are under development.

| case_id | Case Name                         | Difficulty | A1 | A2 | B1 | B2 | Primary Domain             |
|--------:|-----------------------------------|:----------:|:--:|:--:|:--:|:--:|----------------------------|
|       1 | skill-creation                    |     E      |    |    |    | ✓  | Documents & Knowledge      |
|       2 | skill-supplementation             |     E      |    |    |    | ✓  | Documents & Knowledge      |
|       3 | skill-conflict-resolution         |     M      |    |    |    | ✓  | Documents & Knowledge      |
|       4 | skill-repository-curation         |     H      |    |    |    | ✓  | Documents & Knowledge      |
|       5 | skill-dependency-fix              |     H      |    |    |    | ✓  | Documents & Knowledge      |
|      30 | skill-combination *(planned)*     |     M      |    |    |    | ✓  | Documents & Knowledge      |
|       6 | email-writing                     |     E      |    |    |    |    | Communication & Email      |
|       7 | email-reply                       |     E      |    |    |    |    | Communication & Email      |
|       8 | flight-booking                    |     E      |    |    |    |    | E-commerce & Daily Svcs    |
|       9 | flight-seat-selection             |     M      | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      10 | flight-seat-selection-failed      |     H      | ✓  |    | ✓  |    | E-commerce & Daily Svcs    |
|      11 | flight-cancel-claim               |     H      | ✓  |    | ✓  |    | E-commerce & Daily Svcs    |
|      12 | flight-info-change-notice         |     H      | ✓  |    | ✓  |    | Calendar & Task Mgmt       |
|      13 | baggage-tracking-application      |     M      |    |    | ✓  |    | E-commerce & Daily Svcs    |
|      14 | schedule-change-request           |     H      | ✓  |    |    |    | Calendar & Task Mgmt       |
|      15 | blog-site-from-scratch            |     H      |    |    |    |    | Coding & Software Dev      |
|      16 | blog-site-completion-from-starter |     M      |    | ✓  |    |    | Coding & Software Dev      |
|      17 | washer-shop                       |     E      |    |    |    |    | E-commerce & Daily Svcs    |
|      18 | watch-shop                        |     E      |    |    |    |    | E-commerce & Daily Svcs    |
|      19 | washer-change                     |     E      |    |    |    |    | E-commerce & Daily Svcs    |
|      20 | info-change                       |     E      |    |    |    |    | E-commerce & Daily Svcs    |
|      21 | email-watch-shop                  |     M      | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      22 | email-washer-change               |     M      | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      23 | vue-project-build-bug-fix-easy    |     E      |    | ✓  |    |    | DevOps & Env Repair        |
|      24 | vue-project-build-bug-fix-hard    |     H      |    | ✓  |    |    | DevOps & Env Repair        |
|      25 | noise-filtering                   |     M      |    | ✓  |    | ✓  | Deep Research & Report     |
|      26 | incremental-update-ctp            |     M      |    | ✓  |    | ✓  | Documents & Knowledge      |
|      27 | conflict-repair-acb               |     M      | ✓  | ✓  |    | ✓  | Documents & Knowledge      |
|      28 | mixed-tool-memory                 |     H      | ✓  |    |    | ✓  | Documents & Knowledge      |
|      29 | live-web-research-sqlite-fts5     |     H      | ✓  |    |    | ✓  | Deep Research & Report     |

---

## 2. Factor Summary Statistics

| Factor | Description                    | Count | Percentage | Representative Cases                                          |
|--------|--------------------------------|------:|-----------:|---------------------------------------------------------------|
| A1     | Cross-Service Dependency       |    10 |      33.3% | flight-seat-selection, email-watch-shop, conflict-repair-acb  |
| A2     | Contaminated Initial State     |     6 |      20.0% | blog-site-completion-from-starter, vue-project-build-bug-fix-easy, noise-filtering |
| B1     | Implicit Goal Resolution       |     4 |      13.3% | flight-seat-selection-failed, flight-cancel-claim, flight-info-change-notice, baggage-tracking-application |
| B2     | Knowledge System Maintenance   |    11 |      36.7% | skill-creation, skill-dependency-fix, noise-filtering         |

> Percentages are relative to 30 total cases (29 implemented + 1 planned).

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

LiveClawBench includes 5 controlled pairs for isolating single-factor effects on agent performance:

- **Factor-addition pairs**: the variant adds exactly one new complexity factor over the base
- **Intensity-gradient pairs**: both cases share the same factor, but at different depth/severity

| Pair ID | Controlled Pair                    | Base Case (Difficulty)              | Added Factor                | Variant Case (Difficulty)                |
|--------:|------------------------------------|-------------------------------------|-----------------------------|------------------------------------------|
|       1 | Shopping → Cross-env Shopping      | washer-shop (E)                     | +A1 (email integration)     | email-washer-change (M)                  |
|       2 | Shopping → Cross-env Shopping      | watch-shop (E)                      | +A1 (email integration)     | email-watch-shop (M)                     |
|       3 | Seat Selection → Failed Selection  | flight-seat-selection (M)           | +B1 (constraint failure)    | flight-seat-selection-failed (H)         |
|       4 | Vue Fix easy → hard                | vue-project-build-bug-fix-easy (E)  | +A2 (more complex faults)   | vue-project-build-bug-fix-hard (H)       |
|       5 | Skill Creation → Dependency Fix    | skill-creation (E)                  | +B2 (dependency chain)      | skill-dependency-fix (H)                 |

Pair design rationale:
- **Pairs 1–2** validate A1 (Cross-Service Dependency): adding email notification to a simple shopping task raises difficulty from E to M
- **Pair 3** validates B1 (Implicit Goal Resolution): seat selection with constraint failure requires the agent to autonomously decide on a fallback strategy, raising difficulty from M to H
- **Pair 4** is an intensity gradient: both are A2 bug-fix tasks, but the hard variant has a more complex fault chain — difficulty jumps from E to H
- **Pair 5** is an intensity gradient: from single skill creation to dependency-chain repair, B2 depth increases significantly, raising difficulty from E to H

---

## 5. Difficulty Distribution

| Difficulty | Count | Percentage | Cases |
|:----------:|------:|-----------:|-------|
| Easy       |    10 |      33.3% | skill-creation, skill-supplementation, email-writing, email-reply, flight-booking, washer-shop, watch-shop, washer-change, info-change, vue-project-build-bug-fix-easy |
| Medium     |    10 |      33.3% | skill-conflict-resolution, skill-combination *(planned)*, flight-seat-selection, baggage-tracking-application, blog-site-completion-from-starter, email-watch-shop, email-washer-change, noise-filtering, incremental-update-ctp, conflict-repair-acb |
| Hard       |    10 |      33.3% | skill-repository-curation, skill-dependency-fix, flight-seat-selection-failed, flight-cancel-claim, flight-info-change-notice, schedule-change-request, blog-site-from-scratch, vue-project-build-bug-fix-hard, mixed-tool-memory, live-web-research-sqlite-fts5 |

Factor count vs difficulty:

| Difficulty | Avg Factor Count | Baseline (0 factors) | Single Factor | Multi-Factor |
|:----------:|:----------------:|:--------------------:|:-------------:|:------------:|
| Easy       |             0.3  |          7           |       3       |       0      |
| Medium     |             1.4  |          0           |       7       |       3      |
| Hard       |             1.4  |          1           |       4       |       5      |

Easy cases are predominantly baselines (70%), while Medium/Hard cases almost always carry
at least one factor. The single Hard baseline (`blog-site-from-scratch`) derives its
difficulty from task scale and openness rather than structural complexity factors.
