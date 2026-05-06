#!/usr/bin/env bash
set -euo pipefail

# Start email-app
cd /workspace/environment/email-app/backend
python3 scripts/inject_data.py
python3 app.py > /tmp/email-backend.log 2>&1 &
cd /workspace/environment/email-app/frontend
npm run dev > /tmp/email-frontend.log 2>&1 &

sleep 3
echo 'All services started'
