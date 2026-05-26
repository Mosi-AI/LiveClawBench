"""Verifier for watch-shop-silent-fail (C2).

Checks: order actually exists in orders.json (agent detected silent failure and retried).
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

    # Look for a recent order containing a watch
    for order in orders:
        items = order.get("items", [])
        if any("watch" in i.get("title", "").lower() for i in items):
            # Verification (0.3): order exists (agent retried)
            score = max(score, 0.3)
            # Completion (0.7): order has valid status
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
