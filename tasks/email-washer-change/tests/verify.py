#!/usr/bin/env python3
"""Verify email_washer_change: check refund + new order for prod_0074 after reading email"""

import json
import sys

score = 0.0
orders_path = "/tmp/mosi_shop_orders.json"

try:
    with open(orders_path) as f:
        orders = json.load(f)
    is_refund = any(
        o.get("order_id") == "ORD000005" and o["status"] == "Returning" for o in orders
    )
    is_purchase = any(
        o.get("order_id") == "ORD000008"
        and o["items"][0]["id"] == "prod_0074"
        and o["status"] == "Pending Shipment"
        for o in orders
    )
    if is_refund and is_purchase:
        score = 1.0
    elif is_refund:
        score = 0.5
except FileNotFoundError:
    pass

print(f"Score: {score}/1.0")
sys.exit(0 if score >= 0.5 else 1)
