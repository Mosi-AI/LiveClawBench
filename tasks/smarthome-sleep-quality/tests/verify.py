#!/usr/bin/env python3
"""
Verify smarthome-sleep-quality task: 9-dimension scoring (all REQUIRED).

Dimensions:
- D1: Wearable sync (0.20) - smarthome wearable_recovery_state synced with health data
- D2: Thermostat (0.25) - temperature set to 68°F
- D3: Shopping list (0.20) - Melatonin entry with quantity=50, unit=tablets
- D4: Shop order (0.15) - Melatonin order in shop with quantity=1
- D5: Reference link (0.10) - grocery_product.reference matches order_id format
- D6a: Agent response sleep summary (0.04) - mentions date, sleep_quality, and readiness
- D6b: Agent response thermostat action (0.02) - mentions 68°F thermostat adjustment
- D6c: Agent response melatonin action (0.02) - mentions melatonin out of stock and order_id
- D6d: Agent response chamomile sufficiency (0.02) - confirms Chamomile Tea is sufficient (10 bags) and no tea order needed

UI-ONLY CONSTRAINT: Agent must interact through web UIs, NOT direct backend API calls.
Direct API calls to mock service endpoints are detected and cause immediate failure.

All dimensions are REQUIRED - any failure results in 0 for that dimension.
Final score = sum of dimension scores (weights sum to 1.0).
Zero-work baseline: 0.0 (all checks fail).
"""

import json
import re
import sqlite3
import sys
from pathlib import Path


def find_harbor_log_path():
    fallback_log_paths = [
        Path("/workspace/.openclaw/agents/main/sessions/harbor.jsonl"),
        Path("/root/.openclaw/agents/main/sessions/harbor.jsonl"),
        Path("/logs/agent/openclaw-state/agents/main/sessions/harbor.jsonl"),
    ]

    for path in fallback_log_paths:
        if path.exists():
            return path
    return None


