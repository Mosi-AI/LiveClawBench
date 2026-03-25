"""Generate realistic sample sales data for the ETL pipeline benchmark."""

import csv
import json
import os
import random
from datetime import datetime, timedelta

random.seed(42)

PRODUCTS = [
    {
        "id": "P001",
        "name": "Wireless Mouse",
        "category": "Electronics",
        "unit_cost": 8.50,
        "list_price": 24.99,
    },
    {
        "id": "P002",
        "name": "USB-C Hub",
        "category": "Electronics",
        "unit_cost": 15.00,
        "list_price": 49.99,
    },
    {
        "id": "P003",
        "name": "Mechanical Keyboard",
        "category": "Electronics",
        "unit_cost": 35.00,
        "list_price": 89.99,
    },
    {
        "id": "P004",
        "name": "Notebook A5",
        "category": "Office",
        "unit_cost": 1.20,
        "list_price": 5.99,
    },
    {
        "id": "P005",
        "name": "Ballpoint Pen (12pk)",
        "category": "Office",
        "unit_cost": 2.00,
        "list_price": 8.99,
    },
    {
        "id": "P006",
        "name": "Desk Lamp LED",
        "category": "Furniture",
        "unit_cost": 12.00,
        "list_price": 34.99,
    },
    {
        "id": "P007",
        "name": "Monitor Stand",
        "category": "Furniture",
        "unit_cost": 18.00,
        "list_price": 59.99,
    },
    {
        "id": "P008",
        "name": "Webcam HD",
        "category": "Electronics",
        "unit_cost": 20.00,
        "list_price": 64.99,
    },
    {
        "id": "P009",
        "name": "Whiteboard Markers (8pk)",
        "category": "Office",
        "unit_cost": 3.00,
        "list_price": 12.99,
    },
    {
        "id": "P010",
        "name": "Ergonomic Chair Cushion",
        "category": "Furniture",
        "unit_cost": 10.00,
        "list_price": 29.99,
    },
]

REGIONS = ["North", "South", "East", "West"]
CHANNELS = ["online", "retail", "wholesale"]


def generate_transactions(n=500):
    rows = []
    start = datetime(2024, 1, 1)
    txn_id = 1000

    for _ in range(n):
        prod = random.choice(PRODUCTS)
        qty = random.randint(1, 20)
        region = random.choice(REGIONS)
        channel = random.choice(CHANNELS)
        date = start + timedelta(days=random.randint(0, 89))

        # Introduce realistic data quality issues
        r = random.random()

        row = {
            "transaction_id": f"TXN-{txn_id}",
            "date": date.strftime("%Y-%m-%d"),
            "product_id": prod["id"],
            "product_name": prod["name"],
            "category": prod["category"],
            "quantity": qty,
            "unit_price": round(prod["list_price"] * random.uniform(0.85, 1.0), 2),
            "region": region,
            "channel": channel,
        }

        # ~5% missing quantity
        if r < 0.05:
            row["quantity"] = ""
        # ~3% missing product_id
        elif r < 0.08:
            row["product_id"] = ""
        # ~3% negative price (data entry error)
        elif r < 0.11:
            row["unit_price"] = -abs(row["unit_price"])
        # ~4% duplicate rows
        elif r < 0.15 and rows:
            dup = dict(random.choice(rows))
            dup["transaction_id"] = f"TXN-{txn_id}"  # different txn_id but same data
            row = dup
            row["transaction_id"] = f"TXN-{txn_id}"
        # ~2% unknown product_id
        elif r < 0.17:
            row["product_id"] = "P999"
        # ~2% future date
        elif r < 0.19:
            row["date"] = "2025-12-31"

        rows.append(row)
        txn_id += 1

    return rows


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Generate product catalog
    catalog_path = os.path.join(script_dir, "product_catalog.json")
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump({"products": PRODUCTS}, f, indent=2)
    print(f"Written {len(PRODUCTS)} products to {catalog_path}")

    # Generate transactions
    transactions = generate_transactions(500)
    csv_path = os.path.join(script_dir, "sales_transactions_2024_q1.csv")
    fields = [
        "transaction_id",
        "date",
        "product_id",
        "product_name",
        "category",
        "quantity",
        "unit_price",
        "region",
        "channel",
    ]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(transactions)
    print(f"Written {len(transactions)} transactions to {csv_path}")


if __name__ == "__main__":
    main()
