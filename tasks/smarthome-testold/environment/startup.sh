#!/bin/bash
set -e

echo "Starting smarthome mock service..."

# fastapi-required: Start the smarthome backend (disabled when using Bun mock)
# cd /workspace/environment/smarthome-app/backend
# python3 app.py &

# Wait for service to be ready
sleep 3

echo "Smarthome mock service started on http://localhost:5004"
