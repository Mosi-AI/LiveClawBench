#!/usr/bin/env python3
"""Verify washer_shop: check order for correct product with dynamic pricing."""

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
            if not order.get("items"):
                continue
            item = order["items"][0]
            product_id = item.get("id")
            price = item.get("price", 0)

            # Optimal: prod_W01 purchased at original price (<= $300)
            if product_id == "prod_W01" and price <= 300:
                score = 1.0
                break
            # Suboptimal: prod_W02 (agent missed the window for optimal)
            if product_id == "prod_W02":
                score = 0.3
                break
    except FileNotFoundError:
        pass

    if score == 0.0:
        try:
            with open(cart_path) as f:
                cart = json.load(f)
            if len(cart) == 1:
                item = cart[0]
                product_id = item.get("id")
                price = item.get("price", 0)
                if product_id == "prod_W01" and price <= 300:
                    score = 0.5
                elif product_id == "prod_W02":
                    score = 0.3
        except FileNotFoundError:
            pass

    return score


if __name__ == "__main__":
    score = compute_score()
    print(f"Score: {score}/1.0")
    sys.exit(0 if score >= 0.3 else 1)
