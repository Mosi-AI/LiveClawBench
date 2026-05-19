#!/usr/bin/env python3
"""
Verify smarthome-test task: 8-dimension scoring.

Dimensions (each 0.125 pts):
- D1: Dashboard report — mentions temperature (68.5°F), humidity (52%), initial thermostat mode (eco)
- D2: Coffee report — mentions start_time (07:00) AND status (ready/brewing)
- D3: Thermostat state — DB: mode='comfort' AND target_temperature=74 (HARD REQUIRED)
- D4: Inventory report — mentions fridge count (8) AND pantry count (5)
- D5: Expiring items report — mentions all 6 items: milk, bread, chicken breast, tomatoes, yogurt, cheese
- D6: Calendar report — mentions event count (4) AND all 4 titles
- D7: Workout state — DB: event='Morning Workout' AND workout_type='walking' (HARD REQUIRED)
- D8: Shopping list with reasoning — DB: COUNT(*) > 8 AND new items correspond to expiring inventory

Pass threshold: ≥ 0.75 (6 of 8 dimensions passed)
D3 and D7 are hard required (DB state must match regardless of overall score).
"""

import json
import re
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Configuration
BASE_URL = "http://localhost:5004"
SQLITE_DB = "/tmp/mosi_smart_home.sqlite"

# Expected values
EXPECTED_EXPIRING_ITEMS = {
    "milk": "2026-05-11",
    "bread": "2026-05-12",
    "chicken breast": "2026-05-10",
    "tomatoes": "2026-05-12",
    "yogurt": "2026-05-10",
    "cheese": "2026-05-11",
}
EXPECTED_EVENT_TITLES = [
    "Morning Workout",
    "Team Standup",
    "Lunch with Client",
    "Project Review",
]
EXPECTED_FRIDGE_COUNT = 8
EXPECTED_PANTRY_COUNT = 5
INITIAL_SHOPPING_LIST_COUNT = 8


def http_request(method, path, data=None):
    """Make HTTP request and return response"""
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"} if data else {}

    req = urllib.request.Request(url, method=method, headers=headers)
    if data:
        req.data = json.dumps(data).encode("utf-8")

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8")), response.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode("utf-8")), e.code
    except urllib.error.URLError as e:
        return {"error": f"Connection failed: {e.reason}"}, 503
    except json.JSONDecodeError as e:
        return {"error": f"Invalid JSON response: {e}"}, 502
    except Exception as e:
        return {"error": f"Unexpected error: {type(e).__name__}: {e}"}, 500


def get_agent_response():
    """Get agent response from harbor.jsonl or response.txt fallback."""
    response = get_all_assistant_messages()

    if response is None:
        harbor_exists = any(
            p.exists()
            for p in [
                Path("/logs/agent/openclaw-state/agents/main/sessions/harbor.jsonl"),
                Path("/workspace/.openclaw/agents/main/sessions/harbor.jsonl"),
                Path("/root/.openclaw/agents/main/sessions/harbor.jsonl"),
            ]
        )
        if not harbor_exists:
            response_path = Path("/workspace/output/response.txt")
            if response_path.exists():
                response = response_path.read_text()

    return response


def get_all_assistant_messages():
    """Extract all assistant message contents from harbor.jsonl."""
    fallback_log_paths = [
        Path("/logs/agent/openclaw-state/agents/main/sessions/harbor.jsonl"),
        Path("/workspace/.openclaw/agents/main/sessions/harbor.jsonl"),
        Path("/root/.openclaw/agents/main/sessions/harbor.jsonl"),
    ]

    actual_log_path = None
    for path in fallback_log_paths:
        if path.exists():
            actual_log_path = path
            break

    if actual_log_path is None:
        return None

    all_contents = []
    with open(actual_log_path, "r") as f:
        for line in f:
            try:
                entry = json.loads(line)
                if (
                    entry.get("type") == "message"
                    and entry.get("message", {}).get("role") == "assistant"
                ):
                    content = entry["message"].get("content")
                    if content is None:
                        continue
                    if isinstance(content, list):
                        text_parts = [
                            block.get("text", "")
                            for block in content
                            if block.get("type") == "text" and block.get("text")
                        ]
                        if text_parts:
                            all_contents.append(" ".join(text_parts))
                    elif isinstance(content, str):
                        all_contents.append(content)
            except json.JSONDecodeError:
                continue

    return " ".join(all_contents) if all_contents else None


