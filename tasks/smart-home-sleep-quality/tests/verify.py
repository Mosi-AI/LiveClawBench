#!/usr/bin/env python3
"""
Verify smart-home-sleep-quality task: 6-dimension scoring (all REQUIRED).

Dimensions:
- D1: Wearable sync (0.20) - smarthome wearable_recovery_state synced with health data
- D2: Thermostat (0.25) - temperature set to 68°F
- D3: Shopping list (0.20) - Melatonin entry with quantity=50, unit=tablets
- D4: Shop order (0.15) - Melatonin order in shop with quantity=1
- D5: Reference link (0.10) - grocery_product.reference matches order_id format
- D6: Agent response (0.10) - mentions date, sleep_quality, readiness, 68°F, melatonin, order_id

UI-ONLY CONSTRAINT: Agent must interact through web UIs, NOT direct backend API calls.
Direct API calls to mock service endpoints are detected and cause immediate failure.

All 6 dimensions are REQUIRED - any failure results in 0 for that dimension.
Final score = sum of dimension scores (weights sum to 1.0).
Zero-work baseline: 0.0 (all checks fail).
"""

import json
import re
import sqlite3
import sys
from pathlib import Path


def detect_direct_api_calls():
    """Check if agent made direct backend API calls instead of using web UIs.

    Returns (violation_found, details).
    """
    fallback_log_paths = [
        Path("/workspace/.openclaw/agents/main/sessions/harbor.jsonl"),
        Path("/root/.openclaw/agents/main/sessions/harbor.jsonl"),
        Path("/logs/agent/openclaw-state/agents/main/sessions/harbor.jsonl"),
    ]

    actual_log_path = None
    for path in fallback_log_paths:
        if path.exists():
            actual_log_path = path
            break

    if actual_log_path is None:
        return False, "No harbor.jsonl found (oracle mode)"

    # Patterns that indicate direct API calls (not browser-based)
    # These are backend API endpoints that should only be accessed via browser

    # Ports for the three mock services
    mock_ports = [5004, 5007, 1234]

    direct_api_patterns = [
        # HTTP verb patterns (any verb + absolute URL)
        r"(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+http://localhost:(?:5004|5007|1234)/api/",
        # JSON url field with absolute URL
        r'"url":\s*"http://localhost:(?:5004|5007|1234)/api/',
        # Raw curl command with absolute URL (most common form)
        r"curl\s+.*http://localhost:(?:5004|5007|1234)/api/",
        # Shell command with quoted absolute URL
        r'"http://localhost:(?:5004|5007|1234)/api/',
        # Relative /api/ paths in tool invocations (indicates direct backend access)
        r'"path":\s*"/api/',
        r'"endpoint":\s*"/api/',
        # Bash/shell execution of API calls
        r"-X\s+(?:GET|POST|PUT|DELETE|PATCH)\s+.*localhost:(?:5004|5007|1234)/api/",
    ]

    violations = []
    with open(actual_log_path, "r") as f:
        for line_num, line in enumerate(f, 1):
            for pattern in direct_api_patterns:
                if re.search(pattern, line):
                    violations.append(f"Line {line_num}: direct API call detected")

    if violations:
        return True, "; ".join(violations[:5])  # Limit to first 5
    return False, "No direct API calls detected"


def get_last_assistant_message():
    """Extract the last assistant message content from harbor.jsonl with fallback paths."""
    fallback_log_paths = [
        Path("/workspace/.openclaw/agents/main/sessions/harbor.jsonl"),
        Path("/root/.openclaw/agents/main/sessions/harbor.jsonl"),
        Path("/logs/agent/openclaw-state/agents/main/sessions/harbor.jsonl"),
    ]

    actual_log_path = None
    for path in fallback_log_paths:
        if path.exists():
            actual_log_path = path
            break

    if actual_log_path is None:
        return None

    last_content = None
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
                        last_content = " ".join(text_parts)
                    elif isinstance(content, str):
                        last_content = content
            except json.JSONDecodeError:
                continue
    return last_content


