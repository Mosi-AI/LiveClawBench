#!/usr/bin/env python3
"""Database initialization script"""

import os
import sys

# Add backend directory to path
backend_dir = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"
)
sys.path.insert(0, backend_dir)

from app import create_app, db


def init_db():
    """Initialize database"""
    app = create_app("development")

    with app.app_context():
        # Create all tables
        db.create_all()
        print("Database tables created successfully!")


if __name__ == "__main__":
    init_db()
