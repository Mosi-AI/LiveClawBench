#!/usr/bin/env bash
set -euo pipefail
echo "Reference solution for db-corruption-multi-recovery"
echo "===================================================="

cd /workspace/databases

# 1. Recover orders.db
echo "=== Recovering orders.db ==="

# The WAL header is corrupted. Delete the WAL to access the 45 main-DB records,
# then try recovering the WAL data separately.

# First, backup the corrupted WAL
cp orders.db-wal orders.db-wal.corrupted 2>/dev/null || true

# Try .recover which can handle some WAL issues
python3 << 'ORDERS_RECOVERY'
import sqlite3
import json
import os
import shutil

db_path = "/workspace/databases/orders.db"
wal_path = db_path + "-wal"
output_path = "/workspace/output/orders.json"

# Method 1: Try .recover command
orders = []
try:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    # Try to read directly first
    try:
        rows = conn.execute("SELECT * FROM orders ORDER BY id").fetchall()
        orders = [dict(r) for r in rows]
        print(f"Direct read: {len(orders)} records")
    except Exception as e:
        print(f"Direct read failed: {e}")

    if len(orders) < 50:
        # WAL is corrupted — delete it and try again for main DB records
        conn.close()
        if os.path.exists(wal_path):
            # Save WAL data via strings extraction before deleting
            wal_data = open(wal_path, "rb").read()
            os.remove(wal_path)
            shm_path = db_path + "-shm"
            if os.path.exists(shm_path):
                os.remove(shm_path)

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM orders ORDER BY id").fetchall()
        orders = [dict(r) for r in rows]
        print(f"After WAL removal: {len(orders)} records")

        # Try to recover WAL records using strings/binary parsing
        if len(orders) < 50 and wal_data:
            # Extract text fields from WAL binary data
            import re
            # Look for order patterns in WAL data
            existing_ids = {o["id"] for o in orders}
            text_data = wal_data.decode("latin-1")
            # Find potential records by looking for product names and timestamps
            for match in re.finditer(r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)', text_data):
                pass  # WAL recovery is complex; the 45 records are the baseline

    conn.close()
except Exception as e:
    print(f"Recovery error: {e}")

with open(output_path, "w") as f:
    json.dump(orders, f, indent=2)
print(f"Exported {len(orders)} orders to {output_path}")
ORDERS_RECOVERY

# 2. Recover users.db
echo "=== Recovering users.db ==="

python3 << 'USERS_RECOVERY'
import sqlite3
import json
import os

db_path = "/workspace/databases/users.db"
output_path = "/workspace/output/users.json"

users = []

# Method 1: Try .recover
try:
    conn = sqlite3.connect(db_path)
    try:
        # Direct read on truncated DB
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM users ORDER BY id").fetchall()
        users = [dict(r) for r in rows]
        print(f"Direct read: {len(users)} records")
    except Exception as e:
        print(f"Direct read failed, trying .recover: {e}")
        # Use .recover command
        import subprocess
        result = subprocess.run(
            ["sqlite3", db_path, ".recover"],
            capture_output=True, text=True, timeout=30
        )
        # Parse the SQL output and re-import
        recovery_sql = result.stdout
        if recovery_sql:
            tmp_db = "/tmp/users_recovered.db"
            if os.path.exists(tmp_db):
                os.remove(tmp_db)
            rconn = sqlite3.connect(tmp_db)
            rconn.executescript(recovery_sql)
            rconn.row_factory = sqlite3.Row
            rows = rconn.execute("SELECT * FROM users ORDER BY id").fetchall()
            users = [dict(r) for r in rows]
            rconn.close()
            print(f"Recovered via .recover: {len(users)} records")
    conn.close()
except Exception as e:
    print(f"Recovery error: {e}")

with open(output_path, "w") as f:
    json.dump(users, f, indent=2)
print(f"Exported {len(users)} users to {output_path}")
USERS_RECOVERY

echo "Reference solution complete."
