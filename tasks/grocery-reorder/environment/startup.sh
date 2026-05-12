#!/bin/bash
# Write initial orders to shop data directory
# This runs via startup_extra after shop mock initializes

set -e

mkdir -p /var/lib/mock-data/shop

# Write orders with complete OrderItem structure
cat > /var/lib/mock-data/shop/mosi_shop_orders.json << 'EOF'
[
  {
    "order_id": "ORD000001",
    "items": [
      {
        "product_id": "prod_0001",
        "title": "Organic Whole Milk, 1 Gallon",
        "price": 4.99,
        "quantity": 1,
        "image_url": "https://example.com/milk.jpg"
      }
    ],
    "status": "delivered",
    "created_at": "2026-05-10T10:00:00Z"
  },
  {
    "order_id": "ORD000002",
    "items": [
      {
        "product_id": "prod_0004",
        "title": "Salted Butter, 1 lb",
        "price": 3.49,
        "quantity": 1,
        "image_url": "https://example.com/butter.jpg"
      }
    ],
    "status": "delivered",
    "created_at": "2026-05-11T14:00:00Z"
  }
]
EOF

# Create symlink for verifier access (orders only; shop creates cart/user files)
ln -sf /var/lib/mock-data/shop/mosi_shop_orders.json /tmp/mosi_shop_orders.json