def check_dimension_1(conn):
    """D1: Wearable sync - check smarthome wearable_recovery_state synced with health data.

    Expected values (with tolerance for readiness):
    - sleep_hours = 6.5
    - sleep_score = 60
    - readiness = 38 (±1 tolerance for floating-point rounding)
    - resting_heart_rate = 72

    Readiness formula (per UI tooltip):
    - normalized_rhr = (resting_heart_rate - 40) / 60 * 100
    - activity_factor = min(total_activity_min / 60, 100)
    - readiness = sleep_quality * 0.4 + (100 - normalized_rhr) * 0.3 + activity_factor * 0.3

    Returns (pass, details).
    """
    cursor = conn.cursor()
    cursor.execute(
        "SELECT sleep_hours, sleep_score, readiness, resting_heart_rate FROM wearable_recovery_state WHERE id = 1"
    )
    row = cursor.fetchone()
    if row is None:
        return False, "No wearable_recovery_state row found"

    sleep_hours, sleep_score, readiness, resting_heart_rate = row

    # Check each field
    checks = []
    if sleep_hours != 6.5:
        checks.append(f"sleep_hours={sleep_hours} (expected 6.5)")
    if sleep_score != 60:
        checks.append(f"sleep_score={sleep_score} (expected 60)")
    if not (52 <= readiness <= 54):  # ±1 tolerance
        checks.append(f"readiness={readiness} (expected 53±1)")
    if resting_heart_rate != 72:
        checks.append(f"resting_heart_rate={resting_heart_rate} (expected 72)")

    if checks:
        return False, ", ".join(checks)
    return True, f"sleep_hours={sleep_hours}, sleep_score={sleep_score}, readiness={readiness}, resting_heart_rate={resting_heart_rate}"


def check_dimension_2(conn):
    """D2: Thermostat - check temperature set to 68°F.

    Returns (pass, details).
    """
    cursor = conn.cursor()
    cursor.execute(
        "SELECT mode, temperature FROM thermostat_settings WHERE id = 1"
    )
    row = cursor.fetchone()
    if row is None:
        return False, "No thermostat_settings row found"

    mode, temperature = row

    if temperature != 68.0:
        return False, f"temperature={temperature} (expected 68)"
    return True, f"mode={mode}, temperature={temperature}"


def check_dimension_3(conn):
    """D3: Shopping list - check Melatonin entry with quantity=50, unit=tablets.

    Returns (pass, details).
    """
    cursor = conn.cursor()
    cursor.execute(
        "SELECT name, quantity, unit FROM grocery_product WHERE name LIKE '%Melatonin%' OR product_id LIKE '%melatonin%'"
    )
    row = cursor.fetchone()
    if row is None:
        return False, "No Melatonin entry found in grocery_product"

    name, quantity, unit = row

    if quantity != 50.0 or unit != "tablets":
        return False, f"quantity={quantity}, unit={unit} (expected 50, tablets)"
    return True, f"name={name}, quantity={quantity}, unit={unit}"


def check_dimension_4(orders):
    """D4: Shop order - check Melatonin order with quantity=1.

    Returns (pass, order_id).
    """
    for order in orders:
        for item in order.get("items", []):
            title = item.get("title", "").lower()
            quantity = item.get("quantity", 0)
            # Check for melatonin product with quantity 1
            if "melatonin" in title and quantity == 1:
                return True, order.get("order_id")
    return False, None


def check_dimension_5(conn, expected_order_id):
    """D5: Reference link - check grocery_product.reference matches order_id format.

    Returns (pass, details).
    """
    cursor = conn.cursor()
    cursor.execute(
        "SELECT product_id, name, reference FROM grocery_product WHERE name LIKE '%Melatonin%' OR product_id LIKE '%melatonin%'"
    )
    row = cursor.fetchone()
    if row is None:
        return False, "No Melatonin entry found"

    product_id, name, reference = row

    if reference is None:
        return False, "No reference set"

    # Check reference matches ORD+6digits format
    if not re.match(r"^ORD\d{6}$", reference):
        return False, f"reference={reference} (expected ORD+6digits format)"

    # If we have an expected order_id from D4, check it matches
    if expected_order_id and reference != expected_order_id:
        return False, f"reference={reference} (expected {expected_order_id})"

    return True, f"reference={reference}"


