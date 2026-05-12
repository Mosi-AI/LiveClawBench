#!/bin/bash
# Reference solution for grocery-reorder task
# This script demonstrates the expected agent behavior

set -e

# Step 1: Add eggs to Shopping List in smarthome
# Target: 4 dozen = 48 pieces
# Current: 11 (fridge) + 7 (pantry) = 18 pieces
# Shortage: 48 - 18 = 30 pieces -> round up to 3 dozen = 36 pieces

# Connect to smarthome SQLite and add eggs entry
sqlite3 /tmp/mosi_smart_home.sqlite << 'SQL'
INSERT INTO grocery_product (product_id, name, quantity, unit, stock_status, reference)
VALUES ('PROD_eggs', 'Eggs', 36.0, 'pieces', 'pending', NULL);
SQL

# Step 2: Place order in shop for 3 dozen eggs
# The shop mock stores orders in JSON format

# Read existing orders
EXISTING_ORDERS=$(cat /tmp/mosi_shop_orders.json)

# Generate new order ID (next sequential)
NEW_ORDER_ID="ORD000003"

# Create new order with 3 dozen eggs
NEW_ORDER=$(cat << 'EOF'
{
  "order_id": "ORD000003",
  "items": [
    {
      "product_id": "prod_eggs",
      "title": "One Dozen of Eggs, Fresh Farm Eggs, 12 Pieces",
      "price": 5.99,
      "quantity": 3,
      "image_url": "https://example.com/eggs.jpg"
    }
  ],
  "status": "pending",
  "created_at": "2026-05-12T08:30:00Z"
}
EOF
)

# Append new order to existing orders
# Parse and merge JSON arrays
python3 << 'PYTHON'
import json

with open('/tmp/mosi_shop_orders.json', 'r') as f:
    orders = json.load(f)

new_order = {
    "order_id": "ORD000003",
    "items": [
        {
            "product_id": "prod_eggs",
            "title": "One Dozen of Eggs, Fresh Farm Eggs, 12 Pieces",
            "price": 5.99,
            "quantity": 3,
            "image_url": "https://example.com/eggs.jpg"
        }
    ],
    "status": "pending",
    "created_at": "2026-05-12T08:30:00Z"
}

orders.append(new_order)

with open('/tmp/mosi_shop_orders.json', 'w') as f:
    json.dump(orders, f, indent=2)
PYTHON

# Step 3: Update Shopping List reference with order_id
sqlite3 /tmp/mosi_smart_home.sqlite << 'SQL'
UPDATE grocery_product
SET reference = 'ORD000003'
WHERE product_id = 'PROD_eggs';
SQL

echo "Reference solution completed:"
echo "- Added Eggs (36 pieces) to Shopping List"
echo "- Placed order ORD000003 for 3 dozen eggs"
echo "- Linked order reference to Shopping List entry"
echo "- Note: Rounded up from 30 pieces shortage to 36 pieces (3 dozen)"