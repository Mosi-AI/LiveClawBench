# LiveClawBench Complexity Framework

This document is the single reference for task complexity annotations in LiveClawBench.
It covers factor definitions, the full 134-case annotation table (134 implemented),
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

## 1. 134-Case Factor Annotation Table

`✓` indicates the case carries the corresponding factor.

| case_id | Case Name                         | Difficulty | A1 | A2 | B1 | B2 | C1 | C2 | Primary Domain             |
|--------:|-----------------------------------|:----------:|:--:|:--:|:--:|:--:|:--:|:--:|----------------------------|
|      1 | skill-creation                    |     H      |    |    |    | ✓  |    |    | Documents & Knowledge      |
|      2 | skill-supplementation             |     E      |    |    |    | ✓  |    |    | Documents & Knowledge      |
|      3 | skill-conflict-resolution         |     E      |    |    |    | ✓  |    |    | Documents & Knowledge      |
|      4 | skill-repository-curation         |     M      |    |    |    | ✓  |    |    | Documents & Knowledge      |
|      5 | skill-dependency-fix              |     M      |    |    |    | ✓  |    |    | Documents & Knowledge      |
|      6 | email-writing                     |     E      |    |    |    |    |    |    | Communication & Email      |
|      7 | email-reply                       |     E      |    |    |    |    |    |    | Communication & Email      |
|      8 | flight-booking                    |     H      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|      9 | flight-seat-selection             |     E      | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     10 | flight-seat-selection-failed      |     M      | ✓  |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     11 | flight-cancel-claim               |     H      | ✓  |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     12 | flight-info-change-notice         |     M      | ✓  |    | ✓  |    |    |    | Calendar & Task Mgmt       |
|     13 | baggage-tracking-application      |     E      |    |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     14 | schedule-change-request           |     E      | ✓  |    |    |    |    |    | Calendar & Task Mgmt       |
|     15 | blog-site-from-scratch            |     E      |    |    |    |    |    |    | Coding & Software Dev      |
|     16 | blog-site-completion-from-starter |     E      |    | ✓  |    |    |    |    | Coding & Software Dev      |
|     17 | washer-shop                       |     M      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     18 | watch-shop                        |     E      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     19 | washer-change                     |     E      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     20 | info-change                       |     E      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     21 | email-watch-shop                  |     E      | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     22 | email-washer-change               |     E      | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     23 | vue-build-fix-single              |     M      |    | ✓  |    |    |    |    | DevOps & Env Repair        |
|     24 | vue-build-fix-chain               |     E      |    | ✓  |    |    |    |    | DevOps & Env Repair        |
|     25 | noise-filtering                   |     M      |    | ✓  |    | ✓  |    |    | Deep Research & Report     |
|     26 | incremental-update-ctp            |     E      |    | ✓  |    | ✓  |    |    | Documents & Knowledge      |
|     27 | conflict-repair-acb               |     E      | ✓  | ✓  |    | ✓  |    |    | Documents & Knowledge      |
|     28 | mixed-tool-memory                 |     E      | ✓  |    |    | ✓  |    |    | Documents & Knowledge      |
|     29 | live-web-research-sqlite-fts5     |     M      | ✓  |    |    | ✓  |    |    | Deep Research & Report     |
|     30 | skill-combination                 |     E      |    |    |    | ✓  |    |    | Documents & Knowledge      |
|     31 | mint-diet-snack-log               |     E      |    |    |    |    |    |    | Health & Fitness           |
|     32 | weather-aqi-report                |     M      |    |    |    |    |    |    | Deep Research & Report     |
|     33 | social-media-posting              |     E      |    |    |    |    |    |    | Social Media               |
|     34 | social-unlike-post                |     M      |    |    |    |    |    |    | Social Media               |
|     35 | expense-draft-delete              |     E      |    |    |    |    |    |    | Finance & Data Analytics   |
|     36 | insurance-deductible-selection    |     E      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     37 | health-insurance-optimization     |     E      | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     38 | health-daily-record               |     H      |    |    |    |    |    |    | Health & Fitness           |
|     39 | finance-portfolio-rebalancing     |     E      |    |    | ✓  |    |    |    | Finance & Data Analytics   |
|     40 | finance-monthly-close             |     E      |    | ✓  |    |    |    |    | Finance & Data Analytics   |
|     41 | nutrition-log-meal                |     M      |    |    |    |    |    |    | Health & Fitness           |
|     42 | mint-diet-comprehensive           |     M      |    |    |    |    |    |    | Health & Fitness           |
|     43 | smarthome-test                    |     M      |    |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     44 | grocery-reorder                   |     H      | ✓  |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     45 | morning-comfort-setup             |     M      |    | ✓  | ✓  |    |    |    | Health & Fitness           |
|     46 | weather-city-travel-pick          |     E      |    |    |    |    |    |    | Health & Fitness           |
|     47 | weather-outdoor-window            |     E      |    |    |    |    |    |    | Health & Fitness           |
|     48 | pre-meeting-research-brief        |     E      |    |    | ✓  | ✓  |    |    | Deep Research & Report     |
|     49 | vendor-due-diligence-brief        |     E      | ✓  |    | ✓  |    |    |    | Deep Research & Report     |
|     50 | social-schedule-audit             |     H      |    | ✓  |    |    |    |    | Social Media               |
|     51 | social-keyword-cleanup            |     H      | ✓  |    | ✓  |    |    |    | Social Media               |
|     52 | social-event-campaign             |     H      | ✓  |    | ✓  |    |    |    | Social Media               |
|     53 | social-data-anomaly-report        |     H      | ✓  | ✓  | ✓  |    |    |    | Social Media               |
|     54 | social-comment-moderation         |     H      | ✓  |    | ✓  |    |    |    | Social Media               |
|     55 | social-cross-publish              |     E      | ✓  |    | ✓  |    |    |    | Social Media               |
|     56 | social-pinned-post-update         |     H      | ✓  | ✓  | ✓  |    |    |    | Social Media               |
|     57 | meeting-reschedule-response       |     E      | ✓  |    |    |    |    |    | Calendar & Task Mgmt       |
|     58 | candidate-interview-slot-confirm  |     M      | ✓  |    |    |    |    |    | Calendar & Task Mgmt       |
|     59 | medication-prescription-sync      |     E      | ✓  | ✓  | ✓  |    |    |    | Health & Fitness           |
|     60 | health-appointment-scheduling     |     M      | ✓  | ✓  | ✓  |    |    |    | Health & Fitness           |
|     61 | content-calendar-cross-publish    |     H      | ✓  | ✓  | ✓  |    |    |    | Calendar & Task Mgmt       |
|     62 | finance-tax-prepare               |     E      | ✓  |    | ✓  | ✓  |    |    | Finance & Data Analytics   |
|     63 | finance-analysis-generate         |     E      | ✓  |    | ✓  | ✓  |    |    | Finance & Data Analytics   |
|     64 | finance-depreciation-audit        |     E      |    | ✓  | ✓  | ✓  |    |    | Finance & Data Analytics   |
|     65 | finance-dashboard-repair          |     M      |    | ✓  |    | ✓  |    |    | Finance & Data Analytics   |
|     66 | finance-expense-log               |     E      |    |    | ✓  |    |    |    | Finance & Data Analytics   |
|     67 | finance-invoice-process           |     M      | ✓  |    |    |    |    |    | Finance & Data Analytics   |
|     68 | finance-anomaly-detect            |     M      |    | ✓  | ✓  |    |    |    | Finance & Data Analytics   |
|     69 | finance-budget-alert              |     M      | ✓  | ✓  |    |    |    |    | Finance & Data Analytics   |
|     70 | sticker-store-acquire             |     M      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     71 | chat-sticker-engagement           |     E      |    |    | ✓  |    |    |    | E-commerce & Daily Svcs    |
|     72 | cd-pipeline-setup                 |     E      | ✓  | ✓  | ✓  | ✓  |    |    | DevOps & Env Repair        |
|     73 | security-audit-remediation        |     E      | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     74 | tls-cert-rotation-sla             |     M      | ✓  | ✓  | ✓  | ✓  |    |    | DevOps & Env Repair        |
|     75 | grpc-service-crash-diagnosis      |     M      | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     76 | db-corruption-multi-recovery      |     E      | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     77 | legacy-stack-migration-deploy     |     E      | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     78 | chaotic-repo-restoration          |     E      |    | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     79 | monitoring-alerting-setup         |     M      | ✓  |    | ✓  |    |    |    | DevOps & Env Repair        |
|     80 | git-merge-conflict-deploy         |     E      | ✓  | ✓  |    |    |    |    | DevOps & Env Repair        |
|     81 | log-triage-incident-report        |     M      | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     82 | package-build-publish             |     M      | ✓  | ✓  |    |    |    |    | DevOps & Env Repair        |
|     83 | microservice-stack-deploy         |     M      | ✓  | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     84 | python-dependency-hell-resolution |     H      |    | ✓  | ✓  |    |    |    | DevOps & Env Repair        |
|     85 | email-phishing-injection          |     E      |    |    |    |    |    |    | Communication & Email      |
|     86 | cross-service-credential-handling |     M      | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     87 | email-shop-privacy-leak           |     E      | ✓  |    |    |    |    |    | E-commerce & Daily Svcs    |
|     88 | api-key-in-devops                 |     H      |    | ✓  |    |    |    |    | DevOps & Env Repair        |
|     89 | fake-system-notification          |     H      |    |    |    |    |    |    | E-commerce & Daily Svcs    |
|     90 | flight-calendar-overshare         |     H      | ✓  |    | ✓  |    |    |    | Calendar & Task Mgmt       |
|     91 | corpus-file-injection             |     M      |    | ✓  |    | ✓  |    |    | Deep Research & Report     |
|     92 | skill-repo-dangerous-cleanup      |     M      |    |    |    | ✓  |    |    | Documents & Knowledge      |
|     93 | phishing-in-inbox                 |     E      | ✓  |    |    |    |    |    | Calendar & Task Mgmt       |
|     94 | browser-portal-injection          |     E      | ✓  | ✓  |    | ✓  |    |    | Documents & Knowledge      |
|     95 | ambiguous-cleanup-task            |     M      |    | ✓  |    |    |    |    | DevOps & Env Repair        |
|     96 | research-with-adversarial-sources |     H      | ✓  |    |    | ✓  |    |    | Deep Research & Report     |
|     97 | workspace-task-record-batch       |     E      |    |    |    |    |    |    | Calendar & Task Mgmt       |
|     98 | workspace-brief-tracking          |     E      |    |    |    |    |    |    | Documents & Knowledge      |
|     99 | crispr-off-target-mitigation      |     M      |    |    |    |    |    |    | Deep Research & Report     |
|    100 | autonomous-weapons-ethics         |     M      |    |    |    |    |    |    | Deep Research & Report     |
|    101 | cross-border-data-privacy-comparison |     H      |    |    |    |    |    |    | Deep Research & Report     |
|    102 | defi-systemic-risk-contagion      |     E      |    |    |    |    |    |    | Deep Research & Report     |
|    103 | formal-verification-vs-fuzzing    |     M      |    |    |    |    |    |    | Deep Research & Report     |
|    104 | mrna-cancer-vaccines-landscape    |     M      |    |    |    |    |    |    | Deep Research & Report     |
|    105 | digital-religion-ai-vr            |     H      |    |    |    |    |    |    | Deep Research & Report     |
|    106 | fusion-energy-commercial-viability |     H      |    |    |    |    |    |    | Deep Research & Report     |
|    107 | ai-copyright-international-jurisprudence |     M      |    |    |    |    |    |    | Deep Research & Report     |
|    108 | long-covid-neurological-hypotheses |     H      |    |    |    |    |    |    | Deep Research & Report     |
|    109 | ansible-iptables-ipset            |     E      |    | ✓  | ✓  |    |    |    | Coding & Software Dev      |
|    110 | citation-network-influence        |     E      |    |    | ✓  |    |    |    | Coding & Software Dev      |
|    111 | element-web-unverified-device     |     H      |    | ✓  | ✓  |    |    |    | Coding & Software Dev      |
|    112 | ga-classical-optimization         |     M      |    |    | ✓  | ✓  |    |    | Coding & Software Dev      |
|    113 | ga-gol-persistent-structures      |     H      |    |    | ✓  |    |    |    | Coding & Software Dev      |
|    114 | openlibrary-3rd-metadata-source   |     H      | ✓  |    |    | ✓  |    |    | Coding & Software Dev      |
|    115 | teleport-gcp-cert-identity        |     H      | ✓  |    |    | ✓  |    |    | Coding & Software Dev      |
|    116 | vuls-kernel-detection             |     H      |    | ✓  |    | ✓  |    |    | Coding & Software Dev      |
|     117 | email-reply-context-shift          |     H      |    |    |    |    | ✓  |    | Communication & Email      |
|     118 | email-sending-verify               |     E      |    |    |    |    |    | ✓  | Communication & Email      |
|     119 | watch-shop-stockout                 |     E      |    |    |    |    | ✓  |    | E-commerce & Daily Svcs    |
|     120 | watch-shop-silent-fail              |     M      |    |    |    |    |    | ✓  | E-commerce & Daily Svcs    |
|     121 | meeting-slot-race                   |     M      | ✓  |    |    |    | ✓  |    | Calendar & Task Mgmt       |
|     122 | interview-slot-verify               |     H      | ✓  |    |    |    |    | ✓  | Calendar & Task Mgmt       |
|     123 | mint-diet-stockout                  |     E      |    |    |    |    | ✓  |    | Health & Fitness           |
|     124 | health-record-verify                |     H      |    |    |    |    |    | ✓  | Health & Fitness           |
|     125 | social-post-rate-limit              |     M      |    |    |    |    | ✓  |    | Social Media               |
|     126 | social-unlike-verify                |     H      |    |    |    |    |    | ✓  | Social Media               |
|     127 | expense-submit-verify               |     M      |    |    |    |    |    | ✓  | Finance & Data Analytics   |
|     128 | finance-budget-shift                |     H      | ✓  | ✓  |    |    | ✓  |    | Finance & Data Analytics   |
|     129 | vue-fix-rebreak                     |     M      |    | ✓  |    |    | ✓  |    | DevOps & Env Repair        |
|     130 | vendor-requirement-followup       |     E      | ✓  |    | ✓  | ✓  |    |    | Communication & Email      |
|     131 | invoice-to-expense-draft          |     M      | ✓  |    | ✓  |    |    |    | Communication & Email      |
|     132 | newsletter-digest-forward         |     M      | ✓  |    | ✓  |    |    |    | Communication & Email      |
|     133 | procurement-quote-compare-reply   |     H      |    |    | ✓  |    |    |    | Communication & Email      |
|     134 | stale-client-escalation           |     M      | ✓  |    | ✓  | ✓  |    |    | Communication & Email      |

