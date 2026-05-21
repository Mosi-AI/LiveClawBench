#!/bin/bash
# Start background services before any command
if [ -f /workspace/startup.sh ]; then
    bash /workspace/startup.sh &
elif [ -f /workspace/environment/startup.sh ]; then
    bash /workspace/environment/startup.sh &
fi
sleep 5
exec "$@"