def check_d1_dashboard_report(response):
    """D1: Dashboard report — mentions temperature (68.5°F), humidity (52%), initial thermostat mode (eco)"""
    print("\n=== D1: Dashboard Report ===")

    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    response_lower = response.lower()
    found = 0

    # Check temperature (68.5°F) - must mention 68.5 or 68 with temperature context
    temp_patterns = [
        r"68\.5",  # "68.5"
        r"68\s*°",  # "68°" or "68 °"
        r"68\s*degrees",  # "68 degrees"
        r"68\s*f",  # "68F" or "68 F"
    ]
    if any(re.search(p, response_lower) for p in temp_patterns):
        print("PASS: Temperature (68.5°F) mentioned")
        found += 1
    else:
        print("FAIL: Temperature not mentioned")

    # Check humidity (52%) - must have 52 with humidity context
    if (
        re.search(r"52\s*%", response_lower)
        or re.search(r"humidity[^\d]*52", response_lower)
        or re.search(r"52[^\d]*humidity", response_lower)
    ):
        print("PASS: Humidity (52%) mentioned")
        found += 1
    else:
        print("FAIL: Humidity not mentioned")

    # Check initial thermostat mode (eco) - must mention eco mode
    if re.search(r"\beco\b", response_lower) or "eco mode" in response_lower:
        print("PASS: Initial thermostat mode (eco) mentioned")
        found += 1
    else:
        print("FAIL: Initial thermostat mode not mentioned")

    if found == 3:
        print("D1: PASS (full 0.125)")
        return 0.125
    elif found == 2:
        print("D1: PARTIAL (0.083)")
        return 0.083
    else:
        print("D1: FAIL (0.0)")
        return 0.0


def check_d2_coffee_report(response):
    """D2: Coffee report — mentions start_time (07:00) AND status (ready/brewing)"""
    print("\n=== D2: Coffee Report ===")

    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    response_lower = response.lower()
    found = 0

    # Check start time (07:00)
    if "07:00" in response_lower or "7:00" in response_lower or "7am" in response_lower:
        print("PASS: Coffee start time mentioned")
        found += 1
    else:
        print("FAIL: Coffee start time not mentioned")

    # Check status (ready/brewing)
    if any(
        word in response_lower
        for word in ["ready", "brewing", "preparing", "scheduled"]
    ):
        print("PASS: Coffee status mentioned")
        found += 1
    else:
        print("FAIL: Coffee status not mentioned")

    if found == 2:
        print("D2: PASS (full 0.125)")
        return 0.125
    elif found == 1:
        print("D2: PARTIAL (0.083)")
        return 0.083
    else:
        print("D2: FAIL (0.0)")
        return 0.0


