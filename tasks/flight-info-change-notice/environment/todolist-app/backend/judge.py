#!/usr/bin/env python3
"""
Judge script to check if injected todos have been cleared from the database.
Verifies that the three todos defined in inject_data_manual.py::get_user_todos()
have been removed.
"""

import sqlite3
import sys
from datetime import datetime, timedelta

from config import DATABASE_PATH


def get_expected_todos():
    """
    Get the expected todo items that should be cleared.
    These match the todos defined in inject_data_manual.py::get_user_todos()
    """
    # Calculate Sunday of the current week (same logic as in inject_data_manual.py)
    today = datetime.now()
    days_until_sunday = 6 - today.weekday()
    sunday_date = today + timedelta(days=days_until_sunday)
    sunday_str = sunday_date.strftime("%Y-%m-%d")

    return [
        {
            "title": "Game party w/ my old friends",
            "date": sunday_str,
            "time": "10:00",
        },
        {
            "title": "Morning run",
            "date": sunday_str,
            "time": "7:00",
        },
        {
            "title": "Book club meeting",
            "date": sunday_str,
            "time": "19:00",
        },
    ]


def check_todos_cleared():
    """
    Check if the injected todos have been cleared from the database.

    Returns:
        tuple: (all_cleared: bool, found_todos: list, missing_todos: list)
    """
    expected_todos = get_expected_todos()

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    found_todos = []
    missing_todos = []

    for todo in expected_todos:
        cursor.execute(
            """
            SELECT id, title, date, time
            FROM todos
            WHERE title = ? AND date = ? AND time = ?
        """,
            (todo["title"], todo["date"], todo["time"]),
        )

        result = cursor.fetchone()

        if result:
            found_todos.append(
                {
                    "id": result[0],
                    "title": result[1],
                    "date": result[2],
                    "time": result[3],
                }
            )
        else:
            missing_todos.append(todo)

    conn.close()

    all_cleared = len(found_todos) == 0
    return all_cleared, found_todos, missing_todos


def main():
    """Main entry point for the judge script."""
    print("=" * 70)
    print("Checking if injected todos have been cleared...")
    print("=" * 70)

    all_cleared, found_todos, missing_todos = check_todos_cleared()

    print(f"\nExpected todos to be cleared: {len(found_todos) + len(missing_todos)}")
    print(f"Still in database: {len(found_todos)}")
    print(f"Successfully cleared: {len(missing_todos)}")
    print()

    if found_todos:
        print("❌ Found todos that should have been cleared:")
        print("-" * 70)
        for todo in found_todos:
            print(f"  ID: {todo['id']}")
            print(f"  Title: {todo['title']}")
            print(f"  Date: {todo['date']}")
            print(f"  Time: {todo['time']}")
            print()

    if missing_todos:
        print("✓ Todos that were successfully cleared:")
        print("-" * 70)
        for todo in missing_todos:
            print(f"  Title: {todo['title']}")
            print(f"  Date: {todo['date']}")
            print(f"  Time: {todo['time']}")
            print()

    print("=" * 70)
    if all_cleared:
        print("✅ JUDGE RESULT: PASSED - All injected todos have been cleared!")
        print("=" * 70)
        return 0
    else:
        print("❌ JUDGE RESULT: FAILED - Some injected todos still remain in database!")
        print("=" * 70)
        return 1


if __name__ == "__main__":
    sys.exit(main())