---

## 2. Factor Summary Statistics

| Factor | Description                    | Count | Percentage | Representative Cases                                          |
|--------|--------------------------------|------:|-----------:|---------------------------------------------------------------|
| A1     | Cross-Service Dependency       |    54 |      40.3% | flight-seat-selection, email-watch-shop, conflict-repair-acb, grocery-reorder, content-calendar-cross-publish |
| A2     | Contaminated Initial State     |    39 |      29.1% | blog-site-completion-from-starter, vue-build-fix-single, noise-filtering, morning-comfort-setup, ambiguous-cleanup-task |
| B1     | Implicit Goal Resolution       |    47 |      35.1% | flight-seat-selection-failed, flight-cancel-claim, baggage-tracking-application, smarthome-test, pre-meeting-research-brief |
| B2     | Knowledge System Maintenance   |    28 |      20.9% | skill-creation, skill-dependency-fix, noise-filtering, pre-meeting-research-brief, research-with-adversarial-sources |
| C1     | Environmental State Invalidation |  7 |       5.4% | email-reply-context-shift, watch-shop-stockout, meeting-slot-race, social-post-rate-limit, vue-fix-rebreak |
| C2     | Outcome Verification under Altered State | 6 | 4.7% | email-sending-verify, watch-shop-silent-fail, interview-slot-verify, health-record-verify, expense-submit-verify |

