#!/usr/bin/env python3
"""
Data injection script for case synthesis.
Generates and injects various types of todo items into the database for testing.
"""

import argparse
import random
import sqlite3
from datetime import datetime, timedelta
from typing import Any, Dict, List

from config import DATABASE_PATH


class DataGenerator:
    """Generate various types of synthetic todo data."""

    # Data pools for realistic test data
    TITLES = {
        "work": [
            "Team meeting",
            "Project deadline",
            "Code review",
            "Client call",
            "Sprint planning",
            "Documentation update",
            "Bug fix",
            "Feature implementation",
            "Performance review",
            "Training session",
            "Workshop",
            "Presentation",
            "Quarterly report",
            "Budget meeting",
            "Strategy session",
        ],
        "personal": [
            "Grocery shopping",
            "Doctor appointment",
            "Gym session",
            "Call mom",
            "Pay bills",
            "Car maintenance",
            "Home cleaning",
            "Laundry",
            "Haircut appointment",
            "Dentist visit",
            "Vet appointment",
            "Shopping",
            "Cook dinner",
            "Movie night",
            "Family gathering",
        ],
        "events": [
            "Birthday party",
            "Anniversary dinner",
            "Graduation ceremony",
            "Wedding",
            "Conference",
            "Networking event",
            "Concert",
            "Sports game",
            "Festival",
            "Exhibition opening",
            "Book launch",
            "Charity event",
        ],
        "tasks": [
            "Review contract",
            "Submit application",
            "Return library books",
            "Organize files",
            "Backup data",
            "Update software",
            "Clean inbox",
            "Plan vacation",
            "Research purchase",
            "Compare options",
            "Write report",
        ],
    }

    LOCATIONS = [
        "Office",
        "Conference Room A",
        "Conference Room B",
        "Home",
        "Coffee Shop",
        "Downtown",
        "Airport",
        "Gym",
        "Hospital",
        "School",
        "Park",
        "Mall",
        "Restaurant",
        "Library",
        "Community Center",
        "Online/Remote",
    ]

    PERSONS = [
        "John Smith",
        "Sarah Johnson",
        "Mike Brown",
        "Emily Davis",
        "Chris Wilson",
        "Lisa Anderson",
        "David Lee",
        "Jennifer Martinez",
        "Robert Taylor",
        "Amanda Thomas",
        "Team",
        "Client",
        "Boss",
        "Family",
        "Friends",
    ]

    DESCRIPTIONS = [
        "Follow up on previous discussion",
        "Prepare all necessary documents",
        "Bring laptop and notebook",
        "Confirm attendance 24 hours prior",
        "Review agenda before meeting",
        "Dress code: business casual",
        "Priority: high",
        "Priority: medium",
        "Priority: low",
        "Recurring task",
        "One-time task",
        "Requires travel",
        "Remote participation available",
        "Childcare arranged",
        "Reservation confirmed",
    ]

    def __init__(self):
        random.seed()  # Initialize with system time

    def generate_date(self, base_date: datetime = None, days_range: int = 90) -> str:
        """Generate a random date within a range from base_date."""
        if base_date is None:
            base_date = datetime.now()

        days_offset = random.randint(-days_range, days_range)
        target_date = base_date + timedelta(days=days_offset)
        return target_date.strftime("%Y-%m-%d")

    def generate_time(self) -> str:
        """Generate a random time in HH:MM format."""
        hour = random.randint(6, 21)  # Between 6 AM and 9 PM
        minute = random.choice([0, 15, 30, 45])
        return f"{hour:02d}:{minute:02d}"

    def generate_todo(self, category: str = None, date: str = None) -> Dict[str, Any]:
        """Generate a single todo item."""
        if category is None:
            category = random.choice(list(self.TITLES.keys()))

        title = random.choice(self.TITLES[category])

        todo = {
            "title": title,
            "date": date if date else self.generate_date(),
            "time": self.generate_time() if random.random() > 0.3 else None,
            "location": random.choice(self.LOCATIONS)
            if random.random() > 0.4
            else None,
            "person": random.choice(self.PERSONS) if random.random() > 0.5 else None,
            "description": random.choice(self.DESCRIPTIONS)
            if random.random() > 0.4
            else None,
        }

        return todo

    def generate_batch(
        self, count: int, category: str = None, date_range: tuple = None
    ) -> List[Dict[str, Any]]:
        """Generate a batch of todo items."""
        todos = []

        for _ in range(count):
            if date_range:
                # Generate within specific date range
                start_date, end_date = date_range
                days_diff = (end_date - start_date).days
                random_days = random.randint(0, days_diff)
                date = (start_date + timedelta(days=random_days)).strftime("%Y-%m-%d")
                todo = self.generate_todo(category, date)
            else:
                todo = self.generate_todo(category)

            todos.append(todo)

        return todos

    def generate_daily_pattern(
        self, date: str, count_range: tuple = (2, 5)
    ) -> List[Dict[str, Any]]:
        """Generate todos for a specific date with realistic daily patterns."""
        count = random.randint(*count_range)
        todos = []

        for _ in range(count):
            todo = self.generate_todo(date=date)
            todos.append(todo)

        return todos

    def generate_recurring_pattern(
        self,
        title: str,
        start_date: datetime,
        occurrences: int = 10,
        frequency: str = "weekly",
    ) -> List[Dict[str, Any]]:
        """Generate recurring todo items."""
        todos = []

        for i in range(occurrences):
            if frequency == "daily":
                date = start_date + timedelta(days=i)
            elif frequency == "weekly":
                date = start_date + timedelta(weeks=i)
            elif frequency == "monthly":
                date = start_date + timedelta(days=30 * i)
            else:
                date = start_date + timedelta(weeks=i)

            todo = {
                "title": title,
                "date": date.strftime("%Y-%m-%d"),
                "time": self.generate_time(),
                "location": random.choice(self.LOCATIONS),
                "person": None,
                "description": f"Recurring {frequency} task",
            }
            todos.append(todo)

        return todos


