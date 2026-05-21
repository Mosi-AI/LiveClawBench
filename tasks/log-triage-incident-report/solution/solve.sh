#!/usr/bin/env bash
set -euo pipefail
echo "Reference solution for log-triage-incident-report"
echo "================================================="

mkdir -p /workspace/output

cat > /workspace/output/incident_report.md << 'REPORTEOF'
# Incident Report: Service Degradation (2026-04-12)

## Summary

On April 12, 2026, between 14:20 and 15:00 UTC, the production web application experienced
severe degradation with over 60% of requests failing. The root cause was a long-running
analytics query that exhausted the PostgreSQL connection pool, causing cascading failures
through the application server to the Nginx reverse proxy.

## Timeline

1. **14:20:03** — A heavy analytics query was executed against the PostgreSQL database:
   `SELECT user_id, COUNT(*) ... FROM transactions GROUP BY user_id HAVING COUNT(*) > 100`
   This query scanned an estimated 15 million rows and held a database connection for ~5 minutes.

2. **14:20–14:25** — While the analytics query ran, normal application requests continued
   to open new database connections. The connection count steadily climbed toward the
   `max_connections = 50` limit.

3. **14:25:01** — The analytics query completed after 300 seconds, but by this point
   accumulated connections had already reached the limit.

4. **14:25:15** — PostgreSQL began rejecting new connections with:
   `FATAL: sorry, too many clients already (max_connections = 50)`

5. **14:28:05** — The Flask application server's SQLAlchemy connection pool began timing
   out after 30-second waits. Retry attempts (3 retries) all failed.

6. **14:30:00** — Nginx started returning 502 Bad Gateway and 504 Gateway Timeout errors
   as the upstream application server could not handle requests.

7. **14:35–15:00** — Error rates stabilized at ~62% as some cached/static responses
   continued to work while all database-dependent endpoints failed.

## Root Cause Analysis

The root cause was **database connection pool exhaustion** triggered by a long-running
analytics query. The causal chain:

1. **Trigger**: An analytics query (`GROUP BY` on 15M row `transactions` table) was
   executed, likely by a reporting job or manual query.

2. **Connection accumulation**: While this query held a connection for 5+ minutes,
   normal application traffic continued opening new connections. PostgreSQL's
   `max_connections` was set to only 50.

3. **Pool saturation**: Once all 50 connections were in use, PostgreSQL refused new
   connections with a `FATAL` error.

4. **Application failure**: The Flask app's SQLAlchemy connection pool (QueuePool, limit 10)
   could not acquire new connections, causing 30-second timeouts and 500 errors.

5. **Nginx cascade**: With the upstream app returning errors, Nginx relayed these as
   502/504 responses to end users.

**Contributing factors**:
- `max_connections = 50` is too low for production workload
- No query timeout or resource limits for analytics queries
- Application lacks circuit breaker pattern for database failures
- No connection pooler (like PgBouncer) between app and database

## Impact

- **Duration**: ~40 minutes (14:20 to ~15:00)
- **Affected users**: All users making database-dependent API requests (~62% error rate)
- **Services affected**: All three tiers (Database → Application → Nginx)
- **Data loss**: None (read-only failures, no data corruption)
- **Static assets**: Unaffected (Nginx served cached content normally)

## Recommendations

1. **Immediate**:
   - Increase `max_connections` to at least 200
   - Set `statement_timeout` to prevent queries running longer than 60 seconds
   - Restart application to clear stale connection pool

2. **Short-term**:
   - Deploy PgBouncer as a connection pooler between application and database
   - Add circuit breaker in Flask app (e.g., using `pybreaker` library)
   - Separate analytics/reporting queries to a read replica

3. **Long-term**:
   - Implement query review process for analytics workloads
   - Add monitoring alerts for connection pool usage (>80% threshold)
   - Set up database connection pool metrics in Prometheus/Grafana
   - Document incident response procedures for database connection issues
REPORTEOF

echo "Reference solution complete."
