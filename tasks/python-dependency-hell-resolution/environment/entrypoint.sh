#!/usr/bin/env bash
set -e
# No background services for this task — the agent works on static files.
# Keep the container alive for openclaw to attach.
exec "$@"
