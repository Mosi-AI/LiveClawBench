# Nova Analytics Platform — Risk Register

**Maintained by:** Dr. Sarah Kim  
**Review cycle:** Bi-weekly

## Active Risks

| ID  | Risk Description                          | Likelihood | Impact  | Mitigation                                      |
|-----|-------------------------------------------|:----------:|:-------:|-------------------------------------------------|
| R1  | Data migration scope larger than estimated| Medium     | High    | Phase migration; dry-run with production snapshot before cutover |
| R2  | Kafka CDC connector instability on legacy DB | Low      | High    | Pilot on staging DB for 4 weeks before production rollout |
| R3  | BigQuery cost overrun due to unoptimized queries | Medium | Medium | Enforce query cost caps; dbt model review gate |
| R4  | Stakeholder adoption — teams revert to old reports | Medium | High | Change management plan; deprecation timeline for legacy scripts |
| R5  | PII tokenization service latency under load | Low      | Medium  | Load test at 5× expected peak; SLA agreement with platform team |

## Retired Risks

| ID  | Risk Description                  | Resolution                                      |
|-----|-----------------------------------|-------------------------------------------------|
| R0  | GCP region availability           | Closed after multi-region architecture approved |

## Escalation Path

Critical risks (likelihood ≥ medium AND impact = high) require escalation to sponsor
James Thornton within 24 hours of identification. Status updates communicated in
weekly steering committee.
