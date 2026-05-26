#!/usr/bin/env bash
set -euo pipefail

mkdir -p /var/lib/mock-data/health /var/lib/mock-data/smarthome /var/lib/mock-data/shop /workspace /logs/verifier /logs/agent

if [ ! -f /opt/mock/data/health.sql ]; then
  echo "missing /opt/mock/data/health.sql" >&2
  exit 1
fi
if [ ! -f /opt/mock/data/smarthome.sql ]; then
  echo "missing /opt/mock/data/smarthome.sql" >&2
  exit 1
fi
if [ ! -f /opt/mock/data/shop-orders.json ]; then
  echo "missing /opt/mock/data/shop-orders.json" >&2
  exit 1
fi

sqlite3 /var/lib/mock-data/health/health.db < /opt/mock/data/health.sql
sqlite3 /var/lib/mock-data/smarthome/smarthome.db < /opt/mock/data/smarthome.sql
cp /opt/mock/data/shop-orders.json /var/lib/mock-data/shop/mosi_shop_orders.json
printf '[]\n' > /var/lib/mock-data/shop/mosi_shop_cart.json

ln -sf /var/lib/mock-data/health/health.db /workspace/health.db
ln -sf /var/lib/mock-data/smarthome/smarthome.db /tmp/mosi_smart_home.sqlite
ln -sf /var/lib/mock-data/shop/mosi_shop_orders.json /tmp/mosi_shop_orders.json

sqlite3 /workspace/health.db "SELECT COUNT(*) FROM health_daily_snapshot WHERE user_id = 1 AND date = '2026-05-09' AND sleep_hours = 8.0 AND light_sleep_hours = 4.09 AND deep_sleep_hours = 1.11 AND rem_sleep_hours = 1.3;" | grep -qx "1"
sqlite3 /workspace/health.db "SELECT COUNT(*) FROM health_trend_override WHERE user_id = 1;" | grep -qx "7"
sqlite3 /tmp/mosi_smart_home.sqlite "SELECT COUNT(*) FROM calendar_event WHERE start_time BETWEEN '2026-05-10T00:00:00Z' AND '2026-05-16T23:59:59Z' AND workout_type IN ('hiit', 'strength', 'swimming');" | grep -qx "7"
sqlite3 /tmp/mosi_smart_home.sqlite "SELECT COUNT(DISTINCT workout_type) FROM calendar_event WHERE start_time BETWEEN '2026-05-10T00:00:00Z' AND '2026-05-16T23:59:59Z' AND workout_type IN ('hiit', 'strength', 'swimming');" | grep -qx "3"
sqlite3 /tmp/mosi_smart_home.sqlite "SELECT COUNT(*) FROM grocery_product WHERE name = 'CoQ10' AND stock_status = 'sufficient' AND reference = 'ORD000003';" | grep -qx "1"
python3 - <<'PY'
import json
from pathlib import Path
orders = json.loads(Path('/tmp/mosi_shop_orders.json').read_text())
assert [order['order_id'] for order in orders] == ['ORD000001', 'ORD000002', 'ORD000003', 'ORD000004', 'ORD000005']
PY
