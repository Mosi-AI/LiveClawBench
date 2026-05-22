#!/usr/bin/env bash
set -e

# Start email mock
cd /workspace/environment/email-mock && python3 app.py &

echo "[startup] Email mock launched."
