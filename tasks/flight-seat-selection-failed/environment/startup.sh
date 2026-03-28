#!/usr/bin/env bash
set -euo pipefail

# Start airline-app backend
cd /workspace/environment/airline-app/backend
python3 run.py > /tmp/airline-backend.log 2>&1 &

# Start airline-app frontend
cd /workspace/environment/airline-app/frontend
npm run dev -- --host 0.0.0.0 > /tmp/airline-frontend.log 2>&1 &

# Start email-app backend
cd /workspace/environment/email-app/backend
python3 app.py > /tmp/email-backend.log 2>&1 &

# Start email-app frontend
cd /workspace/environment/email-app/frontend
npm run dev -- --host 0.0.0.0 > /tmp/email-frontend.log 2>&1 &

# Wait for services to start
sleep 5
echo "All services started"
