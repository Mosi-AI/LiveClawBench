"""Verifier for watch-shop-stockout (C1).

Checks: order exists with an alternative product (not the sold-out watch).
"""

import json
import sys

ORDERS_PATH = "/tmp/mosi_shop_orders.json"


def main():
    score = 0.0
    try:
        with open(ORDERS_PATH) as f:
            orders = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        print("No orders found")
        print(f"Score: {score:.2f}/1.0")
        sys.exit(1)

    # Detection (0.3): order contains alternative product (not prod_0068)
    for order in orders:
        items = order.get("items", [])
        if not any(
            i.get("product_id") == "prod_0068" or i.get("id") == "prod_0068"
            for i in items
        ):
            if any("watch" in i.get("title", "").lower() for i in items):
                score = max(score, 0.3)
                # Recovery (0.7): alternative order completed
                if order.get("status") in (
                    "Pending Shipment",
                    "Shipped",
                    "Delivered",
                    "Completed",
                ):
                    score = 1.0
                    break

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
