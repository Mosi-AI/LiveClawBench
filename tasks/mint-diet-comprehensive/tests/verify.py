#!/usr/bin/env python3
"""Verify mint-diet-comprehensive by checking the Mint Diet SQLite final state."""

from __future__ import annotations

import json
import sqlite3
import sys
from datetime import date, timedelta
from pathlib import Path

DB_PATH = Path("/var/lib/mock-data/mint-diet/mint-diet.sqlite")

# Expected meal specifications from instruction.md
MEAL_SPECS = {
    "breakfast": [
        {"names": ["oatmeal", "燕麦"], "quantity": 250, "unit": "g", "calories": 950},
        {"names": ["banana", "香蕉"], "quantity": 120, "unit": "g", "calories": 107},
    ],
    "lunch": [
        {
            "names": ["chicken breast", "鸡胸肉"],
            "quantity": 200,
            "unit": "g",
            "calories": 260,
        },
        {
            "names": ["white rice", "白米饭", "rice"],
            "quantity": 300,
            "unit": "g",
            "calories": 390,
        },
    ],
    "dinner": [
        {"names": ["salmon", "三文鱼"], "quantity": 150, "unit": "g", "calories": 312},
        {"names": ["broccoli"], "quantity": 100, "unit": "g", "calories": 34},
    ],
    "snacks": [
        {"names": ["milk", "牛奶"], "quantity": 240, "unit": "ml", "calories": 149},
    ],
}

# Tolerance for quantity and calorie matching (±10%)
QUANTITY_TOLERANCE = 0.10
CALORIE_TOLERANCE = 0.10


def nearly_equal(value: float | None, expected: float, tolerance: float) -> bool:
    """Check if value is within tolerance of expected."""
    if value is None:
        return False
    return abs(value - expected) <= expected * tolerance


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


