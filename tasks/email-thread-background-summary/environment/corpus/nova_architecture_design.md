# Nova Analytics Platform — Architecture Design

**Version:** 0.8 (draft)  
**Author:** Marcus Osei, Architecture Lead

## Overview

The platform is built on a modern data stack with three processing layers:
ingestion, transformation, and serving.

## Technology Stack

### Ingestion Layer
- **Apache Kafka** (managed via Confluent Cloud) — real-time event streaming from
  application databases and third-party SaaS tools.
- Change-data-capture (CDC) connectors for the primary PostgreSQL transactional DB.

### Transformation Layer
- **dbt** (data build tool) — SQL-based transformation models with automated testing
  and lineage tracking.
- Scheduled runs every 15 minutes for near-real-time refresh.

### Storage / Serving Layer
- **BigQuery** (Google Cloud) — cloud data warehouse; chosen for scalable columnar
  storage and native BI tool integrations.
- Partitioned by event date; clustered by business unit for query performance.

### Visualization Layer
- Looker dashboards embedded in the internal portal.
- Self-serve exploration via BigQuery Studio for power users.

## Data Flow

```
Source DBs / SaaS
       |
    Kafka CDC
       |
   Raw tables (BigQuery)
       |
      dbt
       |
   Gold layer (analytics-ready tables)
       |
    Looker / BigQuery Studio
```

## Infrastructure Notes

- All components deployed on GCP (project: `mosi-nova-prod`).
- Data encrypted at rest (AES-256) and in transit (TLS 1.3).
- PII fields tokenized before landing in BigQuery using the in-house tokenization service.
