#!/bin/bash
set -e

echo "Starting smarthome mock service..."

# Start the smarthome backend
cd /workspace/environment/smarthome-app/backend
python3 app.py &

# Wait for service to be ready
sleep 3

echo "Smarthome mock service started on http://localhost:5003"
