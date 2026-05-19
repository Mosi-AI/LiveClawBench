#!/bin/bash
# startup_extra for smart-home-sleep-quality task
# This runs AFTER mock binaries are already started by the platform
# Only seed data initialization and symlinks go here

# Create data directories
mkdir -p /var/lib/mock-data/smarthome
mkdir -p /var/lib/mock-data/health
mkdir -p /var/lib/mock-data/shop

# Initialize health database with seed data
# This sets system_config.current_date to 2026-05-09 and loads 30 days of health data
if [ -f /opt/mock/data/health.sql ]; then
    sqlite3 /var/lib/mock-data/health/health.db < /opt/mock/data/health.sql
fi

# Write initial orders to shop data directory for order_id pattern inference
# Existing orders: ORD000001, ORD000002, ORD000003
# New melatonin order will be ORD000004
cat > /var/lib/mock-data/shop/mosi_shop_orders.json << 'EOF'
[
  {
    "order_id": "ORD000001",
    "user_id": "default",
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
    "create_time": "2026-05-06 10:00:00",
    "shipping_address": "1234 Innovation Drive, San Francisco, CA 94105, USA"
  },
  {
    "order_id": "ORD000002",
    "user_id": "default",
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
    "create_time": "2026-05-07 14:00:00",
    "shipping_address": "1234 Innovation Drive, San Francisco, CA 94105, USA"
  },
  {
    "order_id": "ORD000003",
    "user_id": "default",
    "items": [
      {
        "product_id": "prod_0005",
        "title": "Greek Yogurt, 32 oz",
        "price": 5.99,
        "quantity": 1,
        "image_url": "https://example.com/yogurt.jpg"
      }
    ],
    "total_amount": 5.99,
    "status": "Delivered",
    "create_time": "2026-05-08 09:00:00",
    "shipping_address": "1234 Innovation Drive, San Francisco, CA 94105, USA"
  }
]
EOF

# Create symlinks for verifier access
ln -sf /var/lib/mock-data/smarthome/smarthome.db /tmp/mosi_smart_home.sqlite
ln -sf /var/lib/mock-data/health/health.db /workspace/health.db
ln -sf /var/lib/mock-data/shop/mosi_shop_orders.json /tmp/mosi_shop_orders.json