class DataInjector:
    """Inject generated data into the database."""

    def __init__(self, database_path: str):
        self.database_path = database_path
        self.generator = DataGenerator()

    def inject_todos(self, todos: List[Dict[str, Any]], verbose: bool = True) -> int:
        """Inject a list of todos into the database."""
        conn = sqlite3.connect(self.database_path)
        cursor = conn.cursor()

        inserted_count = 0

        for todo in todos:
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

                if verbose:
                    print(f"✓ Inserted: {todo['title']} on {todo['date']}")

            except sqlite3.Error as e:
                print(f"✗ Error inserting todo: {e}")

        conn.commit()
        conn.close()

        return inserted_count

    def inject_random_batch(self, count: int, verbose: bool = True) -> int:
        """Inject a batch of random todos."""
        todos = self.generator.generate_batch(count)
        return self.inject_todos(todos, verbose)

    def inject_category_batch(
        self, category: str, count: int, verbose: bool = True
    ) -> int:
        """Inject todos of a specific category."""
        todos = self.generator.generate_batch(count, category=category)
        return self.inject_todos(todos, verbose)

    def inject_date_range_batch(
        self, count: int, start_date: str, end_date: str, verbose: bool = True
    ) -> int:
        """Inject todos within a specific date range."""
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")

        todos = self.generator.generate_batch(count, date_range=(start, end))
        return self.inject_todos(todos, verbose)

    def inject_recurring_pattern(
        self,
        title: str,
        start_date: str,
        occurrences: int = 10,
        frequency: str = "weekly",
        verbose: bool = True,
    ) -> int:
        """Inject recurring todo items."""
        start = datetime.strptime(start_date, "%Y-%m-%d")
        todos = self.generator.generate_recurring_pattern(
            title, start, occurrences, frequency
        )
        return self.inject_todos(todos, verbose)

    def inject_month_distribution(
        self, month: str, total_todos: int, verbose: bool = True
    ) -> int:
        """Inject todos distributed across a month."""
        year, month_num = map(int, month.split("-"))

        # Calculate days in month
        if month_num == 12:
            next_month = datetime(year + 1, 1, 1)
        else:
            next_month = datetime(year, month_num + 1, 1)

        days_in_month = (next_month - datetime(year, month_num, 1)).days

        all_todos = []
        for day in range(1, days_in_month + 1):
            # Random number of todos per day (0-4)
            daily_count = random.randint(0, 4)
            date_str = f"{year:04d}-{month_num:02d}-{day:02d}"

            for _ in range(daily_count):
                todo = self.generator.generate_todo(date=date_str)
                all_todos.append(todo)

        # Trim or pad to match total_todos
        if len(all_todos) > total_todos:
            all_todos = all_todos[:total_todos]
        elif len(all_todos) < total_todos:
            # Add more to reach target
            extra = self.generator.generate_batch(
                total_todos - len(all_todos),
                date_range=(
                    datetime(year, month_num, 1),
                    next_month - timedelta(days=1),
                ),
            )
            all_todos.extend(extra)

        return self.inject_todos(all_todos, verbose)

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