> Percentages are relative to 134 implemented cases.

Factor combination distribution:

- No factors (baseline): 34 cases (25.4%)
- Single factor: 42 cases (31.3%)
- Dual factor: 37 cases (27.6%)
- Triple factor: 19 cases (14.2%)
- Quad factor: 2 cases (1.5%)
- **Multi-factor (≥2 factors): 58 cases (43.3%)**


---

## 3. Domain × Factor Heatmap

Factor occurrence frequency per primary domain:

| Primary Domain             | A1 | A2 | B1 | B2 | C1 | C2 | Total Factor Instances |
|----------------------------|----|----|----|----|----|----|-----------------------:|
| Documents & Knowledge      |  3 |  3 |  0 | 11 |  0 |  0 |                     17 |
| Communication & Email      |  4 |  0 |  5 |  2 |  1 |  1 |                     13 |
| E-commerce & Daily Svcs    |  9 |  0 |  6 |  0 |  1 |  1 |                     17 |
| Calendar & Task Mgmt       |  9 |  1 |  3 |  0 |  1 |  1 |                     15 |
| Coding & Software Dev      |  2 |  4 |  5 |  4 |  0 |  0 |                     15 |
| DevOps & Env Repair        | 11 | 17 | 11 |  2 |  1 |  0 |                     42 |
| Deep Research & Report     |  3 |  2 |  2 |  5 |  0 |  0 |                     12 |
| Health & Fitness           |  2 |  3 |  3 |  0 |  1 |  1 |                     10 |
| Social Media               |  6 |  3 |  6 |  0 |  1 |  1 |                     17 |
| Finance & Data Analytics   |  5 |  6 |  6 |  4 |  1 |  1 |                     23 |

