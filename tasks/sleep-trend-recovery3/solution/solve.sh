#!/usr/bin/env bash
set -euo pipefail

SMARTHOME_DB="${SMARTHOME_DB:-/tmp/mosi_smart_home.sqlite}"
ORDERS_JSON="${ORDERS_JSON:-/tmp/mosi_shop_orders.json}"
mkdir -p /logs/agent

sqlite3 "$SMARTHOME_DB" "UPDATE wearable_recovery_state SET sleep_hours = 6.5, sleep_score = 60, readiness = 68, resting_heart_rate = 72 WHERE id = 1;"
sqlite3 "$SMARTHOME_DB" "UPDATE calendar_event SET title = 'Recovery Yoga', workout_type = 'yoga', updated_at = '2026-05-09T07:30:00Z' WHERE event_type = 'workout' AND workout_type IN ('hiit', 'strength', 'swimming') AND start_time BETWEEN '2026-05-10T00:00:00Z' AND '2026-05-16T23:59:59Z';"
sqlite3 "$SMARTHOME_DB" "UPDATE coffee_schedule SET start_time = '08:30', cancelled = 0, updated_at = '2026-05-09T07:30:00Z' WHERE schedule_date = '2026-05-10';"
sqlite3 "$SMARTHOME_DB" "UPDATE grocery_product SET quantity = 1, unit = 'lb', stock_status = 'sufficient', reference = 'ORD000005' WHERE name = 'Salted Butter';"
sqlite3 "$SMARTHOME_DB" "UPDATE grocery_product SET quantity = 30, unit = 'capsules', stock_status = 'sufficient', reference = 'ORD000001' WHERE name = 'CoQ10';"
sqlite3 "$SMARTHOME_DB" "INSERT OR REPLACE INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES ('omega3', 'Omega-3', 60, 'softgels', 'sufficient', NULL, 'ORD000003');"
sqlite3 "$SMARTHOME_DB" "INSERT OR REPLACE INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES ('magnesium', 'Magnesium', 60, 'tablets', 'sufficient', NULL, 'ORD000006');"
sqlite3 "$SMARTHOME_DB" "INSERT OR REPLACE INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES ('valerian-root', 'Valerian Root', 60, 'capsules', 'sufficient', NULL, 'ORD000007');"

python3 - <<'PY'
import json
from pathlib import Path
path = Path('/tmp/mosi_shop_orders.json')
orders = json.loads(path.read_text())
existing = {order['order_id'] for order in orders}
new_orders = [
    ('ORD000006', 'prod_magnesium_60', 'Magnesium 60 Tablets', 12.99),
    ('ORD000007', 'prod_valerian_60', 'Valerian Root 60 Capsules', 14.25),
]
for order_id, product_id, title, price in new_orders:
    if order_id not in existing:
        orders.append({
            'order_id': order_id,
            'user_id': 'Peter Griffin',
            'items': [{'id': product_id, 'product_id': product_id, 'title': title, 'price': price, 'quantity': 1, 'image_url': f'https://example.com/{product_id}.jpg'}],
            'total_amount': price,
            'status': 'Pending Shipment',
            'create_time': '2026-05-09 07:35:00',
            'shipping_address': '1234 Innovation Drive, San Francisco, CA 94105, USA',
        })
path.write_text(json.dumps(orders, indent=2) + '\n')
PY

cat > /logs/agent/final_response.txt <<'EOF'
I found that the health dashboard sleep total was inconsistent: it displayed 8.0 hours, but light sleep 4.09 h plus deep sleep 1.11 h plus REM sleep 1.3 h equals 6.5 hours, so I corrected the smart-home wearable sleep hours to 6.5 and readiness to 68.

The trend stats had seven displayed-versus-actual issues: Sleep Quality 7-day max showed 92% but the series peaks at 82%; Sleep Quality 30-day max showed 95% but peaks at 82%; Sleep Duration 14-day average showed 8.2 hrs but is 7.1 hrs; Sleep Duration 30-day max showed 9.5 hrs but peaks at 8.0 hrs; Low Intensity 7-day min showed 8 min but the trough is 12.9 min; High Intensity 7-day average showed 48 min but is 35 min; High Intensity 14-day average showed 22 min but is 35 min.

For yesterday's completed workouts, I counted Yoga as the completed 45-minute low-intensity activity and HIIT as the completed 30-minute high-intensity activity. I excluded Strength, Cycling, and Swimming because they were incomplete.

I changed all seven upcoming high-intensity workouts (HIIT, strength, and swim intervals) from 2026-05-10 through 2026-05-16 to recovery yoga. I left non-target meetings alone.

For coffee, I left today's 07:00 schedule unchanged and moved tomorrow's coffee to 08:30 because brewing takes about 30 minutes and the earliest tomorrow event is the 09:00 Team Standup.

For recovery supplies, I fixed Salted Butter to 1 lb with ORD000005, corrected CoQ10 to ORD000001, added Omega-3 60 softgels with ORD000003, ordered Magnesium 60 Tablets as ORD000006, and ordered Valerian Root 60 Capsules as ORD000007.
EOF
