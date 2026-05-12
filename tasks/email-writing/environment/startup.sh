#!/usr/bin/env bash
set -euo pipefail

# Delegate to Bun mock startup (per-task base image provides /opt/mock/startup.d/${TASK_NAME}.sh)
sh /opt/mock/startup.d/${TASK_NAME}.sh