def detect_direct_api_calls():
    """Check if agent made direct backend API calls instead of using web UIs.

    Returns (violation_found, details).
    """
    actual_log_path = find_harbor_log_path()

    if actual_log_path is None:
        return False, "No harbor.jsonl found (oracle mode)"

    # Patterns that indicate direct API calls (not browser-based)
    # These are backend API endpoints that should only be accessed via browser
    # Patterns are designed to match both plain and shell-escaped forms
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
        # Relative URL in JSON url field (various quote/escape levels)
        r'"url":\s*"/api/',
        r'\\"url\\":\s*\\"/api/',  # Shell-escaped: \"url\": \"/api/
        r'\\\\"url\\\\\\":\s*\\\\"/api/',  # Double-escaped
        # fetch() calls with relative URLs (handles plain, single-escaped, double-escaped quotes)
        r'fetch\s*\(\s*["\']?/api/',  # Plain: fetch("/api/ or fetch('/api/
        r'fetch\s*\(\s*\\"/api/',  # Shell-escaped: fetch(\"/api/
        r'fetch\s*\(\s*\\\\"/api/',  # Double-escaped: fetch(\\"/api/
        # httpie-style commands (http POST localhost:5004/api/...)
        r"http\s+(?:GET|POST|PUT|DELETE|PATCH)\s+localhost:(?:5004|5007|1234)/api/",
        # wget commands
        r"wget\s+.*http://localhost:(?:5004|5007|1234)/api/",
        # Python requests library
        r'requests\.(?:get|post|put|delete|patch)\s*\(\s*["\']http://localhost:(?:5004|5007|1234)/api/',
        # Local state tampering paths that bypass the UI entirely
        r"sqlite3\s+/(?:tmp|var/lib/mock-data)/[^\s]+",
        r"\bpython(?:3)?\b.*(?:json\.dump|write_text|open\().*(?:mosi_shop_orders\.json|mosi_smart_home\.sqlite|health\.db)",
        r"\b(?:cp|mv|tee|jq)\b.*(?:mosi_shop_orders\.json|mosi_smart_home\.sqlite|health\.db)",
    ]

    def extract_strings_recursive(obj, texts, depth=0):
        """Recursively extract all string values from nested structures."""
        if depth > 15:  # Prevent infinite recursion
            return
        if isinstance(obj, str):
            texts.append(obj)
        elif isinstance(obj, dict):
            for v in obj.values():
                extract_strings_recursive(v, texts, depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                extract_strings_recursive(item, texts, depth + 1)

    def extract_text_from_entry(entry):
        """Extract all text content from a harbor.jsonl entry for pattern matching.

        Handles both harbor formats:
        1. assistant message with content[] containing toolCall blocks
        2. top-level tool_call entries
        """
        texts = []

        entry_type = entry.get("type")

        # Handle assistant messages with content array
        if entry_type == "message":
            msg = entry.get("message", {})
            content = msg.get("content")

            if isinstance(content, str):
                texts.append(content)
            elif isinstance(content, list):
                for block in content:
                    if not isinstance(block, dict):
                        continue
                    block_type = block.get("type")

                    # Text blocks
                    if block_type == "text":
                        texts.append(block.get("text", ""))

                    # Harbor toolCall blocks (in assistant messages)
                    # This is the primary format used by harbor for tool invocations
                    if block_type == "toolCall":
                        # Extract tool name
                        tool_name = block.get("name", "")
                        texts.append(tool_name)
                        # Extract all arguments recursively (handles nested strings)
                        args = block.get("arguments", {})
                        if isinstance(args, dict):
                            extract_strings_recursive(args, texts)

                    # toolResult blocks may contain output with direct API traces
                    if block_type == "toolResult":
                        result_text = block.get("text", "")
                        texts.append(result_text)

        # Handle top-level tool_call entries (alternative format)
        if entry_type == "tool_call":
            tool_name = entry.get("tool_name", "") or entry.get("name", "")
            texts.append(tool_name)
            args = entry.get("arguments", {})
            if isinstance(args, dict):
                extract_strings_recursive(args, texts)

        return texts

    violations = []
    with open(actual_log_path, "r") as f:
        for line_num, line in enumerate(f, 1):
            # First check raw line (handles escaped JSON strings before parsing)
            for pattern in direct_api_patterns:
                if re.search(pattern, line):
                    violations.append(f"Line {line_num} (raw): direct API call detected")
                    break  # Only count one violation per line

            # Then parse as JSON and check decoded content
            try:
                entry = json.loads(line)
                texts = extract_text_from_entry(entry)
                for text in texts:
                    for pattern in direct_api_patterns:
                        if re.search(pattern, text):
                            violations.append(f"Line {line_num} (decoded): direct API call in tool content")
                            break
            except json.JSONDecodeError:
                continue  # Skip non-JSON lines

    if violations:
        return True, "; ".join(violations[:5])  # Limit to first 5
    return False, "No direct API calls detected"


def get_last_assistant_message():
    """Extract the last assistant message content from harbor.jsonl with fallback paths."""
    actual_log_path = find_harbor_log_path()

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
    - readiness = 53 (±1 tolerance for floating-point rounding)
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


def check_health_source_data():
    """Verify health mock source data window and outlier values are intact."""
    health_db_path = "/workspace/health.db"
    try:
        conn = sqlite3.connect(health_db_path)
    except sqlite3.Error as exc:
        return False, f"Cannot connect to health database: {exc}"

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM system_config WHERE key = 'current_date'")
        row = cursor.fetchone()
        if row is None or row[0] != "2026-05-09":
            return False, f"current_date={None if row is None else row[0]} (expected 2026-05-09)"

        cursor.execute(
            "SELECT COUNT(*), MIN(date), MAX(date) FROM health_daily_snapshot WHERE user_id = 1"
        )
        snapshot_count, snapshot_min, snapshot_max = cursor.fetchone()
        if (snapshot_count, snapshot_min, snapshot_max) != (30, "2026-04-10", "2026-05-09"):
            return False, (
                "health_daily_snapshot window="
                f"count={snapshot_count}, min={snapshot_min}, max={snapshot_max} "
                "(expected 30 rows from 2026-04-10 to 2026-05-09)"
            )

        cursor.execute(
            "SELECT COUNT(*), MIN(date), MAX(date) FROM health_metric_series WHERE user_id = 1 AND metric_type = 'sleep_quality'"
        )
        metric_count, metric_min, metric_max = cursor.fetchone()
        if (metric_count, metric_min, metric_max) != (30, "2026-04-10", "2026-05-09"):
            return False, (
                "health_metric_series sleep_quality window="
                f"count={metric_count}, min={metric_min}, max={metric_max} "
                "(expected 30 rows from 2026-04-10 to 2026-05-09)"
            )

        cursor.execute(
            "SELECT sleep_quality, resting_heart_rate_bpm, total_activity_min, sleep_hours FROM health_daily_snapshot WHERE user_id = 1 AND date = '2026-05-09'"
        )
        outlier = cursor.fetchone()
        if outlier != (60, 72, 30, 6.5):
            return False, (
                "health_daily_snapshot outlier="
                f"{outlier} (expected (60, 72, 30, 6.5))"
            )

        cursor.execute(
            "SELECT value FROM health_metric_series WHERE user_id = 1 AND metric_type = 'sleep_quality' AND date = '2026-05-09'"
        )
        metric_outlier = cursor.fetchone()
        if metric_outlier is None or metric_outlier[0] != 60:
            return False, (
                "health_metric_series sleep_quality on 2026-05-09="
                f"{None if metric_outlier is None else metric_outlier[0]} (expected 60)"
            )
    finally:
        conn.close()

    return True, "Health source data window and outlier values are correct"


def get_agent_response():
    response = get_last_assistant_message()

    if response is None and find_harbor_log_path() is None:
        response_path = Path("/workspace/output/response.txt")
        if response_path.exists():
            response = response_path.read_text()

    if response is None:
        return None

    return response


def check_dimension_6a(response):
    """D6a: Agent response sleep summary."""
    response_lower = response.lower()
    required_keywords = [
        ("date/2026-05-09", re.search(r"2026-05-09|may 9|may 9th", response_lower)),
        ("sleep_quality/60", re.search(r"sleep.*(quality|score).*(60|low|poor)", response_lower) or re.search(r"60.*(sleep|quality|score)", response_lower)),
        ("readiness/53", re.search(r"readiness.*(53|low|poor)", response_lower) or re.search(r"53.*readiness", response_lower)),
    ]
    missing = [keyword for keyword, found in required_keywords if not found]
    if missing:
        return False, f"Missing keywords: {', '.join(missing)}"
    return True, "Sleep summary keywords present"


def check_dimension_6b(response):
    """D6b: Agent response thermostat action."""
    response_lower = response.lower()
    if not re.search(r"68.*°?f|68.*degree|thermostat.*68", response_lower):
        return False, "Missing keywords: 68°F"
    return True, "Thermostat action present"


def check_dimension_6c(response):
    """D6c: Agent response melatonin action."""
    response_lower = response.lower()
    required_keywords = [
        ("melatonin", "melatonin" in response_lower),
        ("order_id", re.search(r"ord\d{6}", response_lower)),
        ("melatonin out of stock", re.search(r"melatonin.*(out of stock|stock was at 0|quantity.*0|qty.*0)", response_lower)),
    ]
    missing = [keyword for keyword, found in required_keywords if not found]
    if missing:
        return False, f"Missing keywords: {', '.join(missing)}"
    return True, "Melatonin order keywords present"


def check_dimension_6d(response):
    """D6d: Agent response chamomile sufficiency."""
    response_lower = response.lower()
    required_keywords = [
        ("chamomile tea", "chamomile tea" in response_lower),
        ("chamomile quantity/10 bags", re.search(r"10.*bags", response_lower) or re.search(r"bags.*10", response_lower)),
        ("chamomile sufficient/no order", re.search(r"chamomile tea.*(sufficient|enough|already have|stocked|ready)", response_lower) and re.search(r"(no|not).*order|order.*not needed|no extra tea order", response_lower)),
    ]
    missing = [keyword for keyword, found in required_keywords if not found]
    if missing:
        return False, f"Missing keywords: {', '.join(missing)}"
    return True, "Chamomile sufficiency keywords present"


def check_dimension_6():
    """Compatibility wrapper for D6 sub-dimensions.

    Returns (pass, details).
    """
    response = get_agent_response()
    if response is None:
        return False, "No agent response found"

    checks = [
        check_dimension_6a(response),
        check_dimension_6b(response),
        check_dimension_6c(response),
        check_dimension_6d(response),
    ]
    failures = [details for passed, details in checks if not passed]
    if failures:
        return False, "; ".join(failures)
    return True, "All D6 sub-dimensions present"


def write_reward_files(score, results, details, blocked_reason=None):
    reward_dir = Path("/logs/verifier")
    reward_dir.mkdir(parents=True, exist_ok=True)
    (reward_dir / "reward.txt").write_text(f"{score:.2f}\n")
    payload = {
        "reward": round(score, 2),
        "D1": float(results.get("D1", False)),
        "D2": float(results.get("D2", False)),
        "D3": float(results.get("D3", False)),
        "D4": float(results.get("D4", False)),
        "D5": float(results.get("D5", False)),
        "D6a": float(results.get("D6a", False)),
        "D6b": float(results.get("D6b", False)),
        "D6c": float(results.get("D6c", False)),
        "D6d": float(results.get("D6d", False)),
        "_meta_details": details,
    }
    if blocked_reason is not None:
        payload["_meta_blocked_reason"] = blocked_reason
    (reward_dir / "reward.json").write_text(json.dumps(payload, indent=2) + "\n")


def main():
    score = 0.0
    results = {}
    details = {}
    melatonin_order_id = None

    api_violation, api_details = detect_direct_api_calls()
    if api_violation:
        print("UI-ONLY CONSTRAINT VIOLATION: Agent made direct backend API calls")
        print(f"    -> {api_details}")
        print("Score: 0.0/1.0")
        print("FAILED: Agent must interact through web UIs, NOT direct API calls")
        write_reward_files(0.0, results, {"constraint": api_details}, blocked_reason="ui_only_constraint")
        sys.exit(1)

    health_pass, health_details = check_health_source_data()
    if not health_pass:
        print("FAILED: Health source data is inconsistent with the task contract")
        print(f"    -> {health_details}")
        print("Score: 0.0/1.0")
        write_reward_files(0.0, results, {"health_source": health_details}, blocked_reason="health_source_data")
        sys.exit(1)

    smarthome_path = "/tmp/mosi_smart_home.sqlite"
    try:
        conn = sqlite3.connect(smarthome_path)
    except sqlite3.Error:
        print("Error: Cannot connect to smarthome database")
        print(f"Score: {score}/1.0")
        write_reward_files(score, results, {"smarthome": "Cannot connect to smarthome database"}, blocked_reason="smarthome_db")
        sys.exit(1)

    orders_path = "/tmp/mosi_shop_orders.json"
    try:
        with open(orders_path) as f:
            orders = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        orders = []

    d1_pass, d1_details = check_dimension_1(conn)
    results["D1"] = d1_pass
    details["D1"] = d1_details
    if d1_pass:
        score += 0.20

    d2_pass, d2_details = check_dimension_2(conn)
    results["D2"] = d2_pass
    details["D2"] = d2_details
    if d2_pass:
        score += 0.25

    d3_pass, d3_details = check_dimension_3(conn)
    results["D3"] = d3_pass
    details["D3"] = d3_details
    if d3_pass:
        score += 0.20

    d4_pass, melatonin_order_id = check_dimension_4(orders)
    results["D4"] = d4_pass
    details["D4"] = melatonin_order_id or "No melatonin order found"
    if d4_pass:
        score += 0.15

    d5_pass, d5_details = check_dimension_5(conn, melatonin_order_id)
    results["D5"] = d5_pass
    details["D5"] = d5_details
    if d5_pass:
        score += 0.10

    response = get_agent_response()
    if response is None:
        d6a_pass, d6a_details = False, "No agent response found"
        d6b_pass, d6b_details = False, "No agent response found"
        d6c_pass, d6c_details = False, "No agent response found"
        d6d_pass, d6d_details = False, "No agent response found"
    else:
        d6a_pass, d6a_details = check_dimension_6a(response)
        d6b_pass, d6b_details = check_dimension_6b(response)
        d6c_pass, d6c_details = check_dimension_6c(response)
        d6d_pass, d6d_details = check_dimension_6d(response)

    results["D6a"] = d6a_pass
    details["D6a"] = d6a_details
    if d6a_pass:
        score += 0.04

    results["D6b"] = d6b_pass
    details["D6b"] = d6b_details
    if d6b_pass:
        score += 0.02

    results["D6c"] = d6c_pass
    details["D6c"] = d6c_details
    if d6c_pass:
        score += 0.02

    results["D6d"] = d6d_pass
    details["D6d"] = d6d_details
    if d6d_pass:
        score += 0.02

    conn.close()

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
    print(f"D6a (Agent response sleep summary): {'PASS' if d6a_pass else 'FAIL'}")
    print(f"    -> {d6a_details}")
    print(f"D6b (Agent response thermostat action): {'PASS' if d6b_pass else 'FAIL'}")
    print(f"    -> {d6b_details}")
    print(f"D6c (Agent response melatonin action): {'PASS' if d6c_pass else 'FAIL'}")
    print(f"    -> {d6c_details}")
    print(f"D6d (Agent response chamomile sufficiency): {'PASS' if d6d_pass else 'FAIL'}")
    print(f"    -> {d6d_details}")
    print(f"Score: {score:.2f}/1.0")

    all_pass = all([d1_pass, d2_pass, d3_pass, d4_pass, d5_pass, d6a_pass, d6b_pass, d6c_pass, d6d_pass])
    write_reward_files(score, results, details)
    if not all_pass:
        print("FAILED: All required dimensions and sub-dimensions are REQUIRED")
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
