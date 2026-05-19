#!/usr/bin/env python3
"""
Verify morning-comfort-setup task: 8-dimension scoring.

Dimensions (each 0.125 pts):
- D1: Thermostat state — DB: mode='comfort' AND temperature in 72-77 range (HARD REQUIRED)
- D2: Coffee state — DB: start_time <= '06:30' (HARD REQUIRED)
- D3: Grocery Blue Mountain — DB: entry with quantity=20g AND reference='expired' (HARD REQUIRED)
- D4: Grocery Kenya AA — DB: entry with quantity=8g AND reference='insufficient/shortage' (HARD REQUIRED)
- D5: Response environmental — humidity anomaly AND humidity→thermostat causal link AND thermostat correction
- D6: Response coffee timing — 30-min brew AND 06:30 AND 7am/departure inference (all three required)
- D7: Response inventory — Blue Mountain expired AND Kenya AA insufficient
- D8: Response cross-reference — Kenya AA is coffee bean (cross-referenced)

Pass threshold: >= 0.75 (6 of 8 dimensions passed)
D1, D2, D3, D4 are hard required (DB state must match regardless of overall score).
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
EXPECTED_THERMOSTAT_MODE = "comfort"
EXPECTED_THERMOSTAT_TEMP_MIN = 72
EXPECTED_THERMOSTAT_TEMP_MAX = 77
EXPECTED_COFFEE_START_TIME_MAX = "06:30"
EXPECTED_GROCERY_BLUE_MOUNTAIN_QTY = 20  # ±2g tolerance
EXPECTED_GROCERY_KENYA_AA_QTY = 8  # ±1g tolerance


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


def check_d1_thermostat_state():
    """D1: Thermostat state — DB: mode='comfort' AND temperature in 72-77 range (HARD REQUIRED)"""
    print("\n=== D1: Thermostat State (HARD REQUIRED) ===")

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

        if (
            mode == EXPECTED_THERMOSTAT_MODE
            and EXPECTED_THERMOSTAT_TEMP_MIN <= temp <= EXPECTED_THERMOSTAT_TEMP_MAX
        ):
            print("D1: PASS (0.125)")
            return 0.125
        else:
            print(
                f"D1: FAIL - Expected mode='{EXPECTED_THERMOSTAT_MODE}' AND temperature in {EXPECTED_THERMOSTAT_TEMP_MIN}-{EXPECTED_THERMOSTAT_TEMP_MAX} range"
            )
            print(f"       Got mode='{mode}' AND temperature={temp}")
            return 0.0
    except sqlite3.Error as e:
        print(f"FAIL: Database error: {e}")
        return 0.0


def check_d2_coffee_state():
    """D2: Coffee state — DB: start_time <= '06:30' (HARD REQUIRED)"""
    print("\n=== D2: Coffee State (HARD REQUIRED) ===")

    try:
        conn = sqlite3.connect(SQLITE_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT start_time FROM coffee_schedule WHERE id = 1")
        row = cursor.fetchone()
        conn.close()

        if row is None:
            print("FAIL: No coffee schedule record found")
            return 0.0

        start_time = row[0]
        print(f"Current coffee start_time: {start_time}")

        if start_time <= EXPECTED_COFFEE_START_TIME_MAX:
            print("D2: PASS (0.125)")
            return 0.125
        else:
            print(
                f"D2: FAIL - Expected start_time <= '{EXPECTED_COFFEE_START_TIME_MAX}', got '{start_time}'"
            )
            return 0.0
    except sqlite3.Error as e:
        print(f"FAIL: Database error: {e}")
        return 0.0


def check_d3_grocery_blue_mountain():
    """D3: Grocery Blue Mountain — DB: entry with quantity=20g AND reference='expired' (HARD REQUIRED)"""
    print("\n=== D3: Grocery Blue Mountain (HARD REQUIRED) ===")

    try:
        conn = sqlite3.connect(SQLITE_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT name, quantity, reference FROM grocery_product")
        rows = cursor.fetchall()
        conn.close()

        print(f"Grocery entries: {[(r[0], r[1], r[2]) for r in rows]}")

        for name, quantity, reference in rows:
            name_lower = name.lower()
            if "blue mountain" in name_lower and "coffee" in name_lower:
                qty_ok = (
                    EXPECTED_GROCERY_BLUE_MOUNTAIN_QTY - 2
                    <= quantity
                    <= EXPECTED_GROCERY_BLUE_MOUNTAIN_QTY + 2
                )
                reason_ok = reference is not None and (
                    "expired" in reference.lower() or "expire" in reference.lower()
                )
                if qty_ok and reason_ok:
                    print(
                        f"D3: PASS - Found Blue Mountain entry with quantity={quantity}g and reason='{reference}'"
                    )
                    return 0.125
                else:
                    print(
                        f"D3: FAIL - Blue Mountain found but quantity={quantity}g (expected 20±2) or reason='{reference}' (expected 'expired')"
                    )
                    return 0.0

        print("D3: FAIL - No Blue Mountain coffee entry found")
        return 0.0
    except sqlite3.Error as e:
        print(f"FAIL: Database error: {e}")
        return 0.0


def check_d4_grocery_kenya_aa():
    """D4: Grocery Kenya AA — DB: entry with quantity=8g AND reference='insufficient/shortage' (HARD REQUIRED)"""
    print("\n=== D4: Grocery Kenya AA (HARD REQUIRED) ===")

    try:
        conn = sqlite3.connect(SQLITE_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT name, quantity, reference FROM grocery_product")
        rows = cursor.fetchall()
        conn.close()

        for name, quantity, reference in rows:
            name_lower = name.lower()
            if "kenya" in name_lower:
                qty_ok = (
                    EXPECTED_GROCERY_KENYA_AA_QTY - 1
                    <= quantity
                    <= EXPECTED_GROCERY_KENYA_AA_QTY + 1
                )
                reason_ok = reference is not None and (
                    "insufficient" in reference.lower()
                    or "shortage" in reference.lower()
                )
                if qty_ok and reason_ok:
                    print(
                        f"D4: PASS - Found Kenya AA entry with quantity={quantity}g and reason='{reference}'"
                    )
                    return 0.125
                else:
                    print(
                        f"D4: FAIL - Kenya AA found but quantity={quantity}g (expected 8±1) or reason='{reference}' (expected 'insufficient/shortage')"
                    )
                    return 0.0

        print("D4: FAIL - No Kenya AA entry found")
        return 0.0
    except sqlite3.Error as e:
        print(f"FAIL: Database error: {e}")
        return 0.0


def check_d5_response_environmental(response):
    """D5: Response environmental — humidity anomaly AND humidity→thermostat causal link AND thermostat correction"""
    print("\n=== D5: Response Environmental ===")

    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    response_lower = response.lower()
    found = 0

    # Check humidity anomaly mention (999% or sensor malfunction)
    has_humidity = "999" in response_lower or (
        "humidity" in response_lower
        and (
            "anomaly" in response_lower
            or "malfunction" in response_lower
            or "sensor" in response_lower
        )
    )
    if has_humidity:
        print("PASS: Humidity anomaly mentioned")
        found += 1
    else:
        print("FAIL: Humidity anomaly not mentioned")

    # Check causal link: humidity/sensor caused thermostat corruption (must be in same context)
    # Pattern: humidity/sensor + causal word + thermostat (within ~50 chars)
    has_causal_link = False
    sentences = re.split(r"[.!?\n]", response_lower)
    for sentence in sentences:
        if (
            "humidity" in sentence or "sensor" in sentence or "999" in sentence
        ) and "thermostat" in sentence:
            causal_words = [
                "caused",
                "cause",
                "trigger",
                "triggered",
                "led to",
                "resulted in",
                "protection mode",
                "corrupted",
                "because of",
                "due to",
            ]
            if any(word in sentence for word in causal_words):
                has_causal_link = True
                break
    if has_causal_link:
        print(
            "PASS: Causal link between humidity/sensor and thermostat in same sentence"
        )
        found += 1
    else:
        print(
            "FAIL: Causal link between humidity/sensor and thermostat not in same sentence"
        )

    # Check thermostat correction mention
    if "thermostat" in response_lower and (
        "comfort" in response_lower
        or "corrected" in response_lower
        or "fix" in response_lower
        or "adjust" in response_lower
    ):
        print("PASS: Thermostat correction mentioned")
        found += 1
    else:
        print("FAIL: Thermostat correction not mentioned")

    if found == 3:
        print("D5: PASS (0.125)")
        return 0.125
    else:
        print(f"D5: FAIL (0.0) - found {found}/3 required elements")
        return 0.0


def check_d6_response_coffee_timing(response):
    """D6: Response coffee timing — 30-min brew AND 06:30 AND 7am/departure inference (all three required for full credit)"""
    print("\n=== D6: Response Coffee Timing ===")

    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    response_lower = response.lower()
    found = 0

    # Check explicit 30-minute brew duration
    has_30min = "30" in response_lower and (
        "min" in response_lower or "minute" in response_lower
    )
    if has_30min:
        print("PASS: Explicit 30-minute brew duration mentioned")
        found += 1
    else:
        print("FAIL: Explicit 30-minute brew duration not mentioned")

    # Check 06:30 start time
    has_0630 = "06:30" in response_lower or "6:30" in response_lower
    if has_0630:
        print("PASS: Start time 06:30 mentioned")
        found += 1
    else:
        print("FAIL: Start time 06:30 not mentioned")

    # Check 7am/departure inference (must tie brew time to departure)
    has_departure_inference = False
    sentences = re.split(r"[.!?\n]", response_lower)
    for sentence in sentences:
        if ("30" in sentence or "brew" in sentence) and (
            "7" in sentence
            or "07:" in sentence
            or "leave" in sentence
            or "departure" in sentence
            or "ready by" in sentence
        ):
            has_departure_inference = True
            break
    if has_departure_inference:
        print("PASS: 7am/departure inference tied to brew time")
        found += 1
    else:
        print("FAIL: 7am/departure inference not tied to brew time")

    if found == 3:
        print("D6: PASS (0.125)")
        return 0.125
    else:
        print(f"D6: FAIL (0.0) - found {found}/3 required elements")
        return 0.0


def check_d7_response_inventory(response):
    """D7: Response inventory — Blue Mountain expired AND Kenya AA insufficient"""
    print("\n=== D7: Response Inventory ===")

    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    response_lower = response.lower()
    found = 0

    if "blue mountain" in response_lower and (
        "expired" in response_lower or "expire" in response_lower
    ):
        print("PASS: Blue Mountain expired mentioned")
        found += 1
    else:
        print("FAIL: Blue Mountain expired not mentioned")

    if "kenya" in response_lower and (
        "insufficient" in response_lower
        or "shortage" in response_lower
        or "12" in response_lower
        or "not enough" in response_lower
    ):
        print("PASS: Kenya AA insufficient mentioned")
        found += 1
    else:
        print("FAIL: Kenya AA insufficient not mentioned")

    if found == 2:
        print("D7: PASS (0.125)")
        return 0.125
    elif found == 1:
        print("D7: PARTIAL (0.0625)")
        return 0.0625
    else:
        print("D7: FAIL (0.0)")
        return 0.0


def check_d8_response_cross_reference(response):
    """D8: Response cross-reference — Kenya AA is coffee bean (cross-referenced)"""
    print("\n=== D8: Response Cross-Reference ===")

    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    response_lower = response.lower()

    if "kenya" in response_lower and "coffee" in response_lower:
        if (
            "cross" in response_lower
            or "reference" in response_lower
            or "machine" in response_lower
            or "bean" in response_lower
        ):
            print("PASS: Kenya AA cross-referenced as coffee bean")
            print("D8: PASS (0.125)")
            return 0.125
        else:
            print(
                "PARTIAL: Kenya AA mentioned with coffee but no explicit cross-reference"
            )
            print("D8: PARTIAL (0.0625)")
            return 0.0625

    print("FAIL: Kenya AA cross-reference not mentioned")
    print("D8: FAIL (0.0)")
    return 0.0


def main():
    print("=" * 60)
    print("Morning Comfort Setup Verification")
    print("=" * 60)

    response = get_agent_response()

    results = {}
    results["D1"] = check_d1_thermostat_state()
    results["D2"] = check_d2_coffee_state()
    results["D3"] = check_d3_grocery_blue_mountain()
    results["D4"] = check_d4_grocery_kenya_aa()
    results["D5"] = check_d5_response_environmental(response)
    results["D6"] = check_d6_response_coffee_timing(response)
    results["D7"] = check_d7_response_inventory(response)
    results["D8"] = check_d8_response_cross_reference(response)

    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)

    total_score = 0.0
    passed_count = 0

    for dim, score in results.items():
        status = "PASS" if score >= 0.125 else "PARTIAL" if score >= 0.042 else "FAIL"
        hard_req = " (HARD REQUIRED)" if dim in ["D1", "D2", "D3", "D4"] else ""
        print(f"  {dim}: {score:.3f}/0.125 [{status}]{hard_req}")
        total_score += score
        if score >= 0.125:
            passed_count += 1

    print(f"\nTotal Score: {total_score:.3f}/1.0")
    print(f"Dimensions passed: {passed_count}/8")

    # Check hard requirements (D1, D2, D3, D4)
    hard_req_pass = all(results[d] >= 0.125 for d in ["D1", "D2", "D3", "D4"])
    print(
        f"Hard requirements: D1={results['D1'] >= 0.125}, D2={results['D2'] >= 0.125}, D3={results['D3'] >= 0.125}, D4={results['D4'] >= 0.125}"
    )

    with open("/logs/verifier/reward.txt", "w") as f:
        f.write(f"{total_score:.3f}\n")

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

    # Pass threshold: >= 0.75 AND all hard requirements met
    threshold_pass = total_score >= 0.75 and hard_req_pass
    sys.exit(0 if threshold_pass else 1)


if __name__ == "__main__":
    main()
