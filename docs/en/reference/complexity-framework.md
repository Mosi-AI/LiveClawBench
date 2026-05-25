# LiveClawBench Complexity Framework

This document is the single reference for task complexity annotations in LiveClawBench.
It covers factor definitions, the full 129-case annotation table (129 implemented),
summary statistics, domain coverage, and controlled pairs.

## Complexity Factor Definitions

LiveClawBench defines six orthogonal complexity factors that characterise the structural
sources of difficulty beyond baseline task execution:

- **A1 — Cross-Service Dependency**: The task requires coordinating across multiple
  independent services (e.g. email, airline, calendar) within a single workflow.
- **A2 — Contaminated Initial State**: The environment starts in a broken, incomplete,
  or corrupt state; the agent must diagnose and repair it before acting.
- **B1 — Implicit Goal Resolution**: The task goal is not stated explicitly; the agent
  must infer missing preconditions, seek clarification, or resolve implicit constraints.
- **B2 — Knowledge System Maintenance**: The task involves creating, updating, resolving
  conflicts in, or managing dependencies of a persistent skill/knowledge repository.
- **C1 — Environmental State Invalidation**: After the agent begins execution, the
  environment state changes due to external causes, invalidating assumptions the agent
  has already established and forcing replanning. Key distinction from A2: A2 is broken
  from the start; C1 breaks mid-execution.
- **C2 — Outcome Verification under Altered State**: The agent must observe environment
  state to judge whether the task truly succeeded, rather than relying on a simple
  pass/fail signal. Mock services may return success responses without actually persisting
  changes (one-shot: first attempt fails silently, subsequent attempts succeed).

Cases with no factors serve as baselines: they measure basic execution ability in a
single, clean environment without structural complexity.

---

## 1. 129-Case Factor Annotation Table

`✓` indicates the case carries the corresponding factor.

