#!/usr/bin/env python3
"""
Verify smarthome-test task: OpenClaw agent morning routine completion

This verifier checks if the OpenClaw agent successfully completed the morning
routine tasks by examining the state changes through the smart home API
and checking the agent's report for each task.

Expected agent actions:
1. View dashboard and report temperature, humidity, thermostat mode
2. Check coffee schedule and report start time and status
3. Adjust thermostat to comfort mode at 74°F and report new settings
4. Review inventory and report item counts in fridge/pantry
5. Report expiring items (within 3 days from 2026-05-09) with names
6. Check calendar and report event count and titles
7. Update workout type to "walking" and report
8. Add an item to the Shopping List and report
"""

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

# Configuration
BASE_URL = "http://localhost:5004"
# Benchmark date: 2026-05-09, expiring = within 3 days (<= 2026-05-12)
BENCHMARK_DATE = "2026-05-09"
EXPIRING_THRESHOLD_DAYS = 3
# Expected expiring items: name -> expiry_date
EXPECTED_EXPIRING_ITEMS = {
    "milk": "2026-05-11",
    "bread": "2026-05-12",
    "chicken breast": "2026-05-10",
    "tomatoes": "2026-05-12",
    "yogurt": "2026-05-10",
    "cheese": "2026-05-11",
}
# Expected initial inventory counts
EXPECTED_FRIDGE_COUNT = (
    8  # Milk, Eggs, Butter, Orange Juice, Chicken Breast, Tomatoes, Yogurt, Cheese
)
EXPECTED_PANTRY_COUNT = 5  # Bread, Cereal, Rice, Pasta, Blue Mountain Coffee Beans
# Expected calendar events for 2026-05-09
EXPECTED_EVENT_COUNT = 4
EXPECTED_EVENT_TITLES = [
    "Morning Workout",
    "Team Standup",
    "Lunch with Client",
    "Project Review",
]


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
    """Get agent response from harbor.jsonl or response.txt fallback.

    Similar to grocery-reorder D4 pattern:
    1. First try harbor.jsonl (real agent runs) - collect ALL assistant messages
    2. Fallback to response.txt only if no harbor.jsonl exists (oracle scenario)
    """
    # Try harbor.jsonl first - get ALL assistant messages, not just the last one
    response = get_all_assistant_messages()

    # Fallback to response.txt only when harbor.jsonl doesn't exist
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
    """Extract all assistant message contents from harbor.jsonl.

    Returns concatenated text from all assistant messages, or None if not found.
    This ensures we don't miss expiring items mentioned in earlier messages.
    """
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


def check_dashboard_report():
    """Check if agent reported dashboard status (temperature, humidity, thermostat mode)"""
    print("\n=== Test 1: Dashboard Status Report ===")

    response = get_agent_response()
    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    response_lower = response.lower()
    score = 0.0

    # Check for temperature mention (should be around 68.5°F)
    temp_patterns = ["68.5", "68", "temperature", "temp"]
    if any(p in response_lower for p in temp_patterns):
        print("PASS: Temperature mentioned in report")
        score += 0.33
    else:
        print("FAIL: Temperature not mentioned in report")

    # Check for humidity mention (should be around 52%)
    humidity_patterns = ["humidity", "52", "humid"]
    if any(p in response_lower for p in humidity_patterns):
        print("PASS: Humidity mentioned in report")
        score += 0.33
    else:
        print("FAIL: Humidity not mentioned in report")

    # Check for thermostat mode mention (should be eco initially)
    mode_patterns = ["eco", "mode", "thermostat"]
    if any(p in response_lower for p in mode_patterns):
        print("PASS: Thermostat mode mentioned in report")
        score += 0.34
    else:
        print("FAIL: Thermostat mode not mentioned in report")

    return score


def check_coffee_schedule_report():
    """Check if agent reported coffee schedule (start time and status)"""
    print("\n=== Test 2: Coffee Schedule Report ===")

    response = get_agent_response()
    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    response_lower = response.lower()
    score = 0.0

    # Check for start time mention (should be 07:00)
    time_patterns = ["07:00", "7:00", "7am", "coffee", "schedule"]
    if any(p in response_lower for p in time_patterns):
        print("PASS: Coffee schedule/start time mentioned in report")
        score += 0.5
    else:
        print("FAIL: Coffee schedule not mentioned in report")

    # Check for status mention (brewing/preparing/scheduled/ready)
    status_patterns = ["brewing", "preparing", "scheduled", "ready", "status"]
    if any(p in response_lower for p in status_patterns):
        print("PASS: Coffee status mentioned in report")
        score += 0.5
    else:
        print("FAIL: Coffee status not mentioned in report")

    return score


