#!/usr/bin/env python3
"""
Verify smarthome-test task: OpenClaw agent morning routine completion

This verifier checks if the OpenClaw agent successfully completed the morning
routine tasks by examining the state changes through the smart home API.

Expected agent actions:
1. View dashboard (implicit - no state change)
2. Adjust thermostat to comfort mode at 74°F
3. Review inventory (implicit - no state change)
4. Report expiring items (within 3 days from 2026-05-09) with names
5. Check calendar (implicit - no state change)
6. Update workout type to "walking"
7. Add an item to the Shopping List
"""

import json
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


def check_thermostat():
    """Check if thermostat was adjusted to comfort mode at 74°F"""
    print("\n=== Test 1: Thermostat Adjustment ===")
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
        score += 0.5
    else:
        print(f"FAIL: Expected mode 'comfort', got '{mode}'")

    # Check temperature is 74°F (allow small tolerance)
    if temp is not None and abs(temp - 74.0) < 0.5:
        print("PASS: Thermostat temperature is 74°F")
        score += 0.5
    else:
        print(f"FAIL: Expected temperature 74°F, got {temp}°F")

    return score


def check_workout_update():
    """Check if workout type was updated to walking"""
    print("\n=== Test 2: Workout Type Update ===")
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

    if workout_type == "walking":
        print("PASS: Workout type updated to 'walking'")
        return 1.0
    else:
        print(f"FAIL: Expected workout_type 'walking', got '{workout_type}'")
        return 0.0


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
    print("\n=== Test 3: Expiring Items Report ===")

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


def check_shopping_list():
    """Check if an item was added to the Shopping List"""
    print("\n=== Test 4: Shopping List Update ===")
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
        return 1.0
    else:
        print(f"INFO: Shopping list has {current_count} items (no new items added)")
        return 0.0


def main():
    print("=" * 60)
    print("Smart Home Morning Routine Verification")
    print("=" * 60)

    tests = [
        ("Thermostat Adjustment", check_thermostat, 1.0),
        ("Workout Type Update", check_workout_update, 1.0),
        ("Expiring Items Report", check_expiring_items, 1.0),
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

    # Require all 4 tests to pass (thermostat, workout, expiring count, shopping list)
    # Each test must score at least 0.8 to be considered passing
    all_passed = all(score >= max_score * 0.8 for _, score, max_score in results)
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