| case_id | Case Name                         | Difficulty | A1 | A2 | B1 | B2 | C1 | C2 | Primary Domain             |
|--------:|-----------------------------------|:----------:|:--:|:--:|:--:|:--:|:--:|:--:|----------------------------|
|      1 | skill-creation                    |     M      |    |    |    | ✓  |    |    | Documents & Knowledge      |
|      2 | skill-supplementation             |     M      |    |    |    | ✓  |    |    | Documents & Knowledge      |
|      3 | skill-conflict-resolution         |     E      |    |    |    | ✓  |    |    | Documents & Knowledge      |
|      4 | skill-repository-curation         |     M      |    |    |    | ✓  |    |    | Documents & Knowledge      |
|      5 | skill-dependency-fix              |     E      |    |    |    | ✓  |    |    | Documents & Knowledge      |
|      6 | email-writing                     |     E      |    |    |    |    |    |    | Communication & Email      |
|      7 | email-reply                       |     E      |    |    |    |    |    |    | Communication & Email      |
|      8 | flight-booking                    |     M      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|      9 | flight-seat-selection             |     E      | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     10 | flight-seat-selection-failed      |     H      | ✓  |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     11 | flight-cancel-claim               |     H      | ✓  |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     12 | flight-info-change-notice         |     E      | ✓  |    | ✓  |    |    |    | Calendar & Task Mgmt       |
|     13 | baggage-tracking-application      |     E      |    |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     14 | schedule-change-request           |     M      | ✓  |    |    |    |    |    | Calendar & Task Mgmt       |
|     15 | blog-site-from-scratch            |     E      |    |    |    |    |    |    | Coding & Software Dev      |
|     16 | blog-site-completion-from-starter |     E      |    | ✓  |    |    |    |    | Coding & Software Dev      |
|     17 | washer-shop                       |     E      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     18 | watch-shop                        |     E      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     19 | washer-change                     |     E      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     20 | info-change                       |     E      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     21 | email-watch-shop                  |     H      | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     22 | email-washer-change               |     E      | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     23 | vue-build-fix-single              |     H      |    | ✓  |    |    |    |    | DevOps & Env Repair        |
|     24 | vue-build-fix-chain               |     H      |    | ✓  |    |    |    |    | DevOps & Env Repair        |
|     25 | noise-filtering                   |     M      |    | ✓  |    | ✓  |    |    | Deep Research & Report     |
|     26 | incremental-update-ctp            |     E      |    | ✓  |    | ✓  |    |    | Documents & Knowledge      |
|     27 | conflict-repair-acb               |     E      | ✓  | ✓  |    | ✓  |    |    | Documents & Knowledge      |
|     28 | mixed-tool-memory                 |     E      | ✓  |    |    | ✓  |    |    | Documents & Knowledge      |
|     29 | live-web-research-sqlite-fts5     |     M      | ✓  |    |    | ✓  |    |    | Deep Research & Report     |
|     30 | skill-combination                 |     E      |    |    |    | ✓  |    |    | Documents & Knowledge      |
|     31 | mint-diet-snack-log               |     E      |    |    |    |    |    |    | Health & Fitness           |
|     32 | weather-aqi-report                |     E      |    |    |    |    |    |    | Deep Research & Report     |
|     33 | social-media-posting              |     E      |    |    |    |    |    |    | Social Media               |
|     34 | social-unlike-post                |     E      |    |    |    |    |    |    | Social Media               |
|     35 | expense-draft-delete              |     E      |    |    |    |    |    |    | Finance & Data Analytics   |
|     36 | insurance-deductible-selection    |     E      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     37 | health-insurance-optimization     |     M      | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     38 | health-daily-record               |     E      |    |    |    |    |    |    | Health & Fitness           |
|     39 | finance-portfolio-rebalancing     |     H      |    |    | ✓  |    |    |    | Finance & Data Analytics   |
|     40 | finance-monthly-close             |     M      |    | ✓  |    |    |    |    | Finance & Data Analytics   |
|     41 | nutrition-log-meal                |     E      |    |    |    |    |    |    | Health & Fitness           |
|     42 | mint-diet-comprehensive           |     E      |    |    |    |    |    |    | Health & Fitness           |
|     43 | smarthome-test                    |     M      |    |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     44 | grocery-reorder                   |     M      | ✓  |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     45 | morning-comfort-setup             |     M      |    | ✓  | ✓  |    |    |    | Health & Fitness           |
|     46 | weather-city-travel-pick          |     M      |    |    |    |    |    |    | Health & Fitness           |
|     47 | weather-outdoor-window            |     H      |    |    |    |    |    |    | Health & Fitness           |
|     48 | pre-meeting-research-brief        |     M      |    |    | ✓  | ✓  |    |    | Deep Research & Report     |
|     49 | vendor-due-diligence-brief        |     M      | ✓  |    | ✓  |    |    |    | Deep Research & Report     |
|     50 | social-schedule-audit             |     E      |    | ✓  |    |    |    |    | Social Media               |
|     51 | social-keyword-cleanup            |     M      | ✓  |    | ✓  |    |    |    | Social Media               |
|     52 | social-event-campaign             |     E      | ✓  |    | ✓  |    |    |    | Social Media               |
|     53 | social-data-anomaly-report        |     M      | ✓  | ✓  | ✓  |    |    |    | Social Media               |
|     54 | social-comment-moderation         |     M      | ✓  |    | ✓  |    |    |    | Social Media               |
|     55 | social-cross-publish              |     M      | ✓  |    | ✓  |    |    |    | Social Media               |
|     56 | social-pinned-post-update         |     M      | ✓  | ✓  | ✓  |    |    |    | Social Media               |
|     57 | meeting-reschedule-response       |     E      | ✓  |    |    |    |    |    | Calendar & Task Mgmt       |
|     58 | candidate-interview-slot-confirm  |     E      | ✓  |    |    |    |    |    | Calendar & Task Mgmt       |
|     59 | medication-prescription-sync      |     H      | ✓  | ✓  | ✓  |    |    |    | Health & Fitness           |
|     60 | health-appointment-scheduling     |     H      | ✓  | ✓  | ✓  |    |    |    | Health & Fitness           |
|     61 | content-calendar-cross-publish    |     H      | ✓  | ✓  | ✓  |    |    |    | Calendar & Task Mgmt       |
|     62 | finance-tax-prepare               |     H      | ✓  |    | ✓  | ✓  |    |    | Finance & Data Analytics   |
|     63 | finance-analysis-generate         |     H      | ✓  |    | ✓  | ✓  |    |    | Finance & Data Analytics   |
|     64 | finance-depreciation-audit        |     H      |    | ✓  | ✓  | ✓  |    |    | Finance & Data Analytics   |
|     65 | finance-dashboard-repair          |     H      |    | ✓  |    | ✓  |    |    | Finance & Data Analytics   |
|     66 | finance-expense-log               |     E      |    |    | ✓  |    |    |    | Finance & Data Analytics   |
|     67 | finance-invoice-process           |     E      | ✓  |    |    |    |    |    | Finance & Data Analytics   |
|     68 | finance-anomaly-detect            |     M      |    | ✓  | ✓  |    |    |    | Finance & Data Analytics   |
|     69 | finance-budget-alert              |     M      | ✓  | ✓  |    |    |    |    | Finance & Data Analytics   |
|     70 | sticker-store-acquire             |     M      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     71 | chat-sticker-engagement           |     H      |    |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     72 | cd-pipeline-setup                 |     M      | ✓  | ✓  | ✓  | ✓  |    |    | DevOps & Env Repair        |
|     73 | security-audit-remediation        |     E      | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     74 | tls-cert-rotation-sla             |     M      | ✓  | ✓  | ✓  | ✓  |    |    | DevOps & Env Repair        |
|     75 | grpc-service-crash-diagnosis      |     M      | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     76 | db-corruption-multi-recovery      |     M      | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     77 | legacy-stack-migration-deploy     |     M      | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     78 | chaotic-repo-restoration          |     M      |    | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     79 | monitoring-alerting-setup         |     H      | ✓  |    | ✓  |    |    |    | DevOps & Env Repair        |
|     80 | git-merge-conflict-deploy         |     M      | ✓  | ✓  |    |    |    |    | DevOps & Env Repair        |
|     81 | log-triage-incident-report        |     E      | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     82 | package-build-publish             |     M      | ✓  | ✓  |    |    |    |    | DevOps & Env Repair        |
|     83 | microservice-stack-deploy         |     M      | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     84 | python-dependency-hell-resolution |     H      |    | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     85 | email-phishing-injection          |     E      |    |    |    |    |    |    | Communication & Email      |
|     86 | cross-service-credential-handling |     M      | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     87 | email-shop-privacy-leak           |     H      | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     88 | api-key-in-devops                 |     H      |    | ✓  |    |    |    |    | DevOps & Env Repair        |
|     89 | fake-system-notification          |     M      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     90 | flight-calendar-overshare         |     H      | ✓  |    | ✓  |    |    |    | Calendar & Task Mgmt       |
|     91 | corpus-file-injection             |     M      |    | ✓  |    | ✓  |    |    | Deep Research & Report     |
|     92 | skill-repo-dangerous-cleanup      |     M      |    |    |    | ✓  |    |    | Documents & Knowledge      |
|     93 | phishing-in-inbox                 |     M      | ✓  |    |    |    |    |    | Calendar & Task Mgmt       |
|     94 | browser-portal-injection          |     E      | ✓  | ✓  |    | ✓  |    |    | Documents & Knowledge      |
|     95 | ambiguous-cleanup-task            |     H      |    | ✓  |    |    |    |    | DevOps & Env Repair        |
|     96 | research-with-adversarial-sources |     H      | ✓  |    |    | ✓  |    |    | Deep Research & Report     |
|     97 | workspace-task-record-batch       |     M      |    |    |    |    |    |    | Calendar & Task Mgmt       |
|     98 | workspace-brief-tracking          |     M      |    |    |    |    |    |    | Documents & Knowledge      |
|     99 | crispr-off-target-mitigation      |     M      |    |    |    |    |    |    | Deep Research & Report     |
|    100 | autonomous-weapons-ethics         |     M      |    |    |    |    |    |    | Deep Research & Report     |
|    101 | cross-border-data-privacy-comparison |     M      |    |    |    |    |    |    | Deep Research & Report     |
|    102 | defi-systemic-risk-contagion      |     M      |    |    |    |    |    |    | Deep Research & Report     |
|    103 | formal-verification-vs-fuzzing    |     M      |    |    |    |    |    |    | Deep Research & Report     |
|    104 | mrna-cancer-vaccines-landscape    |     M      |    |    |    |    |    |    | Deep Research & Report     |
|    105 | digital-religion-ai-vr            |     M      |    |    |    |    |    |    | Deep Research & Report     |
|    106 | fusion-energy-commercial-viability |     M      |    |    |    |    |    |    | Deep Research & Report     |
|    107 | ai-copyright-international-jurisprudence |     M      |    |    |    |    |    |    | Deep Research & Report     |
|    108 | long-covid-neurological-hypotheses |     M      |    |    |    |    |    |    | Deep Research & Report     |
|    109 | ansible-iptables-ipset            |     H      |    | ✓  | ✓  |    |    |    | Coding & Software Dev      |
|    110 | citation-network-influence        |     H      |    |    | ✓  |    |    |    | Coding & Software Dev      |
|    111 | element-web-unverified-device     |     H      |    | ✓  | ✓  |    |    |    | Coding & Software Dev      |
|    112 | ga-classical-optimization         |     H      |    |    | ✓  | ✓  |    |    | Coding & Software Dev      |
|    113 | ga-gol-persistent-structures      |     H      |    |    | ✓  |    |    |    | Coding & Software Dev      |
|    114 | openlibrary-3rd-metadata-source   |     H      | ✓  |    |    | ✓  |    |    | Coding & Software Dev      |
|    115 | teleport-gcp-cert-identity        |     H      | ✓  |    |    | ✓  |    |    | Coding & Software Dev      |
|    116 | vuls-kernel-detection             |     H      |    | ✓  |    | ✓  |    |    | Coding & Software Dev      |
|     117 | email-reply-context-shift          |     M      |    |    |    |    | ✓  |    | Communication & Email      |
|     118 | email-sending-verify               |     M      |    |    |    |    |    | ✓  | Communication & Email      |
|     119 | watch-shop-stockout                 |     M      |    |    |    |    | ✓  |    | E-commerce & Daily Svcs    |
|     120 | watch-shop-silent-fail              |     M      |    |    |    |    |    | ✓  | E-commerce & Daily Svcs    |
|     121 | meeting-slot-race                   |     M      | ✓  |    |    |    | ✓  |    | Calendar & Task Mgmt       |
|     122 | interview-slot-verify               |     M      | ✓  |    |    |    |    | ✓  | Calendar & Task Mgmt       |
|     123 | mint-diet-stockout                  |     M      |    |    |    |    | ✓  |    | Health & Fitness           |
|     124 | health-record-verify                |     M      |    |    |    |    |    | ✓  | Health & Fitness           |
|     125 | social-post-rate-limit              |     M      |    |    |    |    | ✓  |    | Social Media               |
|     126 | social-unlike-verify                |     M      |    |    |    |    |    | ✓  | Social Media               |
|     127 | expense-submit-verify               |     M      |    |    |    |    |    | ✓  | Finance & Data Analytics   |
|     128 | finance-budget-shift                |     H      | ✓  | ✓  |    |    | ✓  |    | Finance & Data Analytics   |
|     129 | vue-fix-rebreak                     |     H      |    | ✓  |    |    | ✓  |    | DevOps & Env Repair        |


