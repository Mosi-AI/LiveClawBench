#!/usr/bin/env python3
"""Verify mint-diet-comprehensive by checking the Mint Diet SQLite final state."""

from __future__ import annotations

import json
import sqlite3
import sys
from datetime import date, timedelta
from pathlib import Path


DB_PATH = Path("/var/lib/mock-data/mint-diet/mint-diet.sqlite")


def compute_dates() -> tuple[str, str, str]:
    """Compute today, next Monday, and next Sunday."""
    today = date.today()
    # Next Monday: if today is Monday (weekday=0), add 7 days to get next week's Monday
    days_until_monday = (7 - today.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    next_monday = today + timedelta(days=days_until_monday)
    next_sunday = next_monday + timedelta(days=6)
    return (
        today.isoformat(),
        next_monday.isoformat(),
        next_sunday.isoformat(),
    )


def check_daily_log(conn: sqlite3.Connection, today: str) -> tuple[float, dict]:
    """
    Dimension 1 (0.25): Check daily_log has food_entry rows for all 4 slots
    with expected food name substrings (case-insensitive, EN+ZH).
    """
    score = 0.0
    details = {}

    # Get daily_log_id for today
    row = conn.execute(
        "SELECT id FROM daily_log WHERE log_date = ?",
        (today,),
    ).fetchone()

    if not row:
        details["error"] = f"No daily_log found for {today}"
        return score, details

    daily_log_id = row[0]

    # Get all food entries for today, grouped by meal_slot
    entries = conn.execute(
        """
        SELECT meal_slot, food_name, quantity_value, quantity_unit
        FROM food_entry
        WHERE daily_log_id = ?
        """,
        (daily_log_id,),
    ).fetchall()

    # Group entries by slot
    slot_foods: dict[str, list[dict]] = {
        "breakfast": [],
        "lunch": [],
        "dinner": [],
        "snacks": [],
    }
    for meal_slot, food_name, quantity_value, quantity_unit in entries:
        if meal_slot in slot_foods:
            slot_foods[meal_slot].append({
                "food_name": food_name,
                "quantity_value": quantity_value,
                "quantity_unit": quantity_unit,
            })

    # Check each slot for expected foods (case-insensitive substring match)
    slot_score = 0.0

    # Breakfast: oatmeal/燕麦 AND banana/香蕉
    breakfast_foods = [e["food_name"].lower() for e in slot_foods["breakfast"]]
    has_oatmeal = any("oatmeal" in f or "燕麦" in f for f in breakfast_foods)
    has_banana = any("banana" in f or "香蕉" in f for f in breakfast_foods)
    if has_oatmeal:
        slot_score += 0.03125
    if has_banana:
        slot_score += 0.03125
    details["breakfast"] = {
        "has_oatmeal": has_oatmeal,
        "has_banana": has_banana,
        "foods": breakfast_foods,
    }

    # Lunch: chicken breast/鸡胸肉 AND white rice/白米饭/rice
    lunch_foods = [e["food_name"].lower() for e in slot_foods["lunch"]]
    has_chicken = any("chicken" in f or "鸡胸" in f for f in lunch_foods)
    has_rice = any("rice" in f or "米饭" in f for f in lunch_foods)
    if has_chicken:
        slot_score += 0.03125
    if has_rice:
        slot_score += 0.03125
    details["lunch"] = {
        "has_chicken": has_chicken,
        "has_rice": has_rice,
        "foods": lunch_foods,
    }

    # Dinner: salmon/三文鱼 AND broccoli
    dinner_foods = [e["food_name"].lower() for e in slot_foods["dinner"]]
    has_salmon = any("salmon" in f or "三文鱼" in f for f in dinner_foods)
    has_broccoli = any("broccoli" in f for f in dinner_foods)
    if has_salmon:
        slot_score += 0.03125
    if has_broccoli:
        slot_score += 0.03125
    details["dinner"] = {
        "has_salmon": has_salmon,
        "has_broccoli": has_broccoli,
        "foods": dinner_foods,
    }

    # Snacks: milk/牛奶
    snack_foods = [e["food_name"].lower() for e in slot_foods["snacks"]]
    has_milk = any("milk" in f or "牛奶" in f for f in snack_foods)
    if has_milk:
        slot_score += 0.0625
    details["snacks"] = {
        "has_milk": has_milk,
        "foods": snack_foods,
    }

    score = min(slot_score, 0.25)  # Cap at 0.25
    return score, details


def check_meal_plan(conn: sqlite3.Connection, next_monday: str, next_sunday: str) -> tuple[float, dict]:
    """
    Dimension 2 (0.25): Check meal_plan exists with title="Clean Eating Week",
    status="active", dates match, target=1800, notes contains "lean protein".
    """
    score = 0.0
    details = {}

    row = conn.execute(
        """
        SELECT id, title, status, start_date, end_date, target_calories_kcal, notes
        FROM meal_plan
        WHERE title = 'Clean Eating Week'
        """,
    ).fetchone()

    if not row:
        details["error"] = "No meal plan with title 'Clean Eating Week' found"
        return score, details

    plan_id, title, status, start_date, end_date, target_calories, notes = row
    details["plan_id"] = plan_id
    details["title"] = title
    details["status"] = status
    details["start_date"] = start_date
    details["end_date"] = end_date
    details["target_calories_kcal"] = target_calories
    details["notes"] = notes

    # Check title and status (0.10)
    if title == "Clean Eating Week" and status == "active":
        score += 0.10
        details["title_status_ok"] = True
    else:
        details["title_status_ok"] = False

    # Check dates (0.05)
    if start_date == next_monday and end_date == next_sunday:
        score += 0.05
        details["dates_ok"] = True
    else:
        details["dates_ok"] = False
        details["expected_dates"] = {"start": next_monday, "end": next_sunday}

    # Check notes contains "lean protein" (0.05)
    if notes and "lean protein" in notes.lower():
        score += 0.05
        details["notes_ok"] = True
    else:
        details["notes_ok"] = False

    # Check target calories (0.05)
    if target_calories == 1800:
        score += 0.05
        details["target_ok"] = True
    else:
        details["target_ok"] = False

    return score, details


def check_plan_items(conn: sqlite3.Connection, plan_id: int, target_date: str) -> tuple[float, int]:
    """
    Check meal_plan_item rows for a specific date.
    Returns (score, count).
    """
    count = conn.execute(
        """
        SELECT COUNT(*)
        FROM meal_plan_item mpi
        JOIN meal_plan_day mpd ON mpd.id = mpi.meal_plan_day_id
        WHERE mpd.meal_plan_id = ? AND mpd.plan_date = ?
        """,
        (plan_id, target_date),
    ).fetchone()[0]

    score = 0.25 if count >= 3 else 0.0
    return score, count


def main() -> int:
    today, next_monday, next_sunday = compute_dates()
    print(f"Today: {today}")
    print(f"Next Monday: {next_monday}")
    print(f"Next Sunday: {next_sunday}")

    if not DB_PATH.exists():
        print(f"Database not found: {DB_PATH}")
        print("Score: 0.0/1.0")
        with open("/logs/verifier/reward.txt", "w") as f:
            f.write("0.0\n")
        return 1

    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=2)
    conn.row_factory = sqlite3.Row

    try:
        # Dimension 1: Daily log entries (0.25)
        d1_score, d1_details = check_daily_log(conn, today)
        print(f"Dimension 1 (Daily log): {d1_score:.2f}/0.25")

        # Dimension 2: Meal plan configuration (0.25)
        d2_score, d2_details = check_meal_plan(conn, next_monday, next_sunday)
        print(f"Dimension 2 (Meal plan): {d2_score:.2f}/0.25")

        # Get plan_id for item checks
        plan_id = d2_details.get("plan_id")

        # Dimension 3: Monday plan items (0.25)
        if plan_id:
            d3_score, d3_count = check_plan_items(conn, plan_id, next_monday)
        else:
            d3_score, d3_count = 0.0, 0
        print(f"Dimension 3 (Monday items): {d3_score:.2f}/0.25 (found {d3_count} items)")

        # Dimension 4: Tuesday plan items (0.25)
        next_tuesday = (date.fromisoformat(next_monday) + timedelta(days=1)).isoformat()
        if plan_id:
            d4_score, d4_count = check_plan_items(conn, plan_id, next_tuesday)
        else:
            d4_score, d4_count = 0.0, 0
        print(f"Dimension 4 (Tuesday items): {d4_score:.2f}/0.25 (found {d4_count} items)")

        # Total score
        total_score = d1_score + d2_score + d3_score + d4_score
        total_score = round(total_score, 2)

        # Write reward files
        with open("/logs/verifier/reward.txt", "w") as f:
            f.write(f"{total_score}\n")

        reward_json = {
            "reward": total_score,
            "_meta_d1": round(d1_score, 2),
            "_meta_d2": round(d2_score, 2),
            "_meta_d3": round(d3_score, 2),
            "_meta_d4": round(d4_score, 2),
        }
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(reward_json, f, indent=2)

        print(f"Score: {total_score}/1.0")
        return 0 if total_score >= 0.5 else 1

    except Exception as e:
        print(f"Error during verification: {e}")
        print("Score: 0.0/1.0")
        with open("/logs/verifier/reward.txt", "w") as f:
            f.write("0.0\n")
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
