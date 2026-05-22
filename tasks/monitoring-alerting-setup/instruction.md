# Monitoring & Alerting Setup

Your email inbox (http://localhost:5174/) contains a message from the operations manager.

## Objective

Application services are running under `/workspace/services/`, but currently have no monitoring infrastructure. Set up a complete observability infrastructure.

## Deliverables

1. All services expose Prometheus-format metrics endpoints
2. Prometheus correctly scrapes all service metrics
3. A visualization Dashboard created in Grafana
4. Alert rules configured — when triggered, write alert information to `/workspace/alerts/active_alerts.json`
5. Monitoring setup guide at `/workspace/output/monitoring_setup_guide.md`

## Alert Format Requirements

Alert records in `active_alerts.json` must contain the following fields:
- `alert_name`: Alert rule name
- `metric_name`: Name of the metric that triggered the alert (must match the actual Prometheus metric name)
- `threshold`: Alert threshold
- `current_value`: Current value
- `timestamp`: Trigger time
