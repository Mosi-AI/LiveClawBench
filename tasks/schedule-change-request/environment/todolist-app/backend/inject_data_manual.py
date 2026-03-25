#!/usr/bin/env python3
"""
Manual data injection script.
Allows users to define todo items manually in code with full control over each field.
"""

import sqlite3
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from config import DATABASE_PATH


class ManualDataInjector:
    """Inject manually defined todo items into the database."""

    def __init__(self, database_path: str = DATABASE_PATH):
        self.database_path = database_path

    def validate_todo(self, todo: Dict[str, Any]) -> tuple[bool, str]:
        """
        Validate a todo item before injection.
        Returns (is_valid, error_message).
        """
        # Check required fields
        if "title" not in todo or not todo["title"] or not str(todo["title"]).strip():
            return False, "Title is required and cannot be empty"

        if "date" not in todo or not todo["date"]:
            return False, "Date is required"

        # Validate date format (YYYY-MM-DD)
        try:
            datetime.strptime(todo["date"], "%Y-%m-%d")
        except ValueError:
            return False, f"Invalid date format '{todo['date']}'. Use YYYY-MM-DD format"

        # Validate time format if provided (HH:MM)
        if todo.get("time"):
            try:
                datetime.strptime(todo["time"], "%H:%M")
            except ValueError:
                return False, f"Invalid time format '{todo['time']}'. Use HH:MM format"

        return True, ""

    def inject_single(
        self, todo: Dict[str, Any], validate: bool = True
    ) -> Optional[int]:
        """
        Inject a single todo item.

        Args:
            todo: Dictionary with todo fields (title, date, time, location, person, description)
            validate: Whether to validate before injection

        Returns:
            The ID of the inserted todo, or None if failed
        """
        if validate:
            is_valid, error = self.validate_todo(todo)
            if not is_valid:
                print(f"✗ Validation failed: {error}")
                return None

        conn = sqlite3.connect(self.database_path)
        cursor = conn.cursor()

        try:
            cursor.execute(
                """
                INSERT INTO todos (title, date, time, location, person, description)
                VALUES (?, ?, ?, ?, ?, ?)
            """,
                (
                    todo["title"],
                    todo["date"],
                    todo.get("time"),
                    todo.get("location"),
                    todo.get("person"),
                    todo.get("description"),
                ),
            )
            conn.commit()
            todo_id = cursor.lastrowid
            print(f"✓ Inserted: '{todo['title']}' on {todo['date']} (ID: {todo_id})")
            return todo_id
        except sqlite3.Error as e:
            print(f"✗ Database error: {e}")
            return None
        finally:
            conn.close()

    def inject_batch(
        self,
        todos: List[Dict[str, Any]],
        validate: bool = True,
        stop_on_error: bool = False,
    ) -> int:
        """
        Inject multiple todo items.

        Args:
            todos: List of todo dictionaries
            validate: Whether to validate each todo before injection
            stop_on_error: Whether to stop if one injection fails

        Returns:
            Number of successfully inserted todos
        """
        conn = sqlite3.connect(self.database_path)
        cursor = conn.cursor()
        inserted_count = 0

        for i, todo in enumerate(todos, 1):
            if validate:
                is_valid, error = self.validate_todo(todo)
                if not is_valid:
                    print(f"✗ Item {i} validation failed: {error}")
                    if stop_on_error:
                        break
                    continue

            try:
                cursor.execute(
                    """
                    INSERT INTO todos (title, date, time, location, person, description)
                    VALUES (?, ?, ?, ?, ?, ?)
                """,
                    (
                        todo["title"],
                        todo["date"],
                        todo.get("time"),
                        todo.get("location"),
                        todo.get("person"),
                        todo.get("description"),
                    ),
                )
                inserted_count += 1
                print(
                    f"✓ Inserted [{i}/{len(todos)}]: '{todo['title']}' on {todo['date']}"
                )
            except sqlite3.Error as e:
                print(f"✗ Item {i} database error: {e}")
                if stop_on_error:
                    break

        conn.commit()
        conn.close()

        return inserted_count

    def clear_all_todos(self, confirm: bool = False) -> int:
        """Delete all todos from the database."""
        if not confirm:
            print("⚠️  This will delete ALL todos. Use confirm=True to proceed.")
            return 0

        conn = sqlite3.connect(self.database_path)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM todos")
        deleted_count = cursor.rowcount
        conn.commit()
        conn.close()

        print(f"🗑️  Deleted {deleted_count} todos")
        return deleted_count


