#!/usr/bin/env bash
set -euo pipefail

# Start email mock service (inbox with DBA alert)
cd /workspace/environment/email-mock
python3 app.py > /tmp/email-mock.log 2>&1 &

sleep 2
echo "Background services started (email-mock on :5174)"