def check_d3_thermostat_state():
    """D3: Thermostat state — DB: mode='comfort' AND target_temperature=74 (HARD REQUIRED)"""
    print("\n=== D3: Thermostat State (HARD REQUIRED) ===")

    try:
        conn = sqlite3.connect(SQLITE_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT mode, temperature FROM thermostat_settings WHERE id = 1")
        row = cursor.fetchone()
        conn.close()

        if row is None:
            print("FAIL: No thermostat record found")
            return 0.0

        mode, temp = row
        print(f"Current thermostat: mode={mode}, temperature={temp}")

        if mode == "comfort" and temp == 74:
            print("D3: PASS (0.125)")
            return 0.125
        else:
            print(
                f"D3: FAIL - Expected mode='comfort' AND temperature=74, got mode='{mode}' AND temperature={temp}"
            )
            return 0.0
    except sqlite3.Error as e:
        print(f"FAIL: Database error: {e}")
        return 0.0


def check_d4_inventory_report(response):
    """D4: Inventory report — mentions fridge count and pantry count"""
    print("\n=== D4: Inventory Report ===")

    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    response_lower = response.lower()
    found = 0

    # Check fridge count - must mention the expected count in fridge context.
    fridge_patterns = [
        rf"{EXPECTED_FRIDGE_COUNT}\s*items?\s*(in\s*)?(the\s*)?fridge",
        rf"fridge[^\d]*{EXPECTED_FRIDGE_COUNT}\s*items?",
        rf"fridge[^\d.]*:\s*{EXPECTED_FRIDGE_COUNT}",
    ]
    if any(re.search(p, response_lower) for p in fridge_patterns):
        print(f"PASS: Fridge count ({EXPECTED_FRIDGE_COUNT} items) mentioned")
        found += 1
    else:
        print("FAIL: Fridge count not mentioned")

    # Check pantry count - must mention the expected count in pantry context.
    pantry_patterns = [
        rf"{EXPECTED_PANTRY_COUNT}\s*items?\s*(in\s*)?(the\s*)?pantry",
        rf"pantry[^\d]*{EXPECTED_PANTRY_COUNT}\s*items?",
        rf"pantry[^\d.]*:\s*{EXPECTED_PANTRY_COUNT}",
    ]
    if any(re.search(p, response_lower) for p in pantry_patterns):
        print(f"PASS: Pantry count ({EXPECTED_PANTRY_COUNT} items) mentioned")
        found += 1
    else:
        print("FAIL: Pantry count not mentioned")

    if found == 2:
        print("D4: PASS (full 0.125)")
        return 0.125
    elif found == 1:
        print("D4: PARTIAL (0.083)")
        return 0.083
    else:
        print("D4: FAIL (0.0)")
        return 0.0


def check_d5_expiring_items_report(response):
    """D5: Expiring items report — mentions all 6 items by name"""
    print("\n=== D5: Expiring Items Report ===")

    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    response_lower = response.lower()
    found_items = []

    for item_name in EXPECTED_EXPIRING_ITEMS.keys():
        if item_name in response_lower:
            found_items.append(item_name)

    expected_count = len(EXPECTED_EXPIRING_ITEMS)
    found_count = len(found_items)

    print(f"Found {found_count}/{expected_count} expiring items: {found_items}")

    if found_count == expected_count:
        print("D5: PASS (full 0.125)")
        return 0.125
    elif found_count >= 4:
        print("D5: PARTIAL (0.083)")
        return 0.083
    else:
        print("D5: FAIL (0.0)")
        return 0.0


def check_d6_calendar_report(response):
    """D6: Calendar report — mentions event count (4) AND all 4 titles"""
    print("\n=== D6: Calendar Report ===")

    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    response_lower = response.lower()
    found = 0

    # Check event count (4) - must have "4 events" or "four events"
    count_patterns = [r"\b4\s*events?", r"\bfour\s*events?"]
    if any(re.search(p, response_lower) for p in count_patterns):
        print("PASS: Event count (4) mentioned")
        found += 1
    else:
        print("FAIL: Event count not mentioned")

    # Check event titles - must match full title or significant words
    found_titles = []
    for title in EXPECTED_EVENT_TITLES:
        title_lower = title.lower()
        # Check for full title match
        if title_lower in response_lower:
            found_titles.append(title)
        else:
            # For partial match, require significant words (length > 4) to be present
            words = [w for w in title_lower.split() if len(w) > 4]
            if words and all(w in response_lower for w in words):
                found_titles.append(title)

    print(f"Found titles: {found_titles}")

    if len(found_titles) == len(EXPECTED_EVENT_TITLES):
        print("PASS: All 4 event titles mentioned")
        found += 1
    elif len(found_titles) >= 3:
        print("PARTIAL: ≥ 3 event titles mentioned")

    if found == 2:
        print("D6: PASS (full 0.125)")
        return 0.125
    elif found == 1 or len(found_titles) >= 3:
        print("D6: PARTIAL (0.083)")
        return 0.083
    else:
        print("D6: FAIL (0.0)")
        return 0.0


def check_d7_workout_state():
    """D7: Workout state — DB: event='Morning Workout' AND workout_type='walking' (HARD REQUIRED)"""
    print("\n=== D7: Workout State (HARD REQUIRED) ===")

    try:
        conn = sqlite3.connect(SQLITE_DB)
        cursor = conn.cursor()
        # calendar_event table uses start_time (ISO format), not a separate date field
        cursor.execute("""
            SELECT title, workout_type FROM calendar_event
            WHERE start_time LIKE '2026-05-09%' AND event_type = 'workout'
        """)
        row = cursor.fetchone()
        conn.close()

        if row is None:
            print("FAIL: No workout event found for 2026-05-09")
            return 0.0

        title, workout_type = row
        print(f"Workout event: title={title}, workout_type={workout_type}")

        if title == "Morning Workout" and workout_type == "walking":
            print("D7: PASS (0.125)")
            return 0.125
        else:
            print(
                f"D7: FAIL - Expected title='Morning Workout' AND workout_type='walking', got title='{title}' AND workout_type='{workout_type}'"
            )
            return 0.0
    except sqlite3.Error as e:
        print(f"FAIL: Database error: {e}")
        return 0.0


def check_d8_shopping_list_with_reasoning(response):
    """D8: Shopping list with reasoning — DB: COUNT(*) > 8 AND new items correspond to expiring inventory"""
    print("\n=== D8: Shopping List with Reasoning ===")

    try:
        conn = sqlite3.connect(SQLITE_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM grocery_product")
        count = cursor.fetchone()[0]

        # Get new items (beyond initial 8)
        cursor.execute("SELECT name FROM grocery_product LIMIT -1 OFFSET 8")
        new_items = [row[0].lower() for row in cursor.fetchall()]
        conn.close()

        print(f"Shopping list count: {count} (initial: {INITIAL_SHOPPING_LIST_COUNT})")
        print(f"New items: {new_items}")

        if count <= INITIAL_SHOPPING_LIST_COUNT:
            print("D8: FAIL - No new items added to shopping list")
            return 0.0

        # Check if new items correspond to expiring inventory
        expiring_names = set(EXPECTED_EXPIRING_ITEMS.keys())
        matching_items = [
            item for item in new_items if any(exp in item for exp in expiring_names)
        ]

        print(f"New items matching expiring inventory: {matching_items}")

        if not matching_items:
            print("D8: FAIL - New items don't correspond to expiring inventory")
            return 0.0

        # Check agent response for reasoning - must mention expiring items or inventory-based decision
        if response is None:
            print("D8: FAIL - Could not get agent response for reasoning")
            return 0.0

        response_lower = response.lower()
        # Must mention expiring items as the reason for adding to shopping list
        reasoning_patterns = [
            r"expir",  # "expiring" or "expire"
            r"running\s*low",  # "running low"
            r"need.*shop",  # "need to shop" or "needed for shopping"
            r"shop.*need",  # "shopping list needs"
        ]
        has_reasoning = any(re.search(p, response_lower) for p in reasoning_patterns)

        if has_reasoning:
            print(
                "PASS: Shopping list updated with items from expiring inventory and reasoning provided"
            )
            print("D8: PASS (0.125)")
            return 0.125
        else:
            print("D8: FAIL - No reasoning found in agent response")
            return 0.0

    except sqlite3.Error as e:
        print(f"FAIL: Database error: {e}")
        return 0.0


def main():
    print("=" * 60)
    print("Smart Home Morning Check Verification")
    print("=" * 60)

    # Get agent response once
    response = get_agent_response()

    # Run all dimension checks
    results = {}

    results["D1"] = check_d1_dashboard_report(response)
    results["D2"] = check_d2_coffee_report(response)
    results["D3"] = check_d3_thermostat_state()
    results["D4"] = check_d4_inventory_report(response)
    results["D5"] = check_d5_expiring_items_report(response)
    results["D6"] = check_d6_calendar_report(response)
    results["D7"] = check_d7_workout_state()
    results["D8"] = check_d8_shopping_list_with_reasoning(response)

    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)

    total_score = 0.0
    passed_count = 0

    for dim, score in results.items():
        status = "PASS" if score >= 0.125 else "PARTIAL" if score >= 0.083 else "FAIL"
        hard_req = " (HARD REQUIRED)" if dim in ["D3", "D7"] else ""
        print(f"  {dim}: {score:.3f}/0.125 [{status}]{hard_req}")
        total_score += score
        if score >= 0.125:
            passed_count += 1

    print(f"\nTotal Score: {total_score:.3f}/1.0")
    print(f"Dimensions passed: {passed_count}/8")

    # Check hard requirements
    d3_pass = results["D3"] >= 0.125
    d7_pass = results["D7"] >= 0.125
    hard_req_pass = d3_pass and d7_pass

    print(
        f"Hard requirements: D3={'PASS' if d3_pass else 'FAIL'}, D7={'PASS' if d7_pass else 'FAIL'}"
    )

    # Write reward file
    with open("/logs/verifier/reward.txt", "w") as f:
        f.write(f"{total_score:.3f}\n")

    # Write detailed results
    results_json = {
        "reward": total_score,
        "_meta_D1": results["D1"],
        "_meta_D2": results["D2"],
        "_meta_D3": results["D3"],
        "_meta_D4": results["D4"],
        "_meta_D5": results["D5"],
        "_meta_D6": results["D6"],
        "_meta_D7": results["D7"],
        "_meta_D8": results["D8"],
        "_meta_passed_count": passed_count,
        "_meta_hard_required_pass": hard_req_pass,
    }
    with open("/logs/verifier/reward.json", "w") as f:
        json.dump(results_json, f, indent=2)

    print(f"Score: {total_score:.3f}/1.0")

    # Pass threshold: ≥ 0.75 (6 of 8 dimensions) AND hard requirements met
    threshold_pass = total_score >= 0.75 and hard_req_pass
    sys.exit(0 if threshold_pass else 1)


if __name__ == "__main__":
    main()
