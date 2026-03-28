#!/usr/bin/env bash
set -euo pipefail

# Start airline-app backend
cd /workspace/environment/airline-app/backend
python3 run.py > /tmp/airline-backend.log 2>&1 &

# Start airline-app frontend
cd /workspace/environment/airline-app/frontend
npm run dev -- --host 0.0.0.0 > /tmp/airline-frontend.log 2>&1 &

# Wait for services to start
sleep 5
echo "All services started"
