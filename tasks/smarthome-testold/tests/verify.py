#!/usr/bin/env python3
"""
Verify smarthome_test task: comprehensive mock environment validation

Tests all 8 domains of the Smart Home mock:
1. Health endpoint
2. Thermostat (GET/POST with persistence)
3. Coffee Schedule (GET with derived status)
4. Inventory (GET/POST/DELETE)
5. Grocery Ordering (GET products, POST orders with transactions)
6. Wearable/Recovery (GET)
7. Calendar/Workout (GET/PUT with workout_type enum)
8. Meal Planning (POST/GET with deterministic retrieval)
"""

import json
import sqlite3
import sys
import tempfile
import urllib.request
import urllib.error

# Configuration
BASE_URL = "http://localhost:5003"
DB_PATH = "/tmp/smarthome_test/smarthome.db"  # Default path, may be overridden by MOCK_DATA_DIR


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
    except Exception as e:
        return {"error": str(e)}, 0


def test_health():
    """Test 1: Health endpoint"""
    print("\n=== Test 1: Health Endpoint ===")
    resp, status = http_request("GET", "/health")

    if status != 200:
        print(f"FAIL: Health endpoint returned status {status}")
        return 0.0

    if resp.get("ok") != True or resp.get("service") != "smarthome":
        print(f"FAIL: Invalid health response: {resp}")
        return 0.0

    print(f"PASS: Health endpoint OK - {resp}")
    return 1.0


def test_thermostat():
    """Test 2: Thermostat GET/POST with persistence"""
    print("\n=== Test 2: Thermostat ===")
    score = 0.0

    # Expected benchmark time from seed.sql (benchmark_clock.clock_time)
    EXPECTED_BENCHMARK_TIME = "2026-05-06T08:30:00Z"

    # GET initial state
    resp, status = http_request("GET", "/api/thermostat")
    if status != 200:
        print(f"FAIL: GET thermostat returned {status}")
        return 0.0

    initial_mode = resp.get("mode")
    initial_temp = resp.get("temperature")
    print(f"Initial thermostat: mode={initial_mode}, temp={initial_temp}")
    score += 0.3

    # POST update
    resp, status = http_request("POST", "/api/thermostat", {"mode": "eco", "temperature": 68})
    if status != 200:
        print(f"FAIL: POST thermostat returned {status}: {resp}")
        return score

    if resp.get("mode") != "eco" or resp.get("temperature") != 68:
        print(f"FAIL: POST response incorrect: {resp}")
        return score

    # Verify benchmark time is used (not current wall clock)
    # Must match the deterministic benchmark_clock value from seed.sql
    updated_at = resp.get("updated_at")
    if isinstance(updated_at, str):
        if updated_at == EXPECTED_BENCHMARK_TIME:
            print(f"PASS: updated_at matches benchmark_clock: {updated_at}")
            score += 0.3
        else:
            print(f"FAIL: updated_at does not match expected benchmark time")
            print(f"       Expected: {EXPECTED_BENCHMARK_TIME}")
            print(f"       Got: {updated_at}")
    else:
        print(f"FAIL: updated_at is missing or not a valid string: {updated_at}")

    print(f"POST thermostat: {resp}")
    score += 0.2

    # GET again to verify persistence
    resp, status = http_request("GET", "/api/thermostat")
    if resp.get("mode") == "eco" and resp.get("temperature") == 68:
        print(f"PASS: Thermostat update persisted")
        score += 0.2
    else:
        print(f"FAIL: Thermostat update not persisted: {resp}")

    return min(score, 1.0)


def test_coffee_schedule():
    """Test 3: Coffee Schedule with derived status"""
    print("\n=== Test 3: Coffee Schedule ===")
    score = 0.0

    resp, status = http_request("GET", "/api/coffee-schedule")
    if status != 200:
        print(f"FAIL: GET coffee-schedule returned {status}")
        return 0.0

    start_time = resp.get("start_time")
    status_val = resp.get("status")

    if not start_time or not status_val:
        print(f"FAIL: Missing fields in response: {resp}")
        return 0.0

    print(f"Coffee schedule: start_time={start_time}, status={status_val}")
    score += 0.5

    # Status should be derived from benchmark_clock
    valid_statuses = ["scheduled", "preparing", "brewing", "ready"]
    if status_val in valid_statuses:
        print(f"PASS: Status is valid derived value: {status_val}")
        score += 0.5
    else:
        print(f"FAIL: Invalid status: {status_val}")

    return score