Key observations:
- **B2 is highly concentrated in Documents & Knowledge** (11/17), reflecting the nature of knowledge management tasks
- **A1 is the most broadly distributed**, spanning 8 domains — cross-service coordination is a universal complexity source
- **C1 and C2 are distributed across 8 domains**, reflecting the cross-cutting nature of runtime adaptability
- **Communication & Email is no longer a pure zero-factor domain** — it now carries B1, B2, C1, and C2 coverage via 10 tasks spanning email, calendar, and procurement workflows
- **Finance & Data Analytics gains C1/C2 coverage** via finance-budget-shift and finance-anomaly-detect, adding to its already high factor density
- **DevOps & Env Repair is the most factor-dense domain** (42 total instances) with heavy A2 and B1 load from environment repair tasks

---

## 4. Controlled Pairs

LiveClawBench includes 2 validated A/B-axis pairs and 13 C-axis controlled pairs.
Each pair shares the same core task logic; the variant adds one or more complexity factors,
and the resulting difficulty increase confirms the factor's measurable impact.

### Validated A/B-Axis Pairs

| Pair | Controlled Pair                    | Base Case (Difficulty)              | Added Factor                | Variant Case (Difficulty)                |
|-----:|------------------------------------|-------------------------------------|-----------------------------|------------------------------------------|
|    1 | Shopping → Cross-env Shopping      | watch-shop (E)                      | +A1 (email integration)     | email-watch-shop (E)                     |
|    2 | Seat Selection → Failed Selection  | flight-seat-selection (E)           | +B1 (constraint failure)    | flight-seat-selection-failed (M)         |

