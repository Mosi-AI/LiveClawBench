#!/usr/bin/env python3
"""Verify watch_shop: check order for prod_0068 (cheapest 4.6+ smart watch)"""

import json
import sys

ORDERS_PATH = "/tmp/mosi_shop_orders.json"
CART_PATH = "/tmp/mosi_shop_cart.json"


def compute_score(orders_path: str = ORDERS_PATH, cart_path: str = CART_PATH) -> float:
    """Return score based on orders and cart files."""
    score = 0.0

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

    return score


if __name__ == "__main__":
    score = compute_score()
    print(f"Score: {score}/1.0")
    sys.exit(0 if score >= 0.5 else 1)
