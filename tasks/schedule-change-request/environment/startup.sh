#!/usr/bin/env bash
set -euo pipefail

# Start email-app backend
cd /workspace/environment/email-app/backend
python3 app.py > /tmp/email-backend.log 2>&1 &

# Start email-app frontend
cd /workspace/environment/email-app/frontend
npm run dev -- --host 0.0.0.0 > /tmp/email-frontend.log 2>&1 &

# Start todolist-app backend
cd /workspace/environment/todolist-app/backend
python3 app.py > /tmp/todolist-backend.log 2>&1 &

# Start todolist-app frontend
cd /workspace/environment/todolist-app/frontend
npm start > /tmp/todolist-frontend.log 2>&1 &

# Wait for services to start
sleep 5
echo "All services started"
