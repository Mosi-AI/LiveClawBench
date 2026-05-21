#!/bin/bash
# https_probe.sh — Continuously probe HTTPS availability every 5 seconds.
# Records probe results to a log file that the monitoring dashboard reads.
# Also tracks total downtime seconds.

PROBE_LOG="/workspace/monitoring/probe.log"
DOWNTIME_FILE="/workspace/monitoring/downtime_seconds.txt"

echo "0" > "$DOWNTIME_FILE"

while true; do
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Attempt HTTPS connection with 3-second timeout
    HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 5 https://localhost 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
        echo "$TIMESTAMP UP $HTTP_CODE" >> "$PROBE_LOG"
    else
        echo "$TIMESTAMP DOWN $HTTP_CODE" >> "$PROBE_LOG"
        # Increment downtime counter by 5 (probe interval)
        CURRENT=$(cat "$DOWNTIME_FILE" 2>/dev/null || echo "0")
        NEW=$((CURRENT + 5))
        echo "$NEW" > "$DOWNTIME_FILE"
    fi

    sleep 5
done