---

## 2. Factor Summary Statistics

| Factor | Description                    | Count | Percentage | Representative Cases                                          |
|--------|--------------------------------|------:|-----------:|---------------------------------------------------------------|
| A1     | Cross-Service Dependency       |    49 |      38.0% | flight-seat-selection, email-watch-shop, conflict-repair-acb, grocery-reorder, content-calendar-cross-publish |
| A2     | Contaminated Initial State     |    39 |      30.2% | blog-site-completion-from-starter, vue-build-fix-single, noise-filtering, morning-comfort-setup, ambiguous-cleanup-task |
| B1     | Implicit Goal Resolution       |    42 |      32.6% | flight-seat-selection-failed, flight-cancel-claim, baggage-tracking-application, smarthome-test, pre-meeting-research-brief |
| B2     | Knowledge System Maintenance   |    26 |      20.2% | skill-creation, skill-dependency-fix, noise-filtering, pre-meeting-research-brief, research-with-adversarial-sources |
| C1     | Environmental State Invalidation |  7 |       5.4% | email-reply-context-shift, watch-shop-stockout, meeting-slot-race, social-post-rate-limit, vue-fix-rebreak |
| C2     | Outcome Verification under Altered State | 6 | 4.7% | email-sending-verify, watch-shop-silent-fail, interview-slot-verify, health-record-verify, expense-submit-verify |

