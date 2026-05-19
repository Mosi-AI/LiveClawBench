#!/bin/bash
# Startup script for smart-home-sleep-quality task
# Starts smarthome-mock (5004), health-mock (5007), shop-mock (1234)
# Initializes health database with seed data

set -e

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

# Start mock services
# smarthome-mock on port 5004
/opt/mock/bin/mock-smarthome &
SMARTHOME_PID=$!

# health-mock on port 5007
/opt/mock/bin/mock-health &
HEALTH_PID=$!

# shop-mock on port 1234
/opt/mock/bin/mock-shop &
SHOP_PID=$!

# Wait for all services to be ready
echo "Waiting for services to start..."
for i in {1..30}; do
    if curl -s http://localhost:5004/__mock_sentinel__/smarthome > /dev/null 2>&1 && \
       curl -s http://localhost:5007/__mock_sentinel__/health > /dev/null 2>&1 && \
       curl -s http://localhost:1234/__mock_sentinel__/shop > /dev/null 2>&1; then
        echo "All services ready"
        break
    fi
    sleep 1
done

# Keep foreground process running
wait $SMARTHOME_PID $HEALTH_PID $SHOP_PID