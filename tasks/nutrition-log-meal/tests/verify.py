#!/usr/bin/env python3
"""Verify nutrition-log-meal by checking food entries in Mint Diet SQLite database."""

from __future__ import annotations

import datetime
import os
import sqlite3
import sys
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DB_PATH = Path("/var/lib/mock-data/mint-diet/mint-diet.sqlite")


def get_today() -> str:
    """Get today's date in YYYY-MM-DD format."""
    tz = os.environ.get("TZ", "UTC")
    try:
        today = datetime.datetime.now(ZoneInfo(tz)).date()
    except ZoneInfoNotFoundError:
        today = datetime.datetime.now(ZoneInfo("UTC")).date()
    return today.strftime("%Y-%m-%d")


def check_milk_entry(conn: sqlite3.Connection, today: str) -> bool:
    """Check if milk entry exists in today's lunch slot."""
    cursor = conn.execute(
        """
        SELECT fe.id
        FROM food_entry fe
        JOIN daily_log dl ON fe.daily_log_id = dl.id
        WHERE dl.log_date = ?
          AND fe.meal_slot = 'lunch'
          AND (fe.food_name COLLATE NOCASE = 'milk' OR fe.food_name = '牛奶')
          AND fe.quantity_value > 0
        """,
        (today,),
    )
    return cursor.fetchone() is not None


def check_chicken_salad_entry(conn: sqlite3.Connection, today: str) -> bool:
    """Check if chicken salad entry exists in today's lunch slot."""
    cursor = conn.execute(
        """
        SELECT fe.id
        FROM food_entry fe
        JOIN daily_log dl ON fe.daily_log_id = dl.id
        WHERE dl.log_date = ?
          AND fe.meal_slot = 'lunch'
          AND fe.food_name COLLATE NOCASE LIKE '%chicken salad%'
          AND fe.quantity_value > 0
        """,
        (today,),
    )
    return cursor.fetchone() is not None


def main() -> int:
    score = 0.0
    today = get_today()

    if not DB_PATH.exists():
        print(f"Database not found: {DB_PATH}")
        print("Score: 0.0/1.0")
        return 1

    try:
        conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=2)
        conn.row_factory = sqlite3.Row
    except sqlite3.Error as e:
        print(f"Failed to open database: {e}")
        print("Score: 0.0/1.0")
        return 1

    try:
        if check_milk_entry(conn, today):
            score += 0.50

        if check_chicken_salad_entry(conn, today):
            score += 0.50

    except sqlite3.Error as e:
        print(f"Database query error: {e}")
        print("Score: 0.0/1.0")
        return 1
    finally:
        conn.close()

    score = round(score, 2)
    print(f"Score: {score}/1.0")
    return 0 if score >= 0.5 else 1


if __name__ == "__main__":
    sys.exit(main())
