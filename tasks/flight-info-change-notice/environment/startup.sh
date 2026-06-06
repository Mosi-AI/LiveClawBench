#!/usr/bin/env bash
set -euo pipefail

# All mock services (mock-airline on :5000, mock-email on :5001,
# mock-todolist on :5002) and the legacy URL TCP proxies (5173 -> 5000,
# 5174 -> 5001, 3000 -> 5002) are started by the per-task base image's
# ENTRYPOINT via /opt/mock/startup.d/<task>.sh, auto-generated from
# mock-platform/config/task-binary-map.json. The Bun mocks serve their
# SPAs from /opt/mock/frontend/<name>/ (pre-built at image build time).
#
# This script previously re-invoked /opt/mock/startup.d/${TASK_NAME}.sh
# explicitly, which the ENTRYPOINT already ran — the second invocation
# spawned duplicate `mock-*` and TCP-forwarder processes that all failed
# to bind their already-taken ports. Removing the redundant call eliminates
# the no-op (PR #116 review #4630227110 §New).

sleep 1
echo "All services started (mock backends + URL proxies from base entrypoint)"
