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

# Execute task-specific startup script from read-only path.
# TASK_NAME is set by the per-task Docker image (not by the agent).
TASK_STARTUP="/opt/mock/startup.d/${TASK_NAME}.sh"
if [ -f "$TASK_STARTUP" ]; then
    echo "Running startup: $TASK_STARTUP"
    # Run startup script synchronously as the non-root 'mock' user.
    # The startup script is responsible for backgrounding long-lived services
    # and blocking until they are ready (readiness probe). Running synchronously
    # here ensures the readiness probe gates agent start.
    su -s /bin/sh mock -c "$TASK_STARTUP"
fi

exec "$@"
