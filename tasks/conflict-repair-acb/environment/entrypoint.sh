#!/usr/bin/env bash
set -euo pipefail

if [ -f /home/node/.openclaw/startup.sh ]; then
  bash /home/node/.openclaw/startup.sh
fi

exec "$@"
