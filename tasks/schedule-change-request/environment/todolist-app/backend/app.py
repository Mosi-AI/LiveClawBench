#!/usr/bin/env python3
"""Flask application with REST API endpoints for todo management."""

import re

from flask import Flask, jsonify, request
from flask_cors import CORS
from models import (
    create_todo,
    delete_todo,
    get_all_todos,
    get_month_summary,
    get_todo_by_id,
    get_todos_by_date,
    get_todos_by_date_range,
    get_todos_by_month,
    init_db,
    update_todo,
)

app = Flask(__name__)
CORS(app)

# Date format validation
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MONTH_PATTERN = re.compile(r"^\d{4}-\d{2}$")
TIME_PATTERN = re.compile(r"^\d{2}:\d{2}$")


def validate_date(date_str):
    """Validate date format (YYYY-MM-DD)."""
    return bool(DATE_PATTERN.match(date_str))


def validate_month(month_str):
    """Validate month format (YYYY-MM)."""
    return bool(MONTH_PATTERN.match(month_str))


def validate_time(time_str):
    """Validate time format (HH:MM)."""
    if time_str is None:
        return True
    return bool(TIME_PATTERN.match(time_str))


@app.route("/api/todos", methods=["GET"])
def get_todos():
    """Get all todos or filter by date range/month."""
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    month = request.args.get("month")

    try:
        if month:
            if not validate_month(month):
                return jsonify({"error": "Invalid month format. Use YYYY-MM"}), 400
            todos = get_todos_by_month(month)
        elif start_date and end_date:
            if not validate_date(start_date) or not validate_date(end_date):
                return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
            todos = get_todos_by_date_range(start_date, end_date)
        else:
            todos = get_all_todos()

        return jsonify(todos), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/todos/<date>", methods=["GET"])
def get_todos_for_date(date):
    """Get all todos for a specific date."""
    if not validate_date(date):
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    try:
        todos = get_todos_by_date(date)
        return jsonify(todos), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/todos/item/<int:id>", methods=["GET"])
def get_todo(id):
    """Get a single todo by ID."""
    try:
        todo = get_todo_by_id(id)
        if todo is None:
            return jsonify({"error": "Todo not found"}), 404
        return jsonify(todo), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/todos", methods=["POST"])
def create_todo_endpoint():
    """Create a new todo."""
    data = request.get_json()

    # Validate required fields
    if not data:
        return jsonify({"error": "No data provided"}), 400

    title = data.get("title")
    date = data.get("date")

    if not title or not title.strip():
        return jsonify({"error": "Title is required"}), 400

    if not date or not validate_date(date):
        return jsonify({"error": "Valid date (YYYY-MM-DD) is required"}), 400

    time = data.get("time")
    if time and not validate_time(time):
        return jsonify({"error": "Invalid time format. Use HH:MM"}), 400

    try:
        todo = create_todo(
            title=title.strip(),
            date=date,
            time=time,
            location=data.get("location"),
            person=data.get("person"),
            description=data.get("description"),
        )
        return jsonify(todo), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/todos/<int:id>", methods=["PUT"])
def update_todo_endpoint(id):
    """Update an existing todo."""
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Validate fields if provided
    if "date" in data and not validate_date(data["date"]):
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    if "time" in data and data["time"] and not validate_time(data["time"]):
        return jsonify({"error": "Invalid time format. Use HH:MM"}), 400

    if "title" in data and not data["title"].strip():
        return jsonify({"error": "Title cannot be empty"}), 400

    try:
        # Check if todo exists
        existing = get_todo_by_id(id)
        if existing is None:
            return jsonify({"error": "Todo not found"}), 404

        # Prepare updates
        updates = {}
        if "title" in data:
            updates["title"] = (
                data["title"].strip()
                if isinstance(data["title"], str)
                else data["title"]
            )
        if "date" in data:
            updates["date"] = data["date"]
        if "time" in data:
            updates["time"] = data["time"]
        if "location" in data:
            updates["location"] = data["location"]
        if "person" in data:
            updates["person"] = data["person"]
        if "description" in data:
            updates["description"] = data["description"]

        # Update todo
        updated = update_todo(id, **updates)
        return jsonify(updated), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/todos/<int:id>", methods=["DELETE"])
def delete_todo_endpoint(id):
    """Delete a todo."""
    try:
        success = delete_todo(id)
        if not success:
            return jsonify({"error": "Todo not found"}), 404
        return jsonify({"message": "Todo deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/summary/<month>", methods=["GET"])
def get_summary(month):
    """Get todo count summary for a month."""
    if not validate_month(month):
        return jsonify({"error": "Invalid month format. Use YYYY-MM"}), 400

    try:
        summary = get_month_summary(month)
        return jsonify(summary), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    # Initialize database on startup
    init_db()

    # Run development server
    app.run(host="0.0.0.0", port=5002, debug=True)
