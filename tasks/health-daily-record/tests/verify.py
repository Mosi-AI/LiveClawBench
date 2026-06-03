#!/usr/bin/env python3
"""Verify health-daily-record task by directly querying SQLite database:
1. Allergen "Crab" created with severity "mild"
2. Medication "Theraflu" created with frequency "daily", 2 slots at 09:00 and 17:00
3. Max active_energy_kcal written to /workspace/output/max_energy.txt
"""

import os
import sqlite3
import sys
import time
from datetime import date

# Database is created by mock-health binary at MOCK_DATA_DIR/health/health.db
# build-task-images.ts sets MOCK_DATA_DIR=/var/lib/mock-data at runtime.
DB_PATH = "/var/lib/mock-data/health/health.db"


def _wait_for_tables(db_path: str, required_tables, timeout: int = 60) -> None:
    """Defensive: wait for sqlite DB to exist AND contain required tables.

    Mitigates the race where the verifier runs before the mock service has
    finished schema bootstrap (Issue #108 §2.3).

    On timeout: prints a WARNING with diagnostic info (parent-dir listing)
    and RETURNS. We don't raise SystemExit because that would short-circuit
    the verifier and turn a "DB late" condition into a hard 0 — see
    GitHub issue #108 §2.3 for the underlying mock-vs-verifier race,
    and PR #113 review for the regression that motivated this design.
    The downstream sqlite3.connect() will surface a normal OperationalError
    if the file truly does not exist, which the verifier's per-anomaly
    try/except will score as 0 for that dimension only.

    Timeout can be overridden at runtime via MOCK_READY_TIMEOUT env var
    (Issue #108 §2.3 — cold-start variance on loaded CI runners).
    """
    timeout = int(os.environ.get("MOCK_READY_TIMEOUT", str(timeout)))
    deadline = time.monotonic() + timeout
    last_err = None
    while time.monotonic() < deadline:
        if os.path.isfile(db_path):
            try:
                with sqlite3.connect(db_path) as _c:
                    names = {
                        r[0]
                        for r in _c.execute(
                            "SELECT name FROM sqlite_master WHERE type='table'"
                        )
                    }
                if all(t in names for t in required_tables):
                    return
                last_err = (
                    f"missing={[t for t in required_tables if t not in names]} "
                    f"present={sorted(names)[:10]}"
                )
            except sqlite3.Error as e:
                last_err = str(e)
        time.sleep(1)
    parent = os.path.dirname(db_path) or "/"
    try:
        entries = os.listdir(parent) if os.path.isdir(parent) else "<no such dir>"
    except OSError as e:
        entries = f"<listdir failed: {e}>"
    print(
        f"WARNING: DB {db_path} not ready after {timeout}s ({last_err}); "
        f"parent {parent} contents: {entries}. "
        f"Proceeding; downstream queries will fail per-dimension if mock truly absent.",
        flush=True,
    )


_wait_for_tables(DB_PATH, ["allergen", "medication", "medication_intake_slot"])

score = 0.0
max_points = 3.0
points = 0.0


def query_db(query, params=()):
    """Execute a query and return all rows as dicts."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# Check 1: Allergen "Crab" with severity "mild"
try:
    allergens = query_db("SELECT name, severity FROM allergen WHERE archived = 0")
    found = False
    for a in allergens:
        name_lower = a["name"].lower()
        if "crab" in name_lower and a["severity"] == "mild":
            found = True
            break
    if found:
        points += 1.0
        print("PASS: Allergen 'Crab' found with severity 'mild'")
    else:
        print("FAIL: Allergen 'Crab' with severity 'mild' not found")
except Exception as e:
    print(f"FAIL: Error checking allergens: {e}")

# Check 2: Medication "Theraflu" with 2 slots at 09:00 and 17:00
try:
    medications = query_db(
        """
        SELECT m.id, m.name, m.display_name, m.frequency
        FROM medication m
        WHERE m.archived = 0
        """
    )
    found_med = None
    for m in medications:
        name = (m["name"] + " " + (m["display_name"] or "")).lower()
        if "theraflu" in name:
            found_med = m
            break

    if found_med:
        slots = query_db(
            "SELECT time_hhmm FROM medication_intake_slot WHERE medication_id = ?",
            (found_med["id"],),
        )
        times = sorted([s["time_hhmm"] for s in slots])

        if found_med["frequency"] == "daily" and len(slots) >= 2:
            has_0900 = any("09:00" in t for t in times)
            has_1700 = any("17:00" in t for t in times)
            if has_0900 and has_1700:
                points += 1.0
                print("PASS: Medication 'Theraflu' found with slots at 09:00 and 17:00")
            else:
                points += 0.5
                print(
                    f"PARTIAL: Medication found but slots are {times}, expected 09:00 and 17:00"
                )
        else:
            points += 0.5
            print(
                f"PARTIAL: Medication found but frequency={found_med['frequency']}, slots={len(slots)}"
            )
    else:
        print("FAIL: Medication 'Theraflu' not found")
except Exception as e:
    print(f"FAIL: Error checking medications: {e}")

# Check 3: Max active_energy_kcal in /workspace/output/max_energy.txt
try:
    today = date.today()
    start = today.replace(day=1).isoformat()
    end = today.isoformat()

    metrics = query_db(
        """
        SELECT value FROM health_metric_series
        WHERE metric_type = 'active_energy_kcal'
        AND date >= ? AND date <= ?
        """,
        (start, end),
    )
    values = [m["value"] for m in metrics]
    actual_max = max(values) if values else None

    with open("/workspace/output/max_energy.txt") as f:
        content = f.read().strip()

    import re

    numbers = re.findall(r"[\d.]+", content)

    if numbers and actual_max is not None:
        user_val = float(numbers[0])
        if abs(user_val - actual_max) < 1.0:
            points += 1.0
            print(f"PASS: Max energy {user_val} matches actual {actual_max}")
        else:
            points += 0.3
            print(f"PARTIAL: User wrote {user_val}, actual max is {actual_max}")
    elif numbers:
        points += 0.3
        print(f"PARTIAL: File contains {numbers[0]} but could not verify against DB")
    else:
        print(f"FAIL: File content '{content}' does not contain a number")
except FileNotFoundError:
    print("FAIL: /workspace/output/max_energy.txt not found")
except Exception as e:
    print(f"FAIL: Error checking max energy: {e}")

score = points / max_points
print(f"\nScore: {score:.2f}/1.0")
sys.exit(0 if score >= 0.5 else 1)
