#!/bin/sh
# shared/entrypoint.sh — Secure entrypoint for LiveClawBench task containers
#
# Executes startup scripts from the read-only /opt/mock/startup.d/ directory,
# NOT from the agent-writable /workspace/ directory.
#
# Security rationale:
# - /workspace/ is writable by the agent (running as root)
# - A writable startup path allows the agent to exfiltrate secrets or replace binary paths
# - /opt/mock/startup.d/ is read-only (root:root), preventing agent tampering

set -e

# Initialize data directories
mkdir -p /opt/mock/data 2>/dev/null || true

# Execute task-specific startup script from read-only path
TASK_STARTUP="/opt/mock/startup.d/${TASK_NAME:-default}.sh"
if [ -f "$TASK_STARTUP" ]; then
    echo "Running startup: $TASK_STARTUP"
    . "$TASK_STARTUP"
else
    echo "No startup script found at $TASK_STARTUP (task: ${TASK_NAME:-default})"
fi

# NEVER source or execute /workspace/startup.sh
# The agent can modify /workspace/ files to exfiltrate secrets

exec "$@"