def check_daily_log(conn: sqlite3.Connection, today: str) -> tuple[float, dict, float]:
    """
    Dimension 1 (0.20): Check daily_log has food_entry rows for all 4 slots
    with expected foods matching quantity, unit, and calories.
    Also tracks catalog usage bonus.
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
        return score, details, 0.0

    daily_log_id = row[0]

    # Get all food entries for today with full details
    entries = conn.execute(
        """
        SELECT meal_slot, food_name, quantity_value, quantity_unit,
               calories_kcal, protein_g, carbs_g, fat_g, food_catalog_id
        FROM food_entry
        WHERE daily_log_id = ?
        """,
        (daily_log_id,),
    ).fetchall()

    # Group entries by slot
    slot_entries: dict[str, list[dict]] = {
        "breakfast": [],
        "lunch": [],
        "dinner": [],
        "snacks": [],
    }
    for entry in entries:
        meal_slot = entry[0]
        if meal_slot in slot_entries:
            slot_entries[meal_slot].append(
                {
                    "food_name": entry[1],
                    "quantity_value": entry[2],
                    "quantity_unit": entry[3],
                    "calories_kcal": entry[4],
                    "protein_g": entry[5],
                    "carbs_g": entry[6],
                    "fat_g": entry[7],
                    "food_catalog_id": entry[8],
                }
            )

    # Check each slot against expected meal specs
    slot_score = 0.0
    total_catalog_entries = 0
    total_expected_foods = sum(len(specs) for specs in MEAL_SPECS.values())

    for slot, expected_foods in MEAL_SPECS.items():
        slot_details = {"entries_found": len(slot_entries[slot]), "items": []}
        slot_items_matched = 0

        for spec in expected_foods:
            # Check if any entry in this slot matches this expected food
            matched = False
            catalog_matched = False
            matched_entry = None

            for entry in slot_entries[slot]:
                food_name_lower = entry["food_name"].lower()

                # Check if food name matches any of the expected names
                name_match = any(
                    name.lower() in food_name_lower for name in spec["names"]
                )

                if name_match:
                    # Check quantity with tolerance
                    qty_match = nearly_equal(
                        entry["quantity_value"], spec["quantity"], QUANTITY_TOLERANCE
                    )
                    # Check unit matches
                    unit_match = entry["quantity_unit"] == spec["unit"]
                    # Check calories with tolerance
                    cal_match = nearly_equal(
                        entry["calories_kcal"], spec["calories"], CALORIE_TOLERANCE
                    )

                    if qty_match and unit_match and cal_match:
                        matched = True
                        matched_entry = entry
                        # Check if this entry used a catalog item (not manual entry)
                        if entry["food_catalog_id"] is not None:
                            catalog_matched = True
                            total_catalog_entries += 1
                        break

            if matched:
                slot_items_matched += 1
                slot_score += 0.20 / total_expected_foods  # Equal weight per food item

            slot_details["items"].append(
                {
                    "expected_names": spec["names"],
                    "expected_qty": spec["quantity"],
                    "expected_unit": spec["unit"],
                    "expected_cal": spec["calories"],
                    "matched": matched,
                    "catalog_matched": catalog_matched,
                    "actual_entry": matched_entry,
                }
            )

        slot_details["items_matched"] = slot_items_matched
        slot_details["items_expected"] = len(expected_foods)
        details[slot] = slot_details

    # Cap at 0.20 for Dimension 1
    score = min(slot_score, 0.20)

    # Catalog usage bonus (0.05): at least one entry uses valid food_catalog_id
    catalog_bonus = 0.05 if total_catalog_entries >= 1 else 0.0
    details["catalog_usage"] = {
        "entries_with_catalog_id": total_catalog_entries,
        "bonus_applied": catalog_bonus > 0,
    }

    return score, details, catalog_bonus


def check_meal_plan(
    conn: sqlite3.Connection, next_monday: str, next_sunday: str
) -> tuple[float, dict]:
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


def check_plan_items(
    conn: sqlite3.Connection, plan_id: int, target_date: str
) -> tuple[float, int, list]:
    """
    Check meal_plan_item rows for a specific date.
    Returns (score, count, items).
    """
    items = conn.execute(
        """
        SELECT mpi.id, mpi.meal_slot, mpi.dish_name
        FROM meal_plan_item mpi
        JOIN meal_plan_day mpd ON mpd.id = mpi.meal_plan_day_id
        WHERE mpd.meal_plan_id = ? AND mpd.plan_date = ?
        """,
        (plan_id, target_date),
    ).fetchall()

    count = len(items)
    score = 0.25 if count >= 3 else 0.0
    item_list = [{"slot": item[1], "dish": item[2]} for item in items]
    return score, count, item_list


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
        # Dimension 1: Daily log entries (0.20) + catalog bonus (0.05)
        d1_score, d1_details, catalog_bonus = check_daily_log(conn, today)
        print(f"Dimension 1 (Daily log): {d1_score:.2f}/0.20")
        print(f"  Catalog usage bonus: {catalog_bonus:.2f}")
        print(
            f"  Entries with catalog_id: {d1_details.get('catalog_usage', {}).get('entries_with_catalog_id', 0)}"
        )

        # Dimension 2: Meal plan configuration (0.25)
        d2_score, d2_details = check_meal_plan(conn, next_monday, next_sunday)
        print(f"Dimension 2 (Meal plan): {d2_score:.2f}/0.25")

        # Get plan_id for item checks
        plan_id = d2_details.get("plan_id")

        # Dimension 3: Monday plan items (0.25)
        if plan_id:
            d3_score, d3_count, d3_items = check_plan_items(conn, plan_id, next_monday)
        else:
            d3_score, d3_count, d3_items = 0.0, 0, []
        print(
            f"Dimension 3 (Monday items): {d3_score:.2f}/0.25 (found {d3_count} items)"
        )

        # Dimension 4: Tuesday plan items (0.25)
        next_tuesday = (date.fromisoformat(next_monday) + timedelta(days=1)).isoformat()
        if plan_id:
            d4_score, d4_count, d4_items = check_plan_items(conn, plan_id, next_tuesday)
        else:
            d4_score, d4_count, d4_items = 0.0, 0, []
        print(
            f"Dimension 4 (Tuesday items): {d4_score:.2f}/0.25 (found {d4_count} items)"
        )

        # Total score (max 1.0: 0.20 + 0.05 + 0.25 + 0.25 + 0.25)
        raw_score = d1_score + catalog_bonus + d2_score + d3_score + d4_score
        total_score = min(round(raw_score, 2), 1.0)

        # Write reward files
        with open("/logs/verifier/reward.txt", "w") as f:
            f.write(f"{total_score}\n")

        reward_json = {
            "reward": total_score,
            "_meta_d1": round(d1_score, 2),
            "_meta_d1_catalog_bonus": round(catalog_bonus, 2),
            "_meta_d2": round(d2_score, 2),
            "_meta_d3": round(d3_score, 2),
            "_meta_d4": round(d4_score, 2),
            "_meta_details": {
                "d1_daily_log": d1_details,
                "d2_meal_plan": d2_details,
                "d3_monday_items": {"count": d3_count, "items": d3_items},
                "d4_tuesday_items": {"count": d4_count, "items": d4_items},
            },
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
