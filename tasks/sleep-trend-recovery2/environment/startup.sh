#!/bin/bash
set -euo pipefail

mkdir -p /var/lib/mock-data/smarthome
mkdir -p /var/lib/mock-data/health
mkdir -p /workspace

if [ -f /opt/mock/data/health.sql ]; then
    sqlite3 /var/lib/mock-data/health/health.db "
    DELETE FROM health_metric_series;
    DELETE FROM health_daily_snapshot;
    DELETE FROM system_config WHERE key IN ('current_date', 'current_time');
    "
    sqlite3 /var/lib/mock-data/health/health.db < /opt/mock/data/health.sql
fi

ln -sf /var/lib/mock-data/smarthome/smarthome.db /tmp/mosi_smart_home.sqlite
ln -sf /var/lib/mock-data/health/health.db /workspace/health.db

sqlite3 /workspace/health.db "SELECT COUNT(*) FROM health_daily_snapshot WHERE user_id = 1 AND date = '2026-05-09' AND sleep_quality = 52;" | grep -qx "1"
sqlite3 /tmp/mosi_smart_home.sqlite "SELECT COUNT(*) FROM coffee_schedule WHERE schedule_date IN ('2026-05-09', '2026-05-10') AND start_time = '07:00';" | grep -qx "2"
sqlite3 /tmp/mosi_smart_home.sqlite "SELECT COUNT(*) FROM calendar_event WHERE title = 'HIIT Workout' AND start_time = '2026-05-10T12:00:00Z' AND workout_type = 'hiit';" | grep -qx "1"
