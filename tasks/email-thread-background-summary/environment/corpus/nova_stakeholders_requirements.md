# Nova Analytics Platform — Stakeholders & Business Requirements

**Author:** Priya Nair, Business Analyst

## Primary Stakeholder Groups

### Marketing Team
- **Contact:** Lisa Torres (VP Marketing)
- **Need:** Daily campaign performance dashboards; attribution reporting across channels.
- **Current pain:** Reports arrive 3 days late; attribution logic inconsistent across tools.

### Finance Team
- **Contact:** Alan Marsh (Finance Director)
- **Need:** Monthly P&L roll-up with drill-down by cost center; budget vs actuals.
- **Current pain:** Manual Excel consolidation takes two analysts 4 days each month-end.

### Sales Operations
- **Contact:** Jenny Park (Sales Ops Lead)
- **Need:** Real-time pipeline visibility; rep productivity metrics; quota attainment.
- **Current pain:** CRM data is stale by 24 hours; no unified view with finance data.

## Functional Requirements

1. Data freshness: Marketing and Sales data refreshed every 15 minutes; Finance daily.
2. Row-level security: each business unit sees only its own cost-center data by default.
3. Historical depth: at least 3 years of transactional history available at launch.
4. Audit trail: all data transformations logged with model version and run timestamp.

## Non-Functional Requirements

- 99.5% uptime SLA for the serving layer during business hours (07:00–22:00 local).
- Query response time ≤ 5 seconds for 95th-percentile dashboard loads.
- Disaster recovery: RPO 1 hour, RTO 4 hours.
