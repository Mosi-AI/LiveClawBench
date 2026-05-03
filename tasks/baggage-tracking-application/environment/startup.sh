#!/usr/bin/env bash
set -euo pipefail

# Start Bun mock airline backend (replacing Flask backend)
/opt/mock/bin/mock-airline --port 5000 > /tmp/mock-airline.log 2>&1 &

# Start airline-app frontend (proxies /api to port 5000)
cd /workspace/environment/airline-app/frontend
npm run dev -- --host 0.0.0.0 > /tmp/airline-frontend.log 2>&1 &

# Wait for services to start
sleep 5
echo "All services started"
