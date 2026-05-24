#!/bin/bash
# C1 watcher for vue-fix-rebreak
#
# Monitors /workspace/vue-crm/node_modules/vue-tsc/ — once the agent has
# installed it (signalling A2 dependency fix is complete), waits a random
# delay and then deletes it.  One-shot environmental state invalidation.
set -e

WATCH_DIR="/workspace/vue-crm"
TARGET="$WATCH_DIR/node_modules/vue-tsc"
TRIGGERED="/tmp/.c1-triggered"

# Bail if already triggered (idempotency guard)
[ -f "$TRIGGERED" ] && exit 0

# Wait until vue-tsc exists — means agent resolved A2 dependency issues
while [ ! -d "$TARGET" ]; do
  sleep 5
done

# Random delay: 60-300 s after vue-tsc appears
DELAY=$((60 + RANDOM % 241))
sleep "$DELAY"

# One-shot C1 injection
if [ ! -f "$TRIGGERED" ] && [ -d "$TARGET" ]; then
  rm -rf "$TARGET"
  : > "$TRIGGERED"
fi
