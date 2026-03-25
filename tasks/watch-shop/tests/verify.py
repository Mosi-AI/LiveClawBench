#!/usr/bin/env python3
"""Verify watch_shop: check order for prod_0068 (cheapest 4.6+ smart watch)"""

import json
import sys

score = 0.0
orders_path = "/tmp/mosi_shop_orders.json"
cart_path = "/tmp/mosi_shop_cart.json"

try:
    with open(orders_path) as f:
        orders = json.load(f)
    for order in orders:
        if (
            order.get("order_id") == "ORD000008"
            and order["items"][0]["id"] == "prod_0068"
            and order["status"] == "Pending Shipment"
        ):
            score = 1.0
            break
except FileNotFoundError:
    pass

if score == 0.0:
    try:
        with open(cart_path) as f:
            cart = json.load(f)
        if len(cart) == 1 and cart[0].get("id") == "prod_0068":
            score = 0.5
    except FileNotFoundError:
        pass

print(f"Score: {score}/1.0")
sys.exit(0 if score >= 0.5 else 1)
