#!/bin/bash
set -e

mkdir -p /var/lib/mock-data/smarthome
mkdir -p /var/lib/mock-data/health

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