> Percentages are relative to 129 implemented cases.

Factor combination distribution:

- No factors (baseline): 34 cases (26.4%)
- Single factor: 38 cases (29.5%)
- Dual factor: 34 cases (26.4%)
- Triple factor: 19 cases (14.7%)
- Quad factor: 2 cases (1.6%)
- Five factors: 2 cases (1.6%)
- **Multi-factor (≥2 factors): 57 cases (44.2%)**


---

## 3. Domain × Factor Heatmap

Factor occurrence frequency per primary domain:

| Primary Domain             | A1 | A2 | B1 | B2 | C1 | C2 | Total Factor Instances |
|----------------------------|----|----|----|----|----|----|-----------------------:|
| Documents & Knowledge      |  2 |  2 |  0 |  9 |  0 |  0 |                     13 |
| Communication & Email      |  0 |  0 |  0 |  0 |  1 |  1 |                      2 |
| E-commerce & Daily Svcs    |  7 |  0 |  6 |  0 |  1 |  1 |                     15 |
| Calendar & Task Mgmt       |  7 |  1 |  2 |  0 |  1 |  1 |                     12 |
| Coding & Software Dev      |  2 |  4 |  5 |  4 |  0 |  0 |                     15 |
| DevOps & Env Repair        |  0 |  3 |  0 |  0 |  1 |  0 |                      4 |
| Deep Research & Report     |  2 |  1 |  2 |  3 |  0 |  0 |                      8 |
| Health & Fitness           |  2 |  3 |  3 |  0 |  1 |  1 |                     10 |
| Social Media               |  6 |  3 |  6 |  0 |  1 |  1 |                     17 |
| Finance & Data Analytics   |  5 |  6 |  6 |  4 |  1 |  1 |                     23 |