def check_thermostat():
    """Check if thermostat was adjusted to comfort mode at 74°F and reported"""
    print("\n=== Test 3: Thermostat Adjustment ===")
    resp, status = http_request("GET", "/api/thermostat")

    if status != 200:
        print(f"FAIL: Could not get thermostat status: {status}")
        return 0.0

    mode = resp.get("mode")
    temp = resp.get("temperature")

    print(f"Current thermostat: mode={mode}, temperature={temp}")

    score = 0.0

    # Check mode is comfort
    if mode == "comfort":
        print("PASS: Thermostat mode is 'comfort'")
        score += 0.4
    else:
        print(f"FAIL: Expected mode 'comfort', got '{mode}'")

    # Check temperature is 74°F (allow small tolerance)
    if temp is not None and abs(temp - 74.0) < 0.5:
        print("PASS: Thermostat temperature is 74°F")
        score += 0.4
    else:
        print(f"FAIL: Expected temperature 74°F, got {temp}°F")

    # Check if agent reported the new settings
    response = get_agent_response()
    if response:
        response_lower = response.lower()
        if "comfort" in response_lower and (
            "74" in response_lower or "74°" in response_lower
        ):
            print("PASS: Agent reported thermostat adjustment")
            score += 0.2
        else:
            print("FAIL: Agent did not report thermostat adjustment")

    return score


def check_inventory_report():
    """Check if agent reported inventory counts for fridge and pantry"""
    print("\n=== Test 4: Inventory Report ===")

    response = get_agent_response()
    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    response_lower = response.lower()
    score = 0.0

    # Check for fridge mention
    if "fridge" in response_lower:
        print("PASS: Fridge mentioned in report")
        score += 0.25
    else:
        print("FAIL: Fridge not mentioned in report")

    # Check for pantry mention
    if "pantry" in response_lower:
        print("PASS: Pantry mentioned in report")
        score += 0.25
    else:
        print("FAIL: Pantry not mentioned in report")

    # Check for item count mention (numbers like 9, 4, 13, etc.)
    count_patterns = [
        r"\b\d+\s*items",
        r"\b\d+\s*item",
        r"total.*\d+",
        r"\d+\s*in\s*(fridge|pantry)",
    ]
    if any(re.search(p, response_lower) for p in count_patterns):
        print("PASS: Item count mentioned in report")
        score += 0.5
    else:
        print("FAIL: Item count not mentioned in report")

    return score


def check_expiring_items():
    """Check if agent correctly reported expiring items with names.

    Expected: 6 items expiring within 3 days from 2026-05-09:
    - Milk (2026-05-11) - 2 days
    - Bread (2026-05-12) - 3 days
    - Chicken Breast (2026-05-10) - 1 day
    - Tomatoes (2026-05-12) - 3 days
    - Yogurt (2026-05-10) - 1 day
    - Cheese (2026-05-11) - 2 days

    This test checks the agent's response for item names.
    Uses dual-source checking: harbor.jsonl first, response.txt as fallback.
    """
    print("\n=== Test 5: Expiring Items Report ===")

    # Get agent response from harbor.jsonl or response.txt
    response = get_agent_response()

    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    print(f"Agent response excerpt: {response[:200]}...")
    response_lower = response.lower()

    # Check which expiring items are mentioned
    found_items = []
    for item_name in EXPECTED_EXPIRING_ITEMS.keys():
        if item_name in response_lower:
            found_items.append(item_name)

    expected_count = len(EXPECTED_EXPIRING_ITEMS)
    found_count = len(found_items)

    print(
        f"Found {found_count}/{expected_count} expiring items mentioned: {found_items}"
    )

    # Score based on how many items are correctly identified
    if found_count == expected_count:
        print(f"PASS: All {expected_count} expiring items mentioned")
        return 1.0
    elif found_count >= expected_count - 1:
        print(f"PARTIAL: {found_count}/{expected_count} expiring items mentioned")
        return 0.8
    elif found_count >= expected_count // 2:
        print(f"PARTIAL: {found_count}/{expected_count} expiring items mentioned")
        return 0.5
    else:
        print(f"FAIL: Only {found_count}/{expected_count} expiring items mentioned")
        return 0.0


def check_calendar_report():
    """Check if agent reported calendar events (count and titles)"""
    print("\n=== Test 6: Calendar Report ===")

    response = get_agent_response()
    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    response_lower = response.lower()
    score = 0.0

    # Check for event count mention
    count_patterns = [
        r"\b4\s*events",
        r"\bfour\s*events",
        r"\d+\s*events",
        r"\d+\s*scheduled",
    ]
    if any(re.search(p, response_lower) for p in count_patterns):
        print("PASS: Event count mentioned in report")
        score += 0.3
    else:
        print("FAIL: Event count not mentioned in report")

    # Check for event titles mention
    found_titles = []
    for title in EXPECTED_EVENT_TITLES:
        title_lower = title.lower()
        if title_lower in response_lower or any(
            word in response_lower for word in title_lower.split()
        ):
            found_titles.append(title)

    if len(found_titles) >= 2:
        print(f"PASS: Event titles mentioned: {found_titles}")
        score += 0.7
    elif len(found_titles) >= 1:
        print(f"PARTIAL: Some event titles mentioned: {found_titles}")
        score += 0.4
    else:
        print("FAIL: Event titles not mentioned in report")

    return score