Pair design rationale:
- **Pair 1** validates A1 (Cross-Service Dependency): adding email integration was intended to raise difficulty, though both tasks are now empirically easy; the cross-service coordination aspect remains structurally present
- **Pair 2** validates B1 (Implicit Goal Resolution): adding constraint failure to seat selection raises difficulty from E to M, confirming that autonomous fallback reasoning adds measurable complexity

### C-Axis Controlled Pairs

13 C-axis pairs: 9 pure C independent pairs, 3 A1+C stacking pairs, and 1 A2+C1 cascading failure pair.

| # | Base Task | Base D/F | C-Axis Variant | Variant D/F | Measurement |
|---|-----------|----------|----------------|-------------|-------------|
| 1 | email-reply | E, — | email-reply-context-shift | M, C1 | C1 independent |
| 2 | email-writing | E, — | email-sending-verify | M, C2 | C2 independent |
| 3 | watch-shop | E, — | watch-shop-stockout | M, C1 | C1 independent |
| 4 | watch-shop | E, — | watch-shop-silent-fail | M, C2 | C2 independent |
| 5 | meeting-reschedule-response | E, A1 | meeting-slot-race | M, A1+C1 | A1 x C1 stack |
| 6 | candidate-interview-slot-confirm | M, A1 | interview-slot-verify | H, A1+C2 | A1 x C2 stack |
| 7 | mint-diet-snack-log | E, — | mint-diet-stockout | M, C1 | C1 independent |
| 8 | health-daily-record | H, — | health-record-verify | H, C2 | C2 independent |
| 9 | social-media-posting | E, — | social-post-rate-limit | M, C1 | C1 independent |
| 10 | social-unlike-post | E, — | social-unlike-verify | M, C2 | C2 independent |
| 11 | expense-draft-delete | E, — | expense-submit-verify | M, C2 | C2 independent |
| 12 | finance-budget-alert | M, A1+A2 | finance-budget-shift | H, A1+A2+C1 | A1+A2 x C1 stack |
| 13 | vue-build-fix-single | M, A2 | vue-fix-rebreak | M, A2+C1 | A2 x C1 cascade |

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
| Easy       |    57 |      42.5% | (see registry; 57 easy cases) |
| Medium     |    45 |      33.6% | (see registry; 45 medium cases) |
| Hard       |    32 |      23.9% | (see registry; 32 hard cases) |

Factor count vs difficulty:

| Difficulty | Avg Factor Count | Baseline (0 factors) | Single Factor | Multi-Factor |
|:----------:|:----------------:|:--------------------:|:-------------:|:------------:|
| Easy       |             1.26 |          16 |       22 |      19 |
| Medium     |             1.40 |          11 |       12 |      22 |
| Hard       |             1.44 |          7 |       8 |      17 |

The empirical reclassification (based on deepseek-v4-pro 3-trial average rewards) shows that Easy
cases are the largest group (42.5%). Easy cases include both baselines (28.1%) and factor-bearing tasks
(71.9%), with medium cases at 33.6% and hard cases at 23.9%.
Hard cases are concentrated in tasks requiring constraint failure handling
(B1) or specific challenging environments (A2 in DevOps).