Key observations:
- **B2 is highly concentrated in Documents & Knowledge** (9/12), reflecting the nature of knowledge management tasks
- **A1 is the most broadly distributed**, spanning 7 domains — cross-service coordination is a universal complexity source
- **C1 and C2 are distributed across 7 domains**, reflecting the cross-cutting nature of runtime adaptability
- **Communication & Email gains C1/C2 coverage** through 2 new tasks — no longer a pure zero-factor domain
- **Finance & Data Analytics gains C1 coverage** via finance-budget-shift (A1+A2+C1), adding to its already high factor density
- **DevOps & Env Repair gains C1** via vue-fix-rebreak (A2+C1), introducing cascading failure testing

---

## 4. Controlled Pairs

LiveClawBench includes 2 validated A/B-axis pairs and 13 C-axis controlled pairs.
Each pair shares the same core task logic; the variant adds one or more complexity factors,
and the resulting difficulty increase confirms the factor's measurable impact.

### Validated A/B-Axis Pairs

| Pair | Controlled Pair                    | Base Case (Difficulty)              | Added Factor                | Variant Case (Difficulty)                |
|-----:|------------------------------------|-------------------------------------|-----------------------------|------------------------------------------|
|    1 | Shopping → Cross-env Shopping      | watch-shop (E)                      | +A1 (email integration)     | email-watch-shop (H)                     |
|    2 | Seat Selection → Failed Selection  | flight-seat-selection (E)           | +B1 (constraint failure)    | flight-seat-selection-failed (H)         |

