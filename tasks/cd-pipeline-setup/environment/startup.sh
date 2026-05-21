#!/usr/bin/env bash
set -euo pipefail

# Start email mock service (inbox for the agent)
cd /workspace/environment/email-mock
python3 app.py > /tmp/email-mock.log 2>&1 &

# Start sshd
/usr/sbin/sshd 2>/dev/null || true

# Start legacy health-check endpoint (leftover from previous infra)
python3 /workspace/environment/scripts/health_stub.py > /tmp/health-stub.log 2>&1 &

# Start nginx with existing config
nginx 2>/dev/null || true

sleep 2
echo "Background services started"
