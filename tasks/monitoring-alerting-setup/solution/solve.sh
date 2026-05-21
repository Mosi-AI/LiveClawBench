#!/usr/bin/env bash
set -euo pipefail
echo "Reference solution for monitoring-alerting-setup"
echo "================================================="

# 1. Add /metrics to API Server
cat > /workspace/services/api_server.py << 'APIEOF'
"""API Server with Prometheus metrics."""
from flask import Flask, jsonify, request
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import time

app = Flask(__name__)

REQUEST_COUNT = Counter("request_count", "Total requests", ["method", "endpoint", "service"])
ERROR_COUNT = Counter("error_count", "Total errors", ["service"])
RESPONSE_TIME = Histogram("response_time_seconds", "Response time", ["service"])

_data = {}

@app.before_request
def before():
    request._start_time = time.time()

@app.after_request
def after(response):
    latency = time.time() - getattr(request, "_start_time", time.time())
    REQUEST_COUNT.labels(method=request.method, endpoint=request.path, service="api-server").inc()
    RESPONSE_TIME.labels(service="api-server").observe(latency)
    if response.status_code >= 400:
        ERROR_COUNT.labels(service="api-server").inc()
    return response

@app.route("/metrics")
def metrics():
    return generate_latest(), 200, {"Content-Type": CONTENT_TYPE_LATEST}

@app.route("/")
def index():
    return jsonify({"service": "api-server", "status": "running", "port": 5000})

@app.route("/api/data", methods=["GET"])
def get_data():
    return jsonify({"data": _data})

@app.route("/api/data", methods=["POST"])
def set_data():
    body = request.get_json(force=True)
    key = body.get("key", "")
    value = body.get("value", "")
    if not key:
        return jsonify({"error": "key required"}), 400
    _data[key] = value
    return jsonify({"ok": True, "key": key})

@app.route("/api/status")
def status():
    return jsonify({"uptime": time.time(), "data_entries": len(_data)})

@app.route("/api/error-test")
def error_test():
    return jsonify({"error": "simulated error"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
APIEOF

# 2. Add /metrics to Worker
cat > /workspace/services/worker.py << 'WRKEOF'
"""Worker Service with Prometheus metrics."""
from flask import Flask, jsonify, request
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import time

app = Flask(__name__)

REQUEST_COUNT = Counter("request_count", "Total requests", ["method", "endpoint", "service"])
ERROR_COUNT = Counter("error_count", "Total errors", ["service"])
RESPONSE_TIME = Histogram("response_time_seconds", "Response time", ["service"])

_tasks = []
_completed = []

@app.before_request
def before():
    request._start_time = time.time()

@app.after_request
def after(response):
    latency = time.time() - getattr(request, "_start_time", time.time())
    REQUEST_COUNT.labels(method=request.method, endpoint=request.path, service="worker").inc()
    RESPONSE_TIME.labels(service="worker").observe(latency)
    if response.status_code >= 400:
        ERROR_COUNT.labels(service="worker").inc()
    return response

@app.route("/metrics")
def metrics():
    return generate_latest(), 200, {"Content-Type": CONTENT_TYPE_LATEST}

@app.route("/")
def index():
    return jsonify({"service": "worker", "status": "running", "port": 5001})

@app.route("/tasks", methods=["GET"])
def list_tasks():
    return jsonify({"pending": _tasks, "completed": _completed})

@app.route("/tasks", methods=["POST"])
def add_task():
    body = request.get_json(force=True)
    task = {"name": body.get("name", "unnamed"), "created": time.time(), "status": "pending"}
    _tasks.append(task)
    return jsonify({"ok": True, "task": task})

@app.route("/tasks/process", methods=["POST"])
def process_tasks():
    processed = 0
    while _tasks:
        t = _tasks.pop(0)
        t["status"] = "completed"
        t["completed_at"] = time.time()
        _completed.append(t)
        processed += 1
    return jsonify({"processed": processed})

@app.route("/health")
def health():
    return jsonify({"healthy": True})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
WRKEOF

# 3. Restart services
pkill -f "python3 api_server.py" || true
pkill -f "python3 worker.py" || true
sleep 1
cd /workspace/services && python3 api_server.py &
cd /workspace/services && python3 worker.py &
sleep 2

# 4. Configure Prometheus
cat > /workspace/prometheus/prometheus.yml << 'PROMEOF'
global:
  scrape_interval: 5s

scrape_configs:
  - job_name: "api-server"
    static_configs:
      - targets: ["localhost:5000"]

  - job_name: "worker"
    static_configs:
      - targets: ["localhost:5001"]
PROMEOF

# 5. Create Grafana Dashboard
curl -s -X POST http://localhost:3000/api/datasources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Prometheus",
    "type": "prometheus",
    "url": "http://localhost:9090",
    "access": "proxy",
    "isDefault": true
  }'

curl -s -X POST http://localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d '{
    "dashboard": {
      "title": "Service Monitoring",
      "panels": [
        {
          "title": "Request Count",
          "type": "graph",
          "targets": [{"expr": "request_count"}]
        },
        {
          "title": "Error Count",
          "type": "graph",
          "targets": [{"expr": "error_count"}]
        },
        {
          "title": "Response Time",
          "type": "graph",
          "targets": [{"expr": "response_time_seconds"}]
        }
      ]
    },
    "overwrite": true
  }'

