#!/usr/bin/env bash
set -e

# Start monitoring dashboard mock
cd /workspace/environment/monitoring-mock && python3 app.py &

echo "[startup] Monitoring dashboard launched."