def test_inventory():
    """Test 4: Inventory CRUD"""
    print("\n=== Test 4: Inventory ===")
    score = 0.0

    # GET initial inventory
    resp, status = http_request("GET", "/api/inventory")
    if status != 200:
        print(f"FAIL: GET inventory returned {status}")
        return 0.0

    initial_count = len(resp)
    print(f"Initial inventory count: {initial_count}")
    score += 0.3

    # POST new item
    new_item = {"item_name": "Test Eggs", "quantity": 12, "unit": "pieces", "location": "fridge"}
    resp, status = http_request("POST", "/api/inventory", new_item)
    if status not in [200, 201]:
        print(f"FAIL: POST inventory returned {status}: {resp}")
        return score

    item_id = resp.get("id")
    print(f"Added item with id={item_id}: {resp}")
    score += 0.3

    # Verify added
    resp, status = http_request("GET", "/api/inventory")
    if len(resp) == initial_count + 1:
        print(f"PASS: Item count increased by 1")
        score += 0.2
    else:
        print(f"FAIL: Item count not increased: {len(resp)}")

    # DELETE item
    resp, status = http_request("DELETE", f"/api/inventory/{item_id}")
    if status == 200:
        print(f"PASS: Deleted item {item_id}")
        score += 0.2
    else:
        print(f"WARN: DELETE returned {status}")

    return min(score, 1.0)


def test_grocery():
    """Test 5: Grocery Ordering"""
    print("\n=== Test 5: Grocery Ordering ===")
    score = 0.0

    # GET products
    resp, status = http_request("GET", "/api/grocery/products")
    if status != 200:
        print(f"FAIL: GET products returned {status}")
        return 0.0

    products = resp
    print(f"Found {len(products)} products")
    score += 0.3

    # POST order
    order = {"items": [{"product_id": "PROD001", "quantity": 2}]}
    resp, status = http_request("POST", "/api/grocery/orders", order)
    if status not in [200, 201]:
        print(f"FAIL: POST order returned {status}: {resp}")
        return score

    order_id = resp.get("order_id")
    total = resp.get("total")
    print(f"Created order: {order_id}, total={total}")
    score += 0.4

    # Verify total (PROD001 = Organic Milk at $4.99 * 2 = $9.98)
    if total and abs(total - 9.98) < 0.01:
        print(f"PASS: Order total correct: {total}")
        score += 0.3
    else:
        print(f"WARN: Order total may be incorrect: {total}")

    return min(score, 1.0)


def test_wearable():
    """Test 6: Wearable/Recovery"""
    print("\n=== Test 6: Wearable/Recovery ===")

    resp, status = http_request("GET", "/api/wearable-recovery")
    if status != 200:
        print(f"FAIL: GET wearable-recovery returned {status}")
        return 0.0

    required_fields = ["sleep_hours", "sleep_score", "readiness", "resting_heart_rate"]
    missing = [f for f in required_fields if f not in resp]

    if missing:
        print(f"FAIL: Missing fields: {missing}")
        return 0.0

    print(f"Wearable data: {resp}")
    print(f"PASS: All wearable fields present")
    return 1.0


def test_calendar():
    """Test 7: Calendar/Workout"""
    print("\n=== Test 7: Calendar/Workout ===")
    score = 0.0

    # GET events
    resp, status = http_request("GET", "/api/calendar")
    if status != 200:
        print(f"FAIL: GET calendar returned {status}")
        return 0.0

    events = resp
    print(f"Found {len(events)} calendar events")
    score += 0.3

    # Find workout event
    workout_event = next((e for e in events if e.get("workout_type")), None)
    if not workout_event:
        print(f"WARN: No workout event found")
        return score

    event_id = workout_event.get("id")
    original_type = workout_event.get("workout_type")
    print(f"Workout event: id={event_id}, workout_type={original_type}")
    score += 0.2

    # PUT update workout_type
    resp, status = http_request("PUT", f"/api/calendar/{event_id}", {"workout_type": "walking"})
    if status != 200:
        print(f"FAIL: PUT calendar returned {status}: {resp}")
        return score

    if resp.get("workout_type") == "walking":
        print(f"PASS: Workout type updated to walking")
        score += 0.3
    else:
        print(f"FAIL: Workout type not updated: {resp}")

    # Verify persistence
    resp, status = http_request("GET", f"/api/calendar/{event_id}")
    if resp.get("workout_type") == "walking":
        print(f"PASS: Workout update persisted")
        score += 0.2
    else:
        print(f"WARN: Workout update may not persist: {resp}")

    return min(score, 1.0)