# ============================================================================
# USER DATA DEFINITION AREA
# ============================================================================


def create_todo(
    title: str,
    date: str,
    time: Optional[str] = None,
    location: Optional[str] = None,
    person: Optional[str] = None,
    description: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Helper function to create a todo dictionary.

    Args:
        title: Todo title (required)
        date: Date in YYYY-MM-DD format (required)
        time: Time in HH:MM format (optional)
        location: Location (optional)
        person: Associated person (optional)
        description: Detailed notes (optional)

    Returns:
        Todo dictionary
    """
    todo = {"title": title, "date": date}
    if time is not None:
        todo["time"] = time
    if location is not None:
        todo["location"] = location
    if person is not None:
        todo["person"] = person
    if description is not None:
        todo["description"] = description
    return todo


# ============================================================================
# DEFINE YOUR TODOS HERE
# ============================================================================


def get_user_todos() -> List[Dict[str, Any]]:
    """
    Define your custom todos here.
    Edit this function to add your own todo items.
    """
    # Calculate Sunday of the current week
    today = datetime.now()
    # weekday() returns 0 for Monday, 6 for Sunday
    days_until_sunday = 6 - today.weekday()
    sunday_date = today + timedelta(days=days_until_sunday)
    sunday_str = sunday_date.strftime("%Y-%m-%d")

    todos = [  ################## TODO: ADD YOUR TODOS HERE ####################
        {
            "title": "Game party w/ my old friends",
            "date": sunday_str,
            "time": "10:00",
            "location": "Mary's house",
            "person": "Mary Grande, Gary Alexander",
            "description": "Play Super Mario Party. Contact Mary via email: marytheshot@gmail.com",
        },
        {
            "title": "Morning run",
            "date": sunday_str,
            "time": "7:00",
            "location": "Lakeside Forest Park",
            "person": "Dr. Jason Wang",
            "description": "First, run 7km in the park, then discuss our paper ideas. Contact him via email: jason.wang97@mail.ucsd.edu.",
        },
        {
            "title": "Book club meeting",
            "date": sunday_str,
            "time": "19:00",
            "location": "Conference Room A, 9th Floor, School Library",
            "person": "Prakash Nath, founder of the book club",
            "description": "For registration inquiries, contact the assistant administrator: karre8523@outlook.com",
        },
        # Add more todos below...
        # {
        #     'title': 'Your Todo Title',
        #     'date': '2024-03-20',
        #     'time': '15:00',
        #     'location': 'Your Location',
        #     'person': 'Contact Person',
        #     'description': 'Your description here'
        # },
    ]

    return todos


# ============================================================================
# MAIN EXECUTION
# ============================================================================


def main():
    """Main entry point for manual data injection."""
    print("=" * 60)
    print("Manual Todo Data Injection")
    print("=" * 60)

    # Get user-defined todos
    todos = get_user_todos()

    if not todos:
        print(
            "\n⚠️  No todos defined. Please edit get_user_todos() function to add your items."
        )
        return

    print(f"\nFound {len(todos)} todo(s) to inject.")
    print("-" * 60)

    # Initialize injector
    injector = ManualDataInjector()

    # Show preview
    print("\nPreview of todos to be injected:")
    for i, todo in enumerate(todos, 1):
        print(f"  {i}. '{todo.get('title', 'N/A')}' - {todo.get('date', 'N/A')}")
        if todo.get("time"):
            print(f"     Time: {todo['time']}")
        if todo.get("location"):
            print(f"     Location: {todo['location']}")
        if todo.get("person"):
            print(f"     Person: {todo['person']}")
        if todo.get("description"):
            print(f"     Description: {todo['description'][:50]}...")
    print()

    # Confirm before injection
    confirm = input("Proceed with injection? (y/n): ").strip().lower()
    if confirm != "y":
        print("❌ Injection cancelled.")
        return

    # Inject todos
    print("\n" + "-" * 60)
    print("Injecting todos...")
    print("-" * 60)

    inserted_count = injector.inject_batch(todos, validate=True, stop_on_error=False)

    print("-" * 60)
    print(f"\n✅ Successfully injected {inserted_count}/{len(todos)} todos")


if __name__ == "__main__":
    main()
