#!/bin/bash
# Reference solution for grocery-reorder task
# This script demonstrates the expected agent behavior

set -e

# Step 1: Add eggs to Shopping List in smarthome
# Target: 4 dozen = 48 pieces
# Current: 11 (fridge) + 7 (pantry) = 18 pieces
# Shortage: 48 - 18 = 30 pieces -> round up to 3 dozen = 36 pieces

# Connect to smarthome SQLite and add eggs entry
# Note: stock_status must be one of: 'sufficient', 'insufficient', 'unavailable'
sqlite3 /tmp/mosi_smart_home.sqlite << 'SQL'
INSERT INTO grocery_product (product_id, name, quantity, unit, stock_status, reference)
VALUES ('PROD_eggs', 'Eggs', 36.0, 'pieces', 'insufficient', NULL);
SQL

# Step 2: Place order in shop for 3 dozen eggs
# The shop mock stores orders in JSON format

# Generate new order ID dynamically from existing orders
NEW_ORDER_ID=$(python3 << 'PYTHON'
import json

with open('/tmp/mosi_shop_orders.json', 'r') as f:
    orders = json.load(f)

# Find the highest order_id and increment
max_num = 0
for order in orders:
    order_id = order.get('order_id', '')
    if order_id.startswith('ORD'):
        try:
            num = int(order_id[3:])
            max_num = max(max_num, num)
        except ValueError:
            pass

new_num = max_num + 1
print(f"ORD{new_num:06d}")
PYTHON
)

echo "Generated new order ID: $NEW_ORDER_ID"

# Create new order with 3 dozen eggs using correct Order schema
python3 << PYTHON
import json
from datetime import datetime

new_order_id = "$NEW_ORDER_ID"

with open('/tmp/mosi_shop_orders.json', 'r') as f:
    orders = json.load(f)

new_order = {
    "order_id": new_order_id,
    "user_id": "Peter Griffin",
    "items": [
        {
            "product_id": "prod_eggs",
            "title": "One Dozen of Eggs, Fresh Farm Eggs, 1 Dozen",
            "price": 5.99,
            "quantity": 3,
            "image_url": "https://example.com/eggs.jpg"
        }
    ],
    "total_amount": 17.97,  # 5.99 * 3
    "status": "Pending Shipment",
    "create_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "shipping_address": "1234 Innovation Drive, San Francisco, CA 94105, USA"
}

orders.append(new_order)

with open('/tmp/mosi_shop_orders.json', 'w') as f:
    json.dump(orders, f, indent=2)

print(f"Created order: {new_order_id}")
PYTHON

# Step 3: Update Shopping List reference with order_id
sqlite3 /tmp/mosi_smart_home.sqlite "UPDATE grocery_product SET reference = '$NEW_ORDER_ID' WHERE product_id = 'PROD_eggs';"

# Step 4: Write D4 rounding explanation evidence
# This simulates the agent's final response containing rounding/conversion reasoning
mkdir -p /workspace/output
cat > /workspace/output/response.txt << EOF
I've completed the egg ordering task. Here's what I did:

1. Checked egg inventory in the smart-home app:
   - Fridge: 11 pieces
   - Pantry: 7 pieces
   - Total: 18 pieces

2. Calculated shortage against target of 4 dozen (48 pieces):
   - Missing: 48 - 18 = 30 pieces

3. Converted to dozens and rounded:
   - 30 pieces / 12 pieces per dozen = 2.5 dozen
   - Since eggs are sold by the dozen, I rounded up to 3 dozen (36 pieces)
   - This ensures we have enough eggs (36 + 18 = 54 pieces, exceeding the 48-piece target)

4. Added 36 pieces (3 dozen) to the Shopping List

5. Placed order $NEW_ORDER_ID for 3 dozen eggs in the shop

6. Updated the Shopping List entry with order reference $NEW_ORDER_ID

The rounding up from 2.5 to 3 dozen ensures we don't fall short of the target quantity.
EOF

echo "Reference solution completed:"
echo "- Added Eggs (36 pieces) to Shopping List"
echo "- Placed order $NEW_ORDER_ID for 3 dozen eggs"
echo "- Linked order reference to Shopping List entry"
echo "- Wrote rounding explanation to /workspace/output/response.txt"