def test_meal_plan():
    """Test 8: Meal Planning"""
    print("\n=== Test 8: Meal Planning ===")
    score = 0.0

    # Expected benchmark time from seed.sql (benchmark_clock.clock_time)
    EXPECTED_BENCHMARK_TIME = "2026-05-06T08:30:00Z"

    # GET recipes first
    resp, status = http_request("GET", "/api/recipes")
    if status != 200:
        print(f"FAIL: GET recipes returned {status}")
        return 0.0

    recipes = resp
    print(f"Found {len(recipes)} recipes")
    score += 0.2

    # Create 7-day meal plan
    days = []
    for i in range(7):
        day = {
            "date": f"2026-05-{7+i:02d}",
            "meals": [
                {"meal_type": "breakfast", "meal_id": 1},
                {"meal_type": "lunch", "meal_id": 2},
                {"meal_type": "dinner", "meal_id": 3}
            ]
        }
        days.append(day)

    resp, status = http_request("POST", "/api/meal-plan", {"days": days})
    if status not in [200, 201]:
        print(f"FAIL: POST meal-plan returned {status}: {resp}")
        return score

    plan_id = resp.get("plan_id")
    created_at = resp.get("created_at")
    print(f"Created meal plan: {plan_id}, created_at={created_at}")
    score += 0.4

    # Verify benchmark time is used (must match deterministic benchmark_clock)
    if isinstance(created_at, str):
        if created_at == EXPECTED_BENCHMARK_TIME:
            print(f"PASS: created_at matches benchmark_clock: {created_at}")
            score += 0.1
        else:
            print(f"FAIL: created_at does not match expected benchmark time")
            print(f"       Expected: {EXPECTED_BENCHMARK_TIME}")
            print(f"       Got: {created_at}")
    else:
        print(f"FAIL: created_at is missing or not a valid string: {created_at}")

    # Verify plan_id follows deterministic pattern: PLAN{timestamp}-{suffix}
    # Expected pattern: PLAN20260506083000-001 (based on benchmark_clock)
    import re
    if isinstance(plan_id, str):
        # Pattern: PLAN + YYYYMMDDHHMMSS + - + 3-char suffix (uppercase letters or digits)
        expected_pattern = r"^PLAN\d{14}-[A-Z0-9]{3}$"
        if re.match(expected_pattern, plan_id):
            # Further verify timestamp matches benchmark_clock
            expected_timestamp = "20260506083000"  # From EXPECTED_BENCHMARK_TIME
            if plan_id.startswith(f"PLAN{expected_timestamp}-"):
                print(f"PASS: plan_id follows deterministic pattern: {plan_id}")
                score += 0.1
            else:
                print(f"FAIL: plan_id timestamp does not match benchmark_clock")
                print(f"       Expected prefix: PLAN{expected_timestamp}-")
                print(f"       Got: {plan_id}")
        else:
            print(f"FAIL: plan_id does not follow expected deterministic pattern")
            print(f"       Expected: PLAN<YYYYMMDDHHMMSS>-<XXX>")
            print(f"       Got: {plan_id}")
    else:
        print(f"FAIL: plan_id is missing or not a valid string: {plan_id}")

    # GET meal plan
    resp, status = http_request("GET", "/api/meal-plan")
    if status != 200:
        print(f"FAIL: GET meal-plan returned {status}")
        return score

    if resp.get("plan_id") == plan_id:
        print(f"PASS: Meal plan retrieved correctly")
        score += 0.2
    else:
        print(f"WARN: Retrieved plan_id mismatch")

    return min(score, 1.0)


def main():
    print("=" * 60)
    print("Smart Home Mock Environment Verification")
    print("=" * 60)

    tests = [
        ("Health", test_health),
        ("Thermostat", test_thermostat),
        ("Coffee Schedule", test_coffee_schedule),
        ("Inventory", test_inventory),
        ("Grocery", test_grocery),
        ("Wearable", test_wearable),
        ("Calendar", test_calendar),
        ("Meal Plan", test_meal_plan),
    ]

    results = []
    for name, test_func in tests:
        try:
            score = test_func()
            results.append((name, score))
        except Exception as e:
            print(f"ERROR in {name}: {e}")
            results.append((name, 0.0))

    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)

    total_score = 0.0
    for name, score in results:
        status = "PASS" if score >= 0.8 else "PARTIAL" if score >= 0.5 else "FAIL"
        print(f"  {name}: {score:.2f} [{status}]")
        total_score += score

    final_score = total_score / len(tests)
    print(f"\nFinal Score: {final_score:.2f}/1.0")

    print(f"Score: {final_score:.2f}/1.0")
    sys.exit(0 if final_score >= 0.8 else 1)


if __name__ == "__main__":
    main()