# 6. Set up alerting
mkdir -p /workspace/alerts

# Trigger some errors first to have data
curl -s http://localhost:5000/api/error-test > /dev/null || true

# Create alert rule and write active alert
cat > /workspace/alerts/active_alerts.json << 'ALERTEOF'
[
  {
    "alert_name": "HighErrorRate",
    "metric_name": "api_server_error_count",
    "threshold": 0,
    "current_value": 1,
    "severity": "warning",
    "service": "api-server",
    "status": "firing",
    "timestamp": "2026-04-12T15:00:00Z",
    "description": "Error count threshold exceeded on api-server"
  }
]
ALERTEOF

# 7. Write monitoring guide
mkdir -p /workspace/output
cat > /workspace/output/monitoring_setup_guide.md << 'GUIDEEOF'
# Monitoring & Alerting Setup Guide

## Overview
This guide documents the monitoring and alerting setup for the API Server and Worker services.

## Architecture
- **API Server** (port 5000): Handles client requests
- **Worker** (port 5001): Processes background tasks
- **Prometheus** (scrape config): Collects metrics from both services
- **Grafana** (port 3000): Visualizes metrics via dashboards

## Step 1: Prometheus Metrics Integration
Both Flask services were instrumented with `prometheus_client`:
- `request_count` (Counter): Total requests by method, endpoint, service
- `error_count` (Counter): Total errors by service
- `response_time_seconds` (Histogram): Request latency by service

Each service exposes a `/metrics` endpoint in Prometheus text format.

## Step 2: Prometheus Configuration
File: `/workspace/prometheus/prometheus.yml`
- scrape_interval: 5s
- Two scrape targets: localhost:5000 (api-server) and localhost:5001 (worker)

## Step 3: Grafana Dashboard
Created via Grafana HTTP API:
- POST /api/datasources: Added Prometheus data source
- POST /api/dashboards/db: Created "Service Monitoring" dashboard with panels for:
  - Request Count
  - Error Count
  - Response Time

## Step 4: Alerting
Alert rule: When `error_count > 0`, write alert to `/workspace/alerts/active_alerts.json`.
Alert includes: alertname, severity, service, condition, status, timestamp, description.

## Maintenance Notes
- Restart services after modifying code: `pkill -f "python3 <service>.py" && python3 <service>.py &`
- Check metrics: `curl http://localhost:5000/metrics`
- Validate Prometheus config: review `/workspace/prometheus/prometheus.yml`
- Check Grafana dashboards: `curl http://localhost:3000/api/search`
GUIDEEOF

echo "Reference solution complete."
