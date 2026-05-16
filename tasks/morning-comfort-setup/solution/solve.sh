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
sqlite3 "$DB_PATH" "INSERT INTO grocery_product (product_id, name, quantity, unit, stock_status) VALUES ('PROD009', 'Blue Mountain Coffee Beans', 20.0, 'grams', 'pending');"
sqlite3 "$DB_PATH" "INSERT INTO grocery_product (product_id, name, quantity, unit, stock_status) VALUES ('PROD010', 'Kenya AA', 8.0, 'grams', 'pending');"

echo "Solution complete: thermostat fixed, coffee time adjusted, grocery entries added"
