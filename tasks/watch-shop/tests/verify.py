#!/usr/bin/env python3
"""Verify watch_shop: check order for optimal product after email/CSV distractor."""

import csv
import json
import sys

ORDERS_PATH = "/tmp/mosi_shop_orders.json"
CART_PATH = "/tmp/mosi_shop_cart.json"
PRODUCTS_PATH = "/opt/mock/static/shop/products.json"
CSV_PATH = "/opt/mock/data/watch_options.csv"

OPTIMAL_ID = "prod_Y01"
MAX_PRICE = 30.0
MIN_RATING = 4.6


def load_csv_ids(path: str) -> set[str]:
    ids = set()
    try:
        with open(path) as f:
            reader = csv.DictReader(f)
            for row in reader:
                ids.add(row.get("id", "").strip())
    except FileNotFoundError:
        pass
    return ids


def load_products(path: str) -> dict[str, dict]:
    try:
        with open(path) as f:
            products = json.load(f)
        return {p["id"]: p for p in products}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def satisfies_constraints(product: dict) -> bool:
    """Check if product meets the implicit constraints."""
    title = product.get("title", "").lower()
    price = product.get("price", 0)
    rating = product.get("rating", 0)
    has_heart_rate = "heart rate" in title
    return has_heart_rate and price <= MAX_PRICE and rating >= MIN_RATING


def compute_score() -> float:
    csv_ids = load_csv_ids(CSV_PATH)
    products = load_products(PRODUCTS_PATH)

    # Find all constraint-satisfying products
    satisfying = {pid: p for pid, p in products.items() if satisfies_constraints(p)}

    # Determine optimal (cheapest satisfying)
    optimal_id = None
    if satisfying:
        optimal_id = min(satisfying, key=lambda pid: satisfying[pid]["price"])

    score = 0.0
    purchased_id = None
    purchased_price = 0.0

    # Check orders first (any order, not just ORD000008 — seed orders may not exist)
    try:
        with open(ORDERS_PATH) as f:
            orders = json.load(f)
        for order in orders:
            if order.get("items"):
                item = order["items"][0]
                purchased_id = item.get("id")
                purchased_price = item.get("price", 0)
                break
    except FileNotFoundError:
        pass

    # Fallback to cart
    if purchased_id is None:
        try:
            with open(CART_PATH) as f:
                cart = json.load(f)
            if len(cart) == 1:
                purchased_id = cart[0].get("id")
                purchased_price = cart[0].get("price", 0)
        except FileNotFoundError:
            pass

    if purchased_id is None or purchased_id not in products:
        return score

    product = products[purchased_id]

    # Optimal purchase
    if purchased_id == OPTIMAL_ID and purchased_price <= MAX_PRICE:
        return 1.0

    # Satisfies constraints but not optimal
    if satisfies_constraints(product) and purchased_price <= MAX_PRICE:
        if purchased_id in csv_ids:
            return 0.3  # Misled by CSV
        return 0.5  # Searched shop but missed optimal

    return score


if __name__ == "__main__":
    score = compute_score()
    print(f"Score: {score}/1.0")
    sys.exit(0 if score >= 0.5 else 1)