def main():
    """Main entry point for data injection script."""
    parser = argparse.ArgumentParser(
        description="Inject synthetic data into the todo database for case synthesis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Inject 50 random todos
  python inject_data.py --random 50

  # Inject 20 work-related todos
  python inject_data.py --category work --count 20

  # Inject 30 todos in March 2024
  python inject_data.py --month 2024-03 --count 30

  # Inject todos within a date range
  python inject_data.py --date-range 2024-01-01 2024-01-31 --count 25

  # Inject recurring weekly meetings
  python inject_data.py --recurring "Team Meeting" --start 2024-01-01 --frequency weekly --occurrences 12

  # Clear all todos
  python inject_data.py --clear
        """,
    )

    # Injection modes
    parser.add_argument(
        "--random", type=int, metavar="COUNT", help="Inject COUNT random todos"
    )
    parser.add_argument(
        "--category",
        type=str,
        choices=["work", "personal", "events", "tasks"],
        help="Category of todos to generate",
    )
    parser.add_argument(
        "--count", type=int, default=20, help="Number of todos to inject (default: 20)"
    )
    parser.add_argument(
        "--date-range",
        type=str,
        nargs=2,
        metavar=("START", "END"),
        help="Inject todos within date range (YYYY-MM-DD YYYY-MM-DD)",
    )
    parser.add_argument(
        "--month",
        type=str,
        metavar="YYYY-MM",
        help="Inject todos distributed across a month",
    )
    parser.add_argument(
        "--recurring",
        type=str,
        metavar="TITLE",
        help="Inject recurring todos with given title",
    )
    parser.add_argument(
        "--start", type=str, metavar="YYYY-MM-DD", help="Start date for recurring todos"
    )
    parser.add_argument(
        "--frequency",
        type=str,
        choices=["daily", "weekly", "monthly"],
        default="weekly",
        help="Frequency for recurring todos (default: weekly)",
    )
    parser.add_argument(
        "--occurrences",
        type=int,
        default=10,
        help="Number of recurring occurrences (default: 10)",
    )

    # Utility options
    parser.add_argument(
        "--clear", action="store_true", help="Delete all todos from database"
    )
    parser.add_argument("--quiet", action="store_true", help="Suppress detailed output")

    args = parser.parse_args()

    # Initialize injector
    injector = DataInjector(DATABASE_PATH)

    verbose = not args.quiet

    # Execute based on mode
    if args.clear:
        injector.clear_all_todos(confirm=True)

    elif args.random:
        count = injector.inject_random_batch(args.random, verbose)
        print(f"\n✅ Successfully injected {count} random todos")

    elif args.category:
        count = injector.inject_category_batch(args.category, args.count, verbose)
        print(f"\n✅ Successfully injected {count} {args.category} todos")

    elif args.date_range:
        start_date, end_date = args.date_range
        count = injector.inject_date_range_batch(
            args.count, start_date, end_date, verbose
        )
        print(
            f"\n✅ Successfully injected {count} todos from {start_date} to {end_date}"
        )

    elif args.month:
        count = injector.inject_month_distribution(args.month, args.count, verbose)
        print(f"\n✅ Successfully injected {count} todos for {args.month}")

    elif args.recurring:
        if not args.start:
            print("❌ Error: --start date is required for recurring todos")
            return
        count = injector.inject_recurring_pattern(
            args.recurring, args.start, args.occurrences, args.frequency, verbose
        )
        print(f"\n✅ Successfully injected {count} recurring todos")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
