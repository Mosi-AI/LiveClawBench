#!/usr/bin/env python3
"""Verify mint-diet-snack-log by checking the Mint Diet SQLite final state."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

DB_PATH = Path("/var/lib/mock-data/mint-diet/mint-diet.sqlite")
TARGET_DATE = "2026-05-06"


def nearly_equal(value: float | None, expected: float, tolerance: float = 0.05) -> bool:
    return value is not None and abs(value - expected) <= tolerance


def main() -> int:
    score = 0.0

    if not DB_PATH.exists():
        print(f"Database not found: {DB_PATH}")
        print("Score: 0.0/1.0")
        return 1

    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=2)
    conn.row_factory = sqlite3.Row

    try:
        entries = conn.execute(
            """
            SELECT
              e.food_name,
              e.meal_slot,
              e.quantity_value,
              e.quantity_unit,
              e.calories_kcal,
              l.total_calories_kcal
            FROM food_entry e
            JOIN daily_log l ON l.id = e.daily_log_id
            WHERE l.log_date = ?
              AND (lower(e.food_name) = 'banana' OR e.food_name = '香蕉')
            """,
            (TARGET_DATE,),
        ).fetchall()
    finally:
        conn.close()

    if entries:
        score += 0.4

    if any(row["meal_slot"] == "snacks" for row in entries):
        score += 0.3

    if any(
        nearly_equal(row["quantity_value"], 120.0) and row["quantity_unit"] == "g"
        for row in entries
    ):
        score += 0.2

    if any(nearly_equal(row["total_calories_kcal"], 107.0) for row in entries):
        score += 0.1

    score = round(score, 2)
    print(f"Score: {score}/1.0")
    return 0 if score >= 0.5 else 1


if __name__ == "__main__":
    sys.exit(main())
