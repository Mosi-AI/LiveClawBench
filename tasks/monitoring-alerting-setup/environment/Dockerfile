ARG OPENCLAW_BASE_IMAGE=liveclawbench-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

USER root

RUN pip install --break-system-packages flask prometheus_client requests

# Copy services
COPY services/ /workspace/services/
COPY email-mock/ /workspace/environment/email-mock/
COPY grafana-mock/ /workspace/environment/grafana-mock/

# Create directory structure
RUN mkdir -p /workspace/prometheus /workspace/alerts /workspace/output /logs/verifier

# Prometheus config left by a previous engineer — scrape target points at the WRONG port
# (5001 instead of 5000) and references http_requests_total (single l), which does not
# match the legacy /metrics exporter on the api server (emits http_requests_totall, double l).
RUN printf 'global:\n  scrape_interval: 15s\n\nscrape_configs:\n  - job_name: api-server\n    metrics_path: /metrics\n    static_configs:\n      - targets: [\"localhost:5001\"]\n\n# Alert rule references:\n#   - http_requests_total (canonical metric name per runbook)\n' > /workspace/prometheus/prometheus.yml

# Ops runbook copy — documents the canonical metric name as http_requests_total (single l).
# The live exporter emits http_requests_totall (double l). One of them is wrong; the
# agent has to decide which and reconcile the drift.
RUN mkdir -p /workspace/runbook && \
    printf '# Ops Runbook (2026-01)\n\n## Metrics exposed by api-server\n\n- `http_requests_total` — cumulative request counter\n- `api_data_entries` — current size of the in-memory store\n\nAlerts should fire when `http_requests_total` crosses SLO thresholds.\n' \
    > /workspace/runbook/metrics.md

COPY entrypoint.sh /entrypoint.sh
COPY startup.sh /startup.sh
RUN chmod +x /entrypoint.sh /startup.sh

HEALTHCHECK CMD true
CMD ["sleep", "infinity"]
ENTRYPOINT ["/entrypoint.sh"]