def check_workout_update():
    """Check if workout type was updated to walking and reported"""
    print("\n=== Test 7: Workout Type Update ===")
    resp, status = http_request("GET", "/api/calendar")

    if status != 200:
        print(f"FAIL: Could not get calendar events: {status}")
        return 0.0

    events = resp
    print(f"Found {len(events)} calendar events")

    # Find the workout event (event_type = 'workout')
    workout_event = None
    for event in events:
        if event.get("event_type") == "workout":
            workout_event = event
            break

    if not workout_event:
        print("FAIL: No workout event found in calendar")
        return 0.0

    workout_type = workout_event.get("workout_type")
    print(f"Workout event: id={workout_event.get('id')}, workout_type={workout_type}")

    score = 0.0

    if workout_type == "walking":
        print("PASS: Workout type updated to 'walking'")
        score += 0.7
    else:
        print(f"FAIL: Expected workout_type 'walking', got '{workout_type}'")

    # Check if agent reported the update
    response = get_agent_response()
    if response:
        response_lower = response.lower()
        if "walking" in response_lower:
            print("PASS: Agent reported workout update to walking")
            score += 0.3
        else:
            print("FAIL: Agent did not report workout update")

    return score


def check_shopping_list():
    """Check if an item was added to the Shopping List and reported"""
    print("\n=== Test 8: Shopping List Update ===")
    resp, status = http_request("GET", "/api/grocery/products")

    if status != 200:
        print(f"FAIL: Could not get shopping list: {status}")
        return 0.0

    products = resp
    print(f"Found {len(products)} items in Shopping List")

    # Initial seed has 8 items (PROD001-PROD008)
    # If agent added an item, there should be more than 8
    initial_count = 8
    current_count = len(products)

    score = 0.0

    if current_count > initial_count:
        print(
            f"PASS: Shopping list has {current_count} items (added {current_count - initial_count} new item(s))"
        )
        # Show the new items
        new_items = products[initial_count:]
        for item in new_items:
            print(
                f"  New item: {item.get('name')} ({item.get('quantity')} {item.get('unit')})"
            )
        score += 0.7
    else:
        print(f"FAIL: Shopping list has {current_count} items (no new items added)")

    # Check if agent reported the added item
    response = get_agent_response()
    if response and current_count > initial_count:
        response_lower = response.lower()
        # Check if any of the new items are mentioned
        new_items = products[initial_count:]
        mentioned = any(
            item.get("name", "").lower() in response_lower for item in new_items
        )
        if mentioned or "shopping list" in response_lower or "added" in response_lower:
            print("PASS: Agent reported shopping list update")
            score += 0.3
        else:
            print("FAIL: Agent did not report shopping list update")

    return score


def main():
    print("=" * 60)
    print("Smart Home Morning Routine Verification")
    print("=" * 60)

    tests = [
        ("Dashboard Status Report", check_dashboard_report, 1.0),
        ("Coffee Schedule Report", check_coffee_schedule_report, 1.0),
        ("Thermostat Adjustment", check_thermostat, 1.0),
        ("Inventory Report", check_inventory_report, 1.0),
        ("Expiring Items Report", check_expiring_items, 1.0),
        ("Calendar Report", check_calendar_report, 1.0),
        ("Workout Type Update", check_workout_update, 1.0),
        ("Shopping List Update", check_shopping_list, 1.0),
    ]

    results = []
    for name, test_func, max_score in tests:
        try:
            score = test_func()
            # Cap score at max_score
            score = min(score, max_score)
            results.append((name, score, max_score))
        except Exception as e:
            print(f"ERROR in {name}: {e}")
            results.append((name, 0.0, max_score))

    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)

    total_score = 0.0
    total_max = 0.0
    for name, score, max_score in results:
        status = (
            "PASS"
            if score >= max_score * 0.8
            else "PARTIAL"
            if score >= max_score * 0.5
            else "FAIL"
        )
        print(f"  {name}: {score:.2f}/{max_score:.2f} [{status}]")
        total_score += score
        total_max += max_score

    # Normalize to 0.0-1.0 scale
    final_score = total_score / total_max if total_max > 0 else 0.0

    print(f"\nFinal Score: {final_score:.2f}/1.0")

    # Write reward file for harbor
    with open("/logs/verifier/reward.txt", "w") as f:
        f.write(f"{final_score:.2f}\n")

    print(f"Score: {final_score:.2f}/1.0")

    # Require at least 6 tests to pass (score >= 0.8)
    passing_count = sum(
        1 for _, score, max_score in results if score >= max_score * 0.8
    )
    sys.exit(0 if passing_count >= 6 else 1)


if __name__ == "__main__":
    main()
