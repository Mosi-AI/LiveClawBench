#!/bin/bash
set -e

# Oracle solution for morning-comfort-setup task
# Uses direct DB manipulation to achieve 1.0 score

DB_PATH="/tmp/mosi_smart_home.sqlite"

# Wait for database to be ready
sleep 2

# Fix thermostat: mode='comfort', temperature=74 (within 72-77 range)
sqlite3 "$DB_PATH" "UPDATE thermostat_settings SET mode='comfort', temperature=74 WHERE id=1;"

# Keep today's coffee unchanged at 08:00 and update tomorrow's coffee to 06:30
sqlite3 "$DB_PATH" "UPDATE coffee_schedule SET start_time='06:30' WHERE schedule_date='2026-05-10';"

# Add grocery entries for Blue Mountain (>=20g, expired) and Kenya AA (>=8g, insufficient)
# Use valid stock_status values: 'insufficient' for items that need to be purchased
sqlite3 "$DB_PATH" "INSERT INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES ('PROD009', 'Blue Mountain Coffee Beans', 20.0, 'grams', 'insufficient', NULL, 'expired - all fridge entries expired before 2026-05-09');"
sqlite3 "$DB_PATH" "INSERT INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES ('PROD010', 'Kenya AA', 8.0, 'grams', 'insufficient', NULL, 'shortage - only 12g available, need 20g for brew');"

# Write response.txt for verifier D5-D8 checks
mkdir -p /workspace/output
cat > /workspace/output/response.txt << 'RESPONSE_EOF'
I've checked your smart home and found several issues that I've now fixed:

**Environmental Issues:**
- The humidity sensor is showing 999%, which is physically impossible and indicates a sensor malfunction that caused the thermostat to enter protection mode (set to "off" with temperature at 95°F); I've corrected the thermostat to "comfort" mode at 74°F, which should make the environment comfortable

**Coffee Machine:**
- Today's coffee schedule for 2026-05-09 was already set to 08:00, so I left it unchanged
- Tomorrow's coffee schedule for 2026-05-10 was also set to 08:00, but since you need to leave by 7am tomorrow and the brew takes 30 minutes, I've adjusted tomorrow's start time to 06:30
- This ensures tomorrow's coffee will be ready by 07:00 when you need to leave

**Inventory Check:**
- Blue Mountain Coffee Beans in the fridge: all entries are expired (expired on 2026-05-01 and 2026-05-05, before today's date 2026-05-09)
- The available coffee beans are not sufficient for brewing: Kenya AA in the pantry has only 12g available, but you need 20g for a full brew, so there is a shortage of 8g
- I've added both coffee bean items to your shopping list: Blue Mountain (20g, reason: expired) and Kenya AA (8g, reason: insufficient)

Everything should now be ready for your 7am departure tomorrow.
RESPONSE_EOF

echo "Solution complete: thermostat fixed, tomorrow coffee time adjusted, grocery entries added, response written"
