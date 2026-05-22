#!/usr/bin/env python3
"""
Create golden databases, then corrupt them for the recovery task.

orders.db: WAL corruption — last 5 records only exist in WAL, and WAL header is damaged.
users.db: File truncation — file is cut at ~90% of original size.

Golden data is saved to /workspace/environment/.golden/ for verification.
"""

import json
import os
import random
import sqlite3

random.seed(42)

DB_DIR = "/workspace/databases"
GOLDEN_DIR = "/workspace/environment/.golden"
os.makedirs(DB_DIR, exist_ok=True)
os.makedirs(GOLDEN_DIR, exist_ok=True)

# ---- USERS DATA ----
FIRST_NAMES = [
    "Alice",
    "Bob",
    "Carol",
    "Dave",
    "Eve",
    "Frank",
    "Grace",
    "Henry",
    "Iris",
    "Jack",
    "Kate",
    "Leo",
    "Mia",
    "Nick",
    "Olivia",
    "Paul",
    "Quinn",
    "Rose",
    "Sam",
    "Tina",
    "Uma",
    "Victor",
    "Wendy",
    "Xander",
    "Yara",
    "Zane",
]
LAST_NAMES = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Anderson",
    "Taylor",
    "Thomas",
    "Jackson",
    "White",
    "Harris",
    "Martin",
    "Lee",
    "Clark",
    "Lewis",
]
ROLES = ["customer", "customer", "customer", "customer", "admin", "support"]

users_data = []
for i in range(1, 101):
    fn = random.choice(FIRST_NAMES)
    ln = random.choice(LAST_NAMES)
    username = f"{fn.lower()}.{ln.lower()}{i}"
    users_data.append(
        {
            "id": i,
            "username": username,
            "email": f"{username}@example.com",
            "role": random.choice(ROLES),
            "created_at": f"2026-{random.randint(1, 3):02d}-{random.randint(1, 28):02d}T{random.randint(0, 23):02d}:{random.randint(0, 59):02d}:00Z",
        }
    )

# ---- ORDERS DATA ----
PRODUCTS = [
    "Laptop Pro 16",
    "Wireless Mouse",
    "USB-C Hub",
    "Mechanical Keyboard",
    "Monitor 27in",
    "Webcam HD",
    "Headset Pro",
    "SSD 1TB",
    "RAM 32GB",
    "Power Strip",
    "desk lamp",
    "Chair Ergonomic",
    "Standing Desk",
]
STATUSES = ["completed", "pending", "shipped", "cancelled"]

orders_data = []
for i in range(1, 51):
    orders_data.append(
        {
            "id": i,
            "user_id": random.randint(1, 100),
            "product": random.choice(PRODUCTS),
            "amount": round(random.uniform(19.99, 999.99), 2),
            "status": random.choice(STATUSES),
            "created_at": f"2026-04-{random.randint(1, 14):02d}T{random.randint(0, 23):02d}:{random.randint(0, 59):02d}:00Z",
        }
    )

# ---- Save golden data ----
with open(os.path.join(GOLDEN_DIR, "orders_golden.json"), "w") as f:
    json.dump(orders_data, f, indent=2)
with open(os.path.join(GOLDEN_DIR, "users_golden.json"), "w") as f:
    json.dump(users_data, f, indent=2)

# ---- Create orders.db with WAL mode + corrupt the WAL ----
orders_db_path = os.path.join(DB_DIR, "orders.db")
conn = sqlite3.connect(orders_db_path)
conn.execute("PRAGMA journal_mode=WAL")
conn.execute("""
    CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        product TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
""")

# Insert first 45 records and checkpoint them to main DB
for order in orders_data[:45]:
    conn.execute(
        "INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?)",
        (
            order["id"],
            order["user_id"],
            order["product"],
            order["amount"],
            order["status"],
            order["created_at"],
        ),
    )
conn.commit()
conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")

# Insert last 5 records (these stay in WAL only)
for order in orders_data[45:]:
    conn.execute(
        "INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?)",
        (
            order["id"],
            order["user_id"],
            order["product"],
            order["amount"],
            order["status"],
            order["created_at"],
        ),
    )
conn.commit()
conn.close()

# Corrupt the WAL header (first 32 bytes) — makes SQLite unable to replay WAL
wal_path = orders_db_path + "-wal"
if os.path.exists(wal_path):
    with open(wal_path, "r+b") as f:
        data = f.read()
        if len(data) > 32:
            # Corrupt the salt values in the WAL header (bytes 16-23)
            corrupted = data[:16] + b"\x00" * 8 + data[24:]
            f.seek(0)
            f.write(corrupted)

# ---- Create users.db and truncate it ----
users_db_path = os.path.join(DB_DIR, "users.db")
conn = sqlite3.connect(users_db_path)
conn.execute("""
    CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
""")
for user in users_data:
    conn.execute(
        "INSERT INTO users VALUES (?, ?, ?, ?, ?)",
        (user["id"], user["username"], user["email"], user["role"], user["created_at"]),
    )
conn.commit()
conn.close()

# Truncate to ~90% of original size
orig_size = os.path.getsize(users_db_path)
truncated_size = int(orig_size * 0.90)
# Align to SQLite page boundary (4096 bytes)
truncated_size = (truncated_size // 4096) * 4096
with open(users_db_path, "r+b") as f:
    f.truncate(truncated_size)

print("orders.db created: 45 in main + 5 in corrupted WAL")
print(
    f"users.db created: 100 records, truncated from {orig_size} to {truncated_size} bytes"
)
print(f"Golden data saved to {GOLDEN_DIR}")
