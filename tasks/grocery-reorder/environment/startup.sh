#!/bin/bash
# Write initial orders to shop data directory
# This runs via startup_extra after shop mock initializes

set -e

mkdir -p /var/lib/mock-data/shop

# Write orders with correct Order schema matching shop mock types.ts:
# - order_id, user_id, items, total_amount, status, create_time, shipping_address
# - status uses capitalized format (Delivered, Pending Shipment, etc.)
# - create_time format: "YYYY-MM-DD HH:MM:SS" (not ISO format with T)

cat > /var/lib/mock-data/shop/mosi_shop_orders.json << 'EOF'
[
  {
    "order_id": "ORD000001",
    "user_id": "Peter Griffin",
    "items": [
      {
        "product_id": "prod_0001",
        "title": "Organic Whole Milk, 1 Gallon",
        "price": 4.99,
        "quantity": 1,
        "image_url": "https://example.com/milk.jpg"
      }
    ],
    "total_amount": 4.99,
    "status": "Delivered",
    "create_time": "2026-05-10 10:00:00",
    "shipping_address": "1234 Innovation Drive, San Francisco, CA 94105, USA"
  },
  {
    "order_id": "ORD000002",
    "user_id": "Peter Griffin",
    "items": [
      {
        "product_id": "prod_0004",
        "title": "Salted Butter, 1 lb",
        "price": 3.49,
        "quantity": 1,
        "image_url": "https://example.com/butter.jpg"
      }
    ],
    "total_amount": 3.49,
    "status": "Delivered",
    "create_time": "2026-05-11 14:00:00",
    "shipping_address": "1234 Innovation Drive, San Francisco, CA 94105, USA"
  }
]
EOF

# Create symlink for verifier access (orders only; shop creates cart/user files)
ln -sf /var/lib/mock-data/shop/mosi_shop_orders.json /tmp/mosi_shop_orders.json
