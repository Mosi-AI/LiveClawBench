# LiveClawBench Complexity Framework

This document is the single reference for task complexity annotations in LiveClawBench.
It records the current factor table for all implemented benchmark tasks.

## 1. 100-Case Factor Annotation Table

`✓` indicates the case carries the corresponding factor.

| case_id | Case Name | Difficulty | A1 | A2 | B1 | B2 | Primary Domain |
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
|      43 | smarthome-morning-checkup         |     M      |    |    | ✓  |    | E-commerce & Daily Svcs    |
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
|      72 | cd-pipeline-setup                 |     M      | ✓  | ✓  | ✓  | ✓  | DevOps & Env Repair        |
|      73 | security-audit-remediation        |     E      | ✓  | ✓  | ✓  |    | DevOps & Env Repair        |
|      74 | tls-cert-rotation-sla             |     M      | ✓  | ✓  | ✓  | ✓  | DevOps & Env Repair        |
|      75 | grpc-service-crash-diagnosis      |     M      | ✓  | ✓  | ✓  |    | DevOps & Env Repair        |
|      76 | db-corruption-multi-recovery      |     M      | ✓  | ✓  | ✓  |    | DevOps & Env Repair        |
|      77 | legacy-stack-migration-deploy     |     M      | ✓  | ✓  | ✓  |    | DevOps & Env Repair        |
|      78 | chaotic-repo-restoration          |     M      |    | ✓  | ✓  |    | DevOps & Env Repair        |
|      79 | monitoring-alerting-setup         |     H      | ✓  |    | ✓  |    | DevOps & Env Repair        |
|      80 | git-merge-conflict-deploy         |     M      | ✓  | ✓  |    |    | DevOps & Env Repair        |
|      81 | log-triage-incident-report        |     E      | ✓  | ✓  | ✓  |    | DevOps & Env Repair        |
|      82 | package-build-publish             |     M      | ✓  | ✓  |    |    | DevOps & Env Repair        |
|      83 | microservice-stack-deploy         |     M      | ✓  | ✓  | ✓  |    | DevOps & Env Repair        |
|      84 | python-dependency-hell-resolution |     H      |    | ✓  | ✓  |    | DevOps & Env Repair        |
|      85 | email-phishing-injection          |     E      |    |    |    |    | Communication & Email      |
|      86 | cross-service-credential-handling |     M      | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      87 | email-shop-privacy-leak           |     H      | ✓  |    |    |    | E-commerce & Daily Svcs    |
|      88 | api-key-in-devops                 |     H      |    | ✓  |    |    | DevOps & Env Repair        |
|      89 | fake-system-notification          |     M      |    |    |    |    | E-commerce & Daily Svcs    |
|      90 | flight-calendar-overshare         |     H      | ✓  |    | ✓  |    | Calendar & Task Mgmt       |
|      91 | corpus-file-injection             |     M      |    | ✓  |    | ✓  | Deep Research & Report     |
|      92 | skill-repo-dangerous-cleanup      |     M      |    |    |    | ✓  | Documents & Knowledge      |
|      93 | phishing-in-inbox                 |     M      | ✓  |    |    |    | Calendar & Task Mgmt       |
|      94 | browser-portal-injection          |     E      | ✓  | ✓  |    | ✓  | Documents & Knowledge      |
|      95 | ambiguous-cleanup-task            |     H      |    | ✓  |    |    | DevOps & Env Repair        |
|      96 | research-with-adversarial-sources |     H      | ✓  |    |    | ✓  | Deep Research & Report     |
|      97 | workspace-task-record-batch       |     M      |    |    |    |    | Calendar & Task Mgmt       |
|      98 | workspace-brief-tracking          |     M      |    |    |    |    | Documents & Knowledge      |
|      99 | smarthome-sleep-quality           |     H      | ✓  | ✓  | ✓  |    | E-commerce & Daily Svcs    |
|     100 | sleep-trend-recovery1             |     M      | ✓  | ✓  | ✓  |    | Health & Fitness           |
