import sqlite3
import json
from contextlib import contextmanager
from datetime import datetime
from config import DATABASE_PATH


@contextmanager
def get_db_connection():
    """Context manager for database connections."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Initialize the database with schema and indexes."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                date TEXT NOT NULL,
                time TEXT,
                location TEXT,
                person TEXT,
                description TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Create indexes for efficient queries
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_todos_date ON todos(date)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at)')

        conn.commit()
        print("Database initialized successfully!")


# CRUD Operations

def create_todo(title, date, time=None, location=None, person=None, description=None):
    """Create a new todo item."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO todos (title, date, time, location, person, description)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (title, date, time, location, person, description))

        todo_id = cursor.lastrowid
        conn.commit()

        return get_todo_by_id(todo_id)


def get_todo_by_id(todo_id):
    """Get a single todo by ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM todos WHERE id = ?', (todo_id,))
        row = cursor.fetchone()

        if row:
            return dict(row)
        return None


def get_todos_by_date(date):
    """Get all todos for a specific date."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM todos
            WHERE date = ?
            ORDER BY time ASC, created_at ASC
        ''', (date,))

        return [dict(row) for row in cursor.fetchall()]


def get_todos_by_date_range(start_date, end_date):
    """Get all todos within a date range."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM todos
            WHERE date >= ? AND date <= ?
            ORDER BY date ASC, time ASC, created_at ASC
        ''', (start_date, end_date))

        return [dict(row) for row in cursor.fetchall()]


def get_todos_by_month(month):
    """Get all todos for a specific month (YYYY-MM format)."""
    start_date = f"{month}-01"
    # Calculate the last day of the month
    year, month_num = map(int, month.split('-'))
    if month_num == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month_num + 1:02d}-01"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM todos
            WHERE date >= ? AND date < ?
            ORDER BY date ASC, time ASC, created_at ASC
        ''', (start_date, end_date))

        return [dict(row) for row in cursor.fetchall()]


def get_all_todos():
    """Get all todos."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM todos ORDER BY date ASC, time ASC, created_at ASC')

        return [dict(row) for row in cursor.fetchall()]


def update_todo(todo_id, **kwargs):
    """Update a todo item. Only provided fields will be updated."""
    # Filter out None values and valid fields
    valid_fields = {'title', 'date', 'time', 'location', 'person', 'description'}
    updates = {k: v for k, v in kwargs.items() if k in valid_fields and v is not None}

    if not updates:
        return get_todo_by_id(todo_id)

    # Build dynamic update query
    set_clause = ', '.join([f"{field} = ?" for field in updates.keys()])
    set_clause += ', updated_at = CURRENT_TIMESTAMP'

    values = list(updates.values()) + [todo_id]

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f'''
            UPDATE todos
            SET {set_clause}
            WHERE id = ?
        ''', values)
        conn.commit()

        return get_todo_by_id(todo_id)


def delete_todo(todo_id):
    """Delete a todo item."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM todos WHERE id = ?', (todo_id,))
        conn.commit()

        return cursor.rowcount > 0


def get_month_summary(month):
    """Get todo count summary for a specific month."""
    start_date = f"{month}-01"
    # Calculate the last day of the month
    year, month_num = map(int, month.split('-'))
    if month_num == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month_num + 1:02d}-01"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT date, COUNT(*) as count
            FROM todos
            WHERE date >= ? AND date < ?
            GROUP BY date
        ''', (start_date, end_date))

        # Convert to dictionary { 'YYYY-MM-DD': count }
        summary = {}
        for row in cursor.fetchall():
            summary[row['date']] = row['count']

        return summary
