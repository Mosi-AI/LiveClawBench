#!/usr/bin/env bash
set -euo pipefail

# Start email-app backend (Flask) — verifier reads from this DB
cd /workspace/environment/email-app/backend
python3 app.py > /tmp/email-backend.log 2>&1 &

# Start email-app frontend (proxies /api to port 5001)
cd /workspace/environment/email-app/frontend
npm run dev -- --host 0.0.0.0 > /tmp/email-frontend.log 2>&1 &

sleep 5
echo "All services started"
