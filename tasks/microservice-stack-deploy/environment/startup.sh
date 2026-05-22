#!/usr/bin/env bash
set -e

# Start email mock
cd /workspace/environment/email-mock && python3 app.py &

# Start legacy metrics collector
python3 /workspace/environment/scripts/metrics_stub.py &

# Start nginx with existing config
nginx 2>/dev/null || true

echo "[startup] Background services started."