def check_dimension_6():
    """D6: Agent response - check mentions date, sleep_quality, readiness, 68°F, melatonin, order_id.

    Returns (pass, details).
    """
    response = get_last_assistant_message()

    # Fallback to oracle solution output file
    if response is None:
        response_path = Path("/workspace/output/response.txt")
        if response_path.exists():
            response = response_path.read_text()

    if response is None:
        return False, "No agent response found"

    response_lower = response.lower()

    # Check for required keywords
    required_keywords = [
        ("date/2026-05-09", re.search(r"2026-05-09|may 9|may 9th", response_lower)),
        ("sleep_quality/60", re.search(r"sleep.*(quality|score).*(60|low|poor)", response_lower) or re.search(r"60.*(sleep|quality|score)", response_lower)),
        ("readiness/38", re.search(r"readiness.*(38|low|poor)", response_lower) or re.search(r"38.*readiness", response_lower)),
        ("68°F", re.search(r"68.*°?f|68.*degree|thermostat.*68", response_lower)),
        ("melatonin", "melatonin" in response_lower),
        ("order_id", re.search(r"ord\d{6}", response_lower)),
    ]

    missing = []
    for keyword, found in required_keywords:
        if not found:
            missing.append(keyword)

    if missing:
        return False, f"Missing keywords: {', '.join(missing)}"
    return True, "All required keywords present"


def main():
    score = 0.0
    results = {}
    melatonin_order_id = None

    # UI-ONLY constraint check: detect direct backend API calls
    api_violation, api_details = detect_direct_api_calls()
    if api_violation:
        print("UI-ONLY CONSTRAINT VIOLATION: Agent made direct backend API calls")
        print(f"    -> {api_details}")
        print("Score: 0.0/1.0")
        print("FAILED: Agent must interact through web UIs, NOT direct API calls")
        sys.exit(1)

    # Connect to smarthome SQLite
    smarthome_path = "/tmp/mosi_smart_home.sqlite"
    try:
        conn = sqlite3.connect(smarthome_path)
    except sqlite3.Error:
        print("Error: Cannot connect to smarthome database")
        print(f"Score: {score}/1.0")
        sys.exit(1)

    # Load shop orders JSON
    orders_path = "/tmp/mosi_shop_orders.json"
    try:
        with open(orders_path) as f:
            orders = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        orders = []

    # Check D1: Wearable sync
    d1_pass, d1_details = check_dimension_1(conn)
    results["D1"] = d1_pass
    if d1_pass:
        score += 0.20

    # Check D2: Thermostat
    d2_pass, d2_details = check_dimension_2(conn)
    results["D2"] = d2_pass
    if d2_pass:
        score += 0.25

    # Check D3: Shopping list
    d3_pass, d3_details = check_dimension_3(conn)
    results["D3"] = d3_pass
    if d3_pass:
        score += 0.20

    # Check D4: Shop order
    d4_pass, melatonin_order_id = check_dimension_4(orders)
    results["D4"] = d4_pass
    if d4_pass:
        score += 0.15

    # Check D5: Reference link
    d5_pass, d5_details = check_dimension_5(conn, melatonin_order_id)
    results["D5"] = d5_pass
    if d5_pass:
        score += 0.10

    # Check D6: Agent response
    d6_pass, d6_details = check_dimension_6()
    results["D6"] = d6_pass
    if d6_pass:
        score += 0.10

    conn.close()

    # Print results
    print(f"D1 (Wearable sync): {'PASS' if d1_pass else 'FAIL'}")
    print(f"    -> {d1_details}")
    print(f"D2 (Thermostat): {'PASS' if d2_pass else 'FAIL'}")
    print(f"    -> {d2_details}")
    print(f"D3 (Shopping list): {'PASS' if d3_pass else 'FAIL'}")
    print(f"    -> {d3_details}")
    print(f"D4 (Shop order): {'PASS' if d4_pass else 'FAIL'}")
    if d4_pass and melatonin_order_id:
        print(f"    -> Found melatonin order: {melatonin_order_id}")
    print(f"D5 (Reference link): {'PASS' if d5_pass else 'FAIL'}")
    print(f"    -> {d5_details}")
    print(f"D6 (Agent response): {'PASS' if d6_pass else 'FAIL'}")
    print(f"    -> {d6_details}")
    print(f"Score: {score:.2f}/1.0")

    # All 6 dimensions are REQUIRED - exit 0 only if ALL pass
    all_pass = all([d1_pass, d2_pass, d3_pass, d4_pass, d5_pass, d6_pass])
    if not all_pass:
        print("FAILED: All 6 dimensions are REQUIRED")
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()