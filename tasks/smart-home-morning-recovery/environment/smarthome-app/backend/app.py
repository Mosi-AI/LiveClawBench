"""
Smart Home Mock Backend Application
FastAPI backend service for smart home automation simulation
"""

import json
import os
import re
import sqlite3
import tempfile
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

app = FastAPI(
    title="Smart Home Mock",
    description="Smart Home Automation Simulation API",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
DATA_DIR = os.environ.get("MOCK_DATA_DIR", os.path.join(tempfile.gettempdir(), "smarthome"))
DB_PATH = os.path.join(DATA_DIR, "smarthome.db")
# Look for seed.sql relative to the backend directory
SEED_PATH = os.environ.get("MOCK_SEED_PATH", os.path.join(os.path.dirname(__file__), "..", "seed.sql"))

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Database initialization
# ---------------------------------------------------------------------------

def get_db() -> sqlite3.Connection:
    """Get database connection with row factory"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """Initialize database with tables and seed data"""
    db_exists = os.path.exists(DB_PATH)
    conn = get_db()
    cursor = conn.cursor()

    # Create tables
    cursor.executescript("""
        -- Thermostat settings (singleton)
        CREATE TABLE IF NOT EXISTS thermostat_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            mode TEXT NOT NULL CHECK (mode IN ('comfort', 'eco', 'off')),
            temperature REAL NOT NULL,
            updated_at TEXT NOT NULL
        );

        -- Coffee schedule (singleton)
        CREATE TABLE IF NOT EXISTS coffee_schedule (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            start_time TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        -- Benchmark clock for deterministic time-based status
        CREATE TABLE IF NOT EXISTS benchmark_clock (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            clock_time TEXT NOT NULL
        );

        -- Room metrics
        CREATE TABLE IF NOT EXISTS room_metrics (
            id INTEGER PRIMARY KEY,
            temperature REAL NOT NULL,
            humidity REAL NOT NULL,
            unit_temp TEXT NOT NULL,
            noise REAL,
            light REAL,
            air_quality REAL
        );

        -- Room info
        CREATE TABLE IF NOT EXISTS room (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        );

        -- Inventory items
        CREATE TABLE IF NOT EXISTS inventory_item (
            id INTEGER PRIMARY KEY,
            item_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit TEXT NOT NULL,
            location TEXT NOT NULL,
            expiry_date TEXT,
            category TEXT
        );

        -- Inventory snapshot
        CREATE TABLE IF NOT EXISTS inventory_snapshot (
            id INTEGER PRIMARY KEY,
            item_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit TEXT NOT NULL,
            location TEXT,
            captured_at TEXT NOT NULL
        );

        -- Grocery products
        CREATE TABLE IF NOT EXISTS grocery_product (
            product_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            stock_status TEXT NOT NULL CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock')),
            substitute_for TEXT
        );

        -- Grocery orders
        CREATE TABLE IF NOT EXISTS grocery_order (
            order_id TEXT PRIMARY KEY,
            total REAL NOT NULL,
            created_at TEXT NOT NULL
        );

        -- Grocery order items
        CREATE TABLE IF NOT EXISTS grocery_order_item (
            id INTEGER PRIMARY KEY,
            order_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            substitute_for TEXT,
            FOREIGN KEY (order_id) REFERENCES grocery_order(order_id)
        );

        -- Wearable/recovery state
        CREATE TABLE IF NOT EXISTS wearable_recovery_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            sleep_hours REAL NOT NULL,
            sleep_score REAL NOT NULL,
            readiness REAL NOT NULL,
            resting_heart_rate REAL NOT NULL
        );

        -- Calendar events
        CREATE TABLE IF NOT EXISTS calendar_event (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            start_time TEXT NOT NULL,
            event_type TEXT,
            workout_type TEXT CHECK (workout_type IN ('hiit', 'yoga', 'walking', 'cycling', 'strength', 'stretching', 'swimming', 'rest') OR workout_type IS NULL),
            updated_at TEXT NOT NULL
        );

        -- User constraints
        CREATE TABLE IF NOT EXISTS user_constraints (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            calorie_target REAL NOT NULL,
            macro_targets TEXT NOT NULL,
            allergy_constraints TEXT NOT NULL,
            weekly_budget_limit REAL NOT NULL
        );

        -- Recipes
        CREATE TABLE IF NOT EXISTS recipe (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
            ingredients TEXT NOT NULL,
            calories_total REAL NOT NULL,
            allergens TEXT
        );

        -- Recipe nutrition
        CREATE TABLE IF NOT EXISTS recipe_nutrition (
            id INTEGER PRIMARY KEY,
            meal_id INTEGER NOT NULL,
            ingredient_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit TEXT NOT NULL,
            calories REAL NOT NULL,
            protein_g REAL,
            carbs_g REAL,
            fat_g REAL,
            FOREIGN KEY (meal_id) REFERENCES recipe(id)
        );

        -- Meal plans
        CREATE TABLE IF NOT EXISTS meal_plan (
            id INTEGER PRIMARY KEY,
            plan_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            plan_data TEXT NOT NULL
        );

        -- Substitution mapping
        CREATE TABLE IF NOT EXISTS substitution_mapping (
            id INTEGER PRIMARY KEY,
            original_item TEXT NOT NULL,
            substitute_item TEXT NOT NULL,
            substitution_ratio REAL NOT NULL,
            category TEXT
        );
    """)

    # Load seed SQL only on first init
    if not db_exists and os.path.exists(SEED_PATH):
        with open(SEED_PATH, 'r') as f:
            seed_sql = f.read()
        cursor.executescript(seed_sql)
        print(f"smarthome: initialized fresh DB from {SEED_PATH}")
    elif db_exists:
        print(f"smarthome: found existing DB at {DB_PATH}, preserving state")
    else:
        print(f"smarthome: no seed SQL found at {SEED_PATH}, using empty tables")

    conn.commit()
    conn.close()


# Initialize database on startup
init_database()


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def get_benchmark_time() -> str:
    """Get deterministic timestamp from benchmark_clock"""
    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute("SELECT clock_time FROM benchmark_clock WHERE id = 1").fetchone()
    conn.close()
    return row["clock_time"] if row else "2026-05-06T08:00:00Z"


def derive_coffee_status(start_time: str, current_time: str) -> str:
    """Derive coffee status from start_time and benchmark_clock in a timezone-stable way"""
    # Parse HH:MM start time
    start_hour, start_min = map(int, start_time.split(":"))
    start_minutes = start_hour * 60 + start_min

    # Parse ISO 8601 current time in a timezone-stable way (use UTC)
    time_match = re.match(r"T(\d{2}):(\d{2}):", current_time)
    if not time_match:
        return "scheduled"

    current_hour = int(time_match.group(1))
    current_min = int(time_match.group(2))
    current_minutes = current_hour * 60 + current_min

    if current_minutes < start_minutes - 30:
        return "scheduled"
    elif current_minutes < start_minutes:
        return "preparing"
    elif current_minutes < start_minutes + 30:
        return "brewing"
    else:
        return "ready"


def generate_order_id() -> str:
    """Generate deterministic order ID based on benchmark clock and database state"""
    conn = get_db()
    cursor = conn.cursor()
    time = get_benchmark_time()
    timestamp = re.sub(r"[-:T]", "", time)[:14]

    prefix = f"ORD{timestamp}-"
    row = cursor.execute(
        "SELECT order_id FROM grocery_order WHERE order_id LIKE ? ORDER BY order_id DESC LIMIT 1",
        (f"{prefix}%",)
    ).fetchone()

    next_suffix = 1
    if row:
        last_suffix = row["order_id"][len(prefix):]
        next_suffix = int(last_suffix, 36) + 1

    conn.close()
    return f"ORD{timestamp}-{next_suffix:03d}"


def generate_plan_id() -> str:
    """Generate deterministic plan ID based on benchmark clock and database state"""
    conn = get_db()
    cursor = conn.cursor()
    time = get_benchmark_time()
    timestamp = re.sub(r"[-:T]", "", time)[:14]

    prefix = f"PLAN{timestamp}-"
    row = cursor.execute(
        "SELECT plan_id FROM meal_plan WHERE plan_id LIKE ? ORDER BY plan_id DESC LIMIT 1",
        (f"{prefix}%",)
    ).fetchone()

    next_suffix = 1
    if row:
        last_suffix = row["plan_id"][len(prefix):]
        next_suffix = int(last_suffix, 36) + 1

    conn.close()
    return f"PLAN{timestamp}-{next_suffix:03d}"


# ---------------------------------------------------------------------------
# API Models
# ---------------------------------------------------------------------------

class ThermostatUpdate(BaseModel):
    mode: str
    temperature: float


class CoffeeScheduleUpdate(BaseModel):
    start_time: str


class InventoryItem(BaseModel):
    item_name: str
    quantity: float
    unit: str
    location: str
    expiry_date: Optional[str] = None
    category: Optional[str] = None


class GroceryOrderItem(BaseModel):
    product_id: str
    quantity: int
    substitute_for: Optional[str] = None


class GroceryOrder(BaseModel):
    items: List[GroceryOrderItem]


class CalendarUpdate(BaseModel):
    title: Optional[str] = None
    start_time: Optional[str] = None
    event_type: Optional[str] = None
    workout_type: Optional[str] = None


class MealPlanDay(BaseModel):
    date: str
    meals: List[Dict[str, Any]]


class MealPlan(BaseModel):
    days: List[MealPlanDay]


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"ok": True, "status": "healthy", "service": "smarthome"}


@app.get("/__mock_sentinel__/smarthome")
def sentinel():
    return {"mock": "smarthome", "sentinel": True}


# --- Room Metrics API ---

@app.get("/api/room-metrics")
def get_room_metrics():
    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT temperature, humidity, unit_temp, noise, light, air_quality FROM room_metrics LIMIT 1"
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=503, detail="Room metrics unavailable")

    return dict(row)


# --- Thermostat API ---

@app.get("/api/thermostat")
def get_thermostat():
    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT mode, temperature, updated_at FROM thermostat_settings WHERE id = 1"
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Thermostat settings not found")

    return dict(row)


@app.post("/api/thermostat")
def update_thermostat(data: ThermostatUpdate):
    mode = data.mode.lower()
    if mode not in ("comfort", "eco", "off"):
        raise HTTPException(status_code=400, detail="Invalid mode. Must be comfort, eco, or off")

    conn = get_db()
    cursor = conn.cursor()

    # Verify singleton exists
    existing = cursor.execute("SELECT id FROM thermostat_settings WHERE id = 1").fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=503, detail="Thermostat settings unavailable - required state not initialized")

    now = get_benchmark_time()
    cursor.execute(
        "UPDATE thermostat_settings SET mode = ?, temperature = ?, updated_at = ? WHERE id = 1",
        (mode, data.temperature, now)
    )
    conn.commit()
    conn.close()

    return {"mode": mode, "temperature": data.temperature, "updated_at": now}


# --- Coffee Schedule API ---

@app.get("/api/coffee-schedule")
def get_coffee_schedule():
    conn = get_db()
    cursor = conn.cursor()
    schedule = cursor.execute(
        "SELECT start_time, updated_at FROM coffee_schedule WHERE id = 1"
    ).fetchone()
    clock = cursor.execute(
        "SELECT clock_time FROM benchmark_clock WHERE id = 1"
    ).fetchone()
    conn.close()

    if not schedule:
        raise HTTPException(status_code=404, detail="Coffee schedule not found")

    status = derive_coffee_status(schedule["start_time"], clock["clock_time"]) if clock else "scheduled"
    return {"start_time": schedule["start_time"], "status": status, "updated_at": schedule["updated_at"]}


@app.post("/api/coffee-schedule")
def update_coffee_schedule(data: CoffeeScheduleUpdate):
    # Validate format
    if not re.match(r"^\d{2}:\d{2}$", data.start_time):
        raise HTTPException(status_code=400, detail="Invalid start_time format. Use HH:MM format")

    # Validate bounds
    hour, minute = map(int, data.start_time.split(":"))
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise HTTPException(status_code=400, detail="Invalid time value. Hour must be 0-23, minute must be 0-59")

    conn = get_db()
    cursor = conn.cursor()

    # Verify singleton exists
    existing = cursor.execute("SELECT id FROM coffee_schedule WHERE id = 1").fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=503, detail="Coffee schedule unavailable - required state not initialized")

    now = get_benchmark_time()
    cursor.execute(
        "UPDATE coffee_schedule SET start_time = ?, updated_at = ? WHERE id = 1",
        (data.start_time, now)
    )
    conn.commit()
    conn.close()

    return {"start_time": data.start_time, "updated_at": now}


# --- Inventory API ---

@app.get("/api/inventory")
def get_inventory(location: Optional[str] = Query(None)):
    conn = get_db()
    cursor = conn.cursor()

    if location:
        rows = cursor.execute(
            "SELECT id, item_name, quantity, unit, location, expiry_date, category FROM inventory_item WHERE location = ?",
            (location,)
        ).fetchall()
    else:
        rows = cursor.execute(
            "SELECT id, item_name, quantity, unit, location, expiry_date, category FROM inventory_item"
        ).fetchall()

    conn.close()
    return [dict(row) for row in rows]


@app.post("/api/inventory")
def create_inventory_item(data: InventoryItem):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO inventory_item (item_name, quantity, unit, location, expiry_date, category) VALUES (?, ?, ?, ?, ?, ?)",
        (data.item_name, data.quantity, data.unit, data.location, data.expiry_date, data.category)
    )
    item_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "id": item_id,
        "item_name": data.item_name,
        "quantity": data.quantity,
        "unit": data.unit,
        "location": data.location,
        "expiry_date": data.expiry_date,
        "category": data.category
    }


@app.delete("/api/inventory/{item_id}")
def delete_inventory_item(item_id: int):
    conn = get_db()
    cursor = conn.cursor()

    existing = cursor.execute("SELECT id FROM inventory_item WHERE id = ?", (item_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found")

    cursor.execute("DELETE FROM inventory_item WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()

    return {"success": True}


# --- Grocery API ---

@app.get("/api/grocery/products")
def get_grocery_products():
    conn = get_db()
    cursor = conn.cursor()
    rows = cursor.execute(
        "SELECT product_id, name, price, stock_status, substitute_for FROM grocery_product ORDER BY name"
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.post("/api/grocery/orders")
def create_grocery_order(data: GroceryOrder):
    if not data.items:
        raise HTTPException(status_code=400, detail="Items array required")

    conn = get_db()
    cursor = conn.cursor()

    # Validate products and calculate total
    total = 0.0
    order_items = []

    for item in data.items:
        if item.quantity <= 0:
            conn.close()
            raise HTTPException(status_code=400, detail="Invalid item: positive quantity required")

        product = cursor.execute(
            "SELECT product_id, name, price, stock_status FROM grocery_product WHERE product_id = ?",
            (item.product_id,)
        ).fetchone()

        if not product:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Product not found: {item.product_id}")

        if product["stock_status"] == "out_of_stock" and not item.substitute_for:
            conn.close()
            raise HTTPException(status_code=409, detail=f"Product out of stock and no substitute provided: {item.product_id}")

        total += product["price"] * item.quantity
        order_items.append({
            "product_id": item.product_id,
            "quantity": item.quantity,
            "unit_price": product["price"],
            "substitute_for": item.substitute_for
        })

    # Create order
    order_id = generate_order_id()
    now = get_benchmark_time()

    cursor.execute(
        "INSERT INTO grocery_order (order_id, total, created_at) VALUES (?, ?, ?)",
        (order_id, total, now)
    )

    for order_item in order_items:
        cursor.execute(
            "INSERT INTO grocery_order_item (order_id, product_id, quantity, unit_price, substitute_for) VALUES (?, ?, ?, ?, ?)",
            (order_id, order_item["product_id"], order_item["quantity"], order_item["unit_price"], order_item["substitute_for"])
        )

    conn.commit()
    conn.close()

    return {
        "success": True,
        "order_id": order_id,
        "total": round(total, 2),
        "items": order_items
    }


# --- Wearable/Recovery API ---

@app.get("/api/wearable-recovery")
def get_wearable_recovery():
    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT sleep_hours, sleep_score, readiness, resting_heart_rate FROM wearable_recovery_state WHERE id = 1"
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=503, detail="Wearable data unavailable")

    return dict(row)


# --- Calendar/Workout API ---

@app.get("/api/calendar")
def get_calendar():
    conn = get_db()
    cursor = conn.cursor()
    rows = cursor.execute(
        "SELECT id, title, start_time, event_type, workout_type, updated_at FROM calendar_event ORDER BY start_time"
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


@app.get("/api/calendar/{event_id}")
def get_calendar_event(event_id: int):
    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT id, title, start_time, event_type, workout_type, updated_at FROM calendar_event WHERE id = ?",
        (event_id,)
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Event not found")

    return dict(row)


@app.put("/api/calendar/{event_id}")
def update_calendar_event(event_id: int, data: CalendarUpdate):
    valid_workout_types = ("hiit", "yoga", "walking", "cycling", "strength", "stretching", "swimming", "rest")

    if data.workout_type is not None and data.workout_type not in valid_workout_types:
        raise HTTPException(status_code=400, detail="Invalid workout_type")

    conn = get_db()
    cursor = conn.cursor()

    existing = cursor.execute("SELECT id FROM calendar_event WHERE id = ?", (event_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Event not found")

    now = get_benchmark_time()
    cursor.execute(
        """UPDATE calendar_event
           SET title = COALESCE(?, title),
               start_time = COALESCE(?, start_time),
               event_type = COALESCE(?, event_type),
               workout_type = ?,
               updated_at = ?
           WHERE id = ?""",
        (data.title, data.start_time, data.event_type, data.workout_type, now, event_id)
    )

    row = cursor.execute(
        "SELECT id, title, start_time, event_type, workout_type, updated_at FROM calendar_event WHERE id = ?",
        (event_id,)
    ).fetchone()
    conn.commit()
    conn.close()

    return dict(row)


# --- Constraints API ---

@app.get("/api/constraints")
def get_constraints():
    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT calorie_target, macro_targets, allergy_constraints, weekly_budget_limit FROM user_constraints WHERE id = 1"
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Constraints not found")

    return dict(row)


# --- Recipes API ---

@app.get("/api/recipes")
def get_recipes():
    conn = get_db()
    cursor = conn.cursor()
    rows = cursor.execute(
        "SELECT id, name, meal_type, ingredients, calories_total, allergens FROM recipe ORDER BY meal_type, name"
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


# --- Meal Plan API ---

@app.get("/api/meal-plan")
def get_meal_plan():
    conn = get_db()
    cursor = conn.cursor()
    row = cursor.execute(
        "SELECT plan_id, created_at, plan_data FROM meal_plan ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="No meal plan found")

    return dict(row)


@app.post("/api/meal-plan")
def create_meal_plan(data: MealPlan):
    if len(data.days) != 7:
        raise HTTPException(status_code=400, detail="Exactly 7 days required for weekly meal plan")

    valid_meal_types = ("breakfast", "lunch", "dinner")
    iso_date_regex = re.compile(r"^\d{4}-\d{2}-\d{2}$")

    conn = get_db()
    cursor = conn.cursor()

    # Validate each day
    for i, day in enumerate(data.days):
        # Validate date format
        if not day.date or not iso_date_regex.match(day.date):
            conn.close()
            raise HTTPException(status_code=400, detail=f"Day {i + 1}: date must be a valid ISO date string (YYYY-MM-DD)")

        # Validate date bounds
        year, month, date = map(int, day.date.split("-"))
        if year < 2000 or year > 2100 or month < 1 or month > 12 or date < 1 or date > 31:
            conn.close()
            raise HTTPException(status_code=400, detail=f"Day {i + 1}: invalid date value")

        # Validate meals array
        if not day.meals or not isinstance(day.meals, list):
            conn.close()
            raise HTTPException(status_code=400, detail=f"Day {i + 1}: meals must be a non-empty array")

        # Validate each meal
        for j, meal in enumerate(day.meals):
            if "meal_type" not in meal or meal["meal_type"] not in valid_meal_types:
                conn.close()
                raise HTTPException(status_code=400, detail=f"Day {i + 1}, meal {j + 1}: meal_type must be one of breakfast, lunch, dinner")

            if "meal_id" not in meal or not isinstance(meal["meal_id"], int):
                conn.close()
                raise HTTPException(status_code=400, detail=f"Day {i + 1}, meal {j + 1}: meal_id must be an integer")

            # Validate recipe exists
            recipe = cursor.execute("SELECT id FROM recipe WHERE id = ?", (meal["meal_id"],)).fetchone()
            if not recipe:
                conn.close()
                raise HTTPException(status_code=404, detail=f"Recipe not found: {meal['meal_id']}")

    plan_id = generate_plan_id()
    now = get_benchmark_time()
    plan_data = json.dumps([day.dict() for day in data.days])

    cursor.execute(
        "INSERT INTO meal_plan (plan_id, created_at, plan_data) VALUES (?, ?, ?)",
        (plan_id, now, plan_data)
    )
    conn.commit()
    conn.close()

    return {"success": True, "plan_id": plan_id, "created_at": now}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5003)