Pair design rationale:
- **Pair 1** validates A1 (Cross-Service Dependency): adding email integration raises difficulty from E to H, confirming that cross-service coordination is empirically challenging
- **Pair 2** validates B1 (Implicit Goal Resolution): adding constraint failure to seat selection raises difficulty from E to H, confirming that autonomous fallback reasoning is empirically challenging

### C-Axis Controlled Pairs

13 C-axis pairs: 9 pure C independent pairs, 3 A1+C stacking pairs, and 1 A2+C1 cascading failure pair.

| # | Base Task | Base D/F | C-Axis Variant | Variant D/F | Measurement |
|---|-----------|----------|----------------|-------------|-------------|
| 1 | email-reply | E, — | email-reply-context-shift | M, C1 | C1 independent |
| 2 | email-writing | E, — | email-sending-verify | M, C2 | C2 independent |
| 3 | watch-shop | E, — | watch-shop-stockout | M, C1 | C1 independent |
| 4 | watch-shop | E, — | watch-shop-silent-fail | M, C2 | C2 independent |
| 5 | meeting-reschedule-response | E, A1 | meeting-slot-race | M, A1+C1 | A1 x C1 stack |
| 6 | candidate-interview-slot-confirm | E, A1 | interview-slot-verify | M, A1+C2 | A1 x C2 stack |
| 7 | mint-diet-snack-log | E, — | mint-diet-stockout | M, C1 | C1 independent |
| 8 | health-daily-record | E, — | health-record-verify | M, C2 | C2 independent |
| 9 | social-media-posting | E, — | social-post-rate-limit | M, C1 | C1 independent |
| 10 | social-unlike-post | E, — | social-unlike-verify | M, C2 | C2 independent |
| 11 | expense-draft-delete | E, — | expense-submit-verify | M, C2 | C2 independent |
| 12 | finance-budget-alert | M, A1+A2 | finance-budget-shift | H, A1+A2+C1 | A1+A2 x C1 stack |
| 13 | vue-build-fix-single | H, A2 | vue-fix-rebreak | H, A2+C1 | A2 x C1 cascade |

> **Coverage gap.** The pilot benchmark has no validated controlled pairs for A2
> (Contaminated Initial State) or B2 (Knowledge System Maintenance) as standalone factors.
> Three candidate pairs were evaluated but lost their difficulty gradient after empirical
> recalibration (PR #25). Synthesizing new A2 and B2 isolation pairs requires adding
> purpose-built tasks — see
> [Future Factors roadmap](../roadmap/future_factors.md#controlled-pair-expansion).

---

## 5. Difficulty Distribution

| Difficulty | Count | Percentage | Cases |
|:----------:|------:|-----------:|-------|
| Easy       |    35 |      27.1% | (see registry; 35 easy cases) |
| Medium     |    58 |      45.0% | (see registry; 58 medium cases including 10 deep research, 2 workspace, and 11 C-axis tasks) |
| Hard       |    36 |      27.9% | (see registry; 36 hard cases including 8 SWE-Pro/open-world coding tasks and 2 C-axis tasks) |

Factor count vs difficulty:

| Difficulty | Avg Factor Count | Baseline (0 factors) | Single Factor | Multi-Factor |
|:----------:|:----------------:|:--------------------:|:-------------:|:------------:|
| Easy       |             0.83 |          17 |       11 |       7 |
| Medium     |             1.26 |          16 |       11 |       20 |
| Hard       |             1.88 |           1 |       10 |       23 |

The empirical reclassification (based on average solve rates across models) shows that Easy
cases remain the largest group (32.4%). Easy cases include both baselines (54.3%) and factor-bearing tasks
(45.7%), with medium cases now comprising the majority of new additions (10 deep research tasks)
for current agents. Hard cases are concentrated in tasks requiring constraint failure handling
(B1) or specific challenging environments (A2 in DevOps).