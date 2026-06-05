#!/usr/bin/env bash
set -euo pipefail

# All mock services (mock-airline on :5000, mock-email on :5001) and the
# legacy URL TCP proxies (5173 -> 5000, 5174 -> 5001) are started by the
# per-task base image's ENTRYPOINT via /opt/mock/startup.d/<task>.sh,
# auto-generated from mock-platform/config/task-binary-map.json. The Bun
# mock-airline binary serves the SPA from /opt/mock/frontend/airline/
# (pre-built from tasks/flight-seat-selection/environment/airline-app/frontend/
# at image build time), so `localhost:5173/` reaches the airline UI via
# the port proxy without needing a Vite dev server here.
#
# This script previously started `python3 app.py` for the email backend on
# port 5001. After PR-3 swapped the backend to mock-email, that line raced
# the mock binary for the same port and silently failed. Removed the dead
# Flask startup (PR #116 review #4630227110 §New).

sleep 1
echo "All services started (mock backends + URL proxies from base entrypoint)"
