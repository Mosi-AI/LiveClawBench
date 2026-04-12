#!/bin/sh
# shared/entrypoint.sh — Secure entrypoint for LiveClawBench task containers
#
# Executes startup scripts from the read-only /opt/mock/startup.d/ directory,
# NOT from the agent-writable /workspace/ directory.
#
# Security rationale:
# - /workspace/ is writable by the agent (running as root)
# - A writable startup path allows the agent to replace startup scripts and
#   exfiltrate secrets or hijack service ports at next container restart
# - /opt/mock/startup.d/ is owned root:root with mode 755 (not writable by agent)

set -e

# Initialize data directories
mkdir -p /opt/mock/data 2>/dev/null || true

# Execute task-specific startup script from read-only path.
# TASK_NAME is set by the per-task Docker image (not by the agent).
# Run as root so the startup script can write to task-owned directories
# (e.g. /home/node/.openclaw/ owned by node:node for browser-sidecar tasks).
# The startup script backgrounds long-lived services and blocks via a
# readiness probe before returning, which gates agent start.
TASK_STARTUP="/opt/mock/startup.d/${TASK_NAME}.sh"
if [ -f "$TASK_STARTUP" ]; then
    echo "Running startup: $TASK_STARTUP"
    sh "$TASK_STARTUP"
fi

exec "$@"
