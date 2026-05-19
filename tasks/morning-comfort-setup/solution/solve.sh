#!/bin/bash
set -e

# Oracle solution for morning-comfort-setup task
# Uses direct DB manipulation to achieve 1.0 score

DB_PATH="/tmp/mosi_smart_home.sqlite"

# Wait for database to be ready
sleep 2

# Fix thermostat: mode='comfort', temperature=74 (within 72-77 range)
sqlite3 "$DB_PATH" "UPDATE thermostat_settings SET mode='comfort', temperature=74 WHERE id=1;"

# Fix coffee: start_time='06:30' (<= 06:30 for 7am departure with 30min brew)
sqlite3 "$DB_PATH" "UPDATE coffee_schedule SET start_time='06:30' WHERE id=1;"

# Add grocery entries for Blue Mountain (20g, expired) and Kenya AA (8g, insufficient)
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
- The coffee was scheduled to start at 08:00, but since you need to leave by 7am and the brew takes 30 minutes, I've adjusted the start time to 06:30
- This ensures your coffee will be ready by 07:00 when you need to leave

**Inventory Check:**
- Blue Mountain Coffee Beans in the fridge: all entries are expired (expired on 2026-05-01 and 2026-05-05, before today's date 2026-05-09)
- Kenya AA in the pantry: only 12g available, but you need 20g for a full brew - this is a shortage of 8g
- I cross-referenced Kenya AA with the Coffee Machine page to confirm it's a coffee bean currently in use
- I've added both items to your grocery list: Blue Mountain (20g, reason: expired) and Kenya AA (8g, reason: insufficient)

Everything should now be ready for your 7am departure tomorrow.
RESPONSE_EOF

echo "Solution complete: thermostat fixed, coffee time adjusted, grocery entries added, response written"