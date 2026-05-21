#!/usr/bin/env bash
set -e

# Start email mock
cd /workspace/environment/email-mock && python3 app.py &

# Start Grafana mock
cd /workspace/environment/grafana-mock && python3 app.py &

# Start Flask services
cd /workspace/services && python3 api_server.py &
cd /workspace/services && python3 worker.py &

echo "[startup] All services launched."
