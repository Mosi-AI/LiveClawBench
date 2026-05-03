#!/usr/bin/env bash
set -euo pipefail

# Start email-app backend (Flask) — verifier reads from this DB
cd /workspace/environment/email-app/backend
python3 app.py > /tmp/email-backend.log 2>&1 &
EMAIL_BACKEND_PID=$!

# Start email-app frontend (proxies /api to port 5001)
cd /workspace/environment/email-app/frontend
npm run dev -- --host 0.0.0.0 > /tmp/email-frontend.log 2>&1 &
EMAIL_FRONTEND_PID=$!

# Wait for email services to be ready (max 15s each)
for i in $(seq 1 30); do
  curl -sf http://localhost:5001/api/health >/dev/null 2>&1 && break
  sleep 0.5
done
for i in $(seq 1 30); do
  curl -sf http://localhost:5174/ >/dev/null 2>&1 && break
  sleep 0.5
done
echo "All services started"
