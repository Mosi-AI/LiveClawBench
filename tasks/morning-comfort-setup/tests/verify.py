#!/usr/bin/env python3
"""
Verify morning-comfort-setup task: 8-dimension scoring.

Dimensions:
- D1: Thermostat state — DB: mode='comfort' AND temperature in 72-77 range (0.2 pts, HARD REQUIRED; one of two conditions correct = 0.1)
- D2: Coffee state — DB: today's start_time stays at '08:00' AND tomorrow's start_time <= '06:30' (0.2 pts, HARD REQUIRED; tomorrow correct = 0.15, today unchanged = 0.05)
- D3: Grocery Blue Mountain — DB: entry with quantity>=20g AND reference='expired' (0.1 pts, HARD REQUIRED)
- D4: Grocery Kenya AA — DB: entry with quantity>=8g AND reference='insufficient/shortage' (0.1 pts, HARD REQUIRED)
- D5: Response environmental — humidity anomaly AND humidity→thermostat causal link AND thermostat correction (0.1 pts)
- D6: Response coffee timing — 30-min brew AND tomorrow/date AND 06:30 AND 7am/departure inference (0.1 pts; keep half-credit design)
- D7: Response inventory — Blue Mountain expired AND Kenya AA insufficient (0.1 pts; keep half-credit design)
- D8: Response shopping-list action — reports coffee beans were added to the shopping list (0.1 pts; both = full credit, one = half credit)

Pass threshold: >= 0.75
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
EXPECTED_TODAY_COFFEE_START_TIME = "08:00"
EXPECTED_TOMORROW_COFFEE_START_TIME_MAX = "06:30"
EXPECTED_GROCERY_BLUE_MOUNTAIN_MIN_QTY = 20
EXPECTED_GROCERY_KENYA_AA_MIN_QTY = 8


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
    """D1: Thermostat state — 0.2 pts total; mode and temperature are worth 0.1 each"""
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

        mode_ok = mode == EXPECTED_THERMOSTAT_MODE
        temp_ok = EXPECTED_THERMOSTAT_TEMP_MIN <= temp <= EXPECTED_THERMOSTAT_TEMP_MAX
        score = 0.0
        if mode_ok:
            score += 0.1
        if temp_ok:
            score += 0.1

        if score == 0.2:
            print("D1: PASS (0.2)")
        elif score == 0.1:
            print("D1: PARTIAL (0.1)")
        else:
            print(
                f"D1: FAIL - Expected mode='{EXPECTED_THERMOSTAT_MODE}' AND temperature in {EXPECTED_THERMOSTAT_TEMP_MIN}-{EXPECTED_THERMOSTAT_TEMP_MAX} range"
            )
            print(f"       Got mode='{mode}' AND temperature={temp}")
        return score
    except sqlite3.Error as e:
        print(f"FAIL: Database error: {e}")
        return 0.0


def check_d2_coffee_state():
    """D2: Coffee state — 0.2 pts total; tomorrow correct = 0.15, today unchanged = 0.05"""
    print("\n=== D2: Coffee State (HARD REQUIRED) ===")

    try:
        conn = sqlite3.connect(SQLITE_DB)
        cursor = conn.cursor()
        cursor.execute("SELECT start_time FROM coffee_schedule WHERE schedule_date = '2026-05-09'")
        today_row = cursor.fetchone()
        cursor.execute("SELECT start_time FROM coffee_schedule WHERE schedule_date = '2026-05-10'")
        tomorrow_row = cursor.fetchone()
        conn.close()

        if today_row is None:
            print("FAIL: No coffee schedule record found for 2026-05-09")
            return 0.0
        if tomorrow_row is None:
            print("FAIL: No coffee schedule record found for 2026-05-10")
            return 0.0

        today_start_time = today_row[0]
        tomorrow_start_time = tomorrow_row[0]
        print(f"Today's coffee start_time: {today_start_time}")
        print(f"Tomorrow's coffee start_time: {tomorrow_start_time}")

        today_ok = today_start_time == EXPECTED_TODAY_COFFEE_START_TIME
        tomorrow_ok = tomorrow_start_time <= EXPECTED_TOMORROW_COFFEE_START_TIME_MAX
        score = 0.0
        if tomorrow_ok:
            score += 0.15
        if today_ok:
            score += 0.05

        if score == 0.2:
            print("D2: PASS (0.2)")
        elif score > 0:
            print(f"D2: PARTIAL ({score})")
        else:
            print(
                f"D2: FAIL - Expected today's start_time == '{EXPECTED_TODAY_COFFEE_START_TIME}' and tomorrow's start_time <= '{EXPECTED_TOMORROW_COFFEE_START_TIME_MAX}', got today='{today_start_time}' and tomorrow='{tomorrow_start_time}'"
            )
        return score
    except sqlite3.Error as e:
        print(f"FAIL: Database error: {e}")
        return 0.0


def check_d3_grocery_blue_mountain():
    """D3: Grocery Blue Mountain — DB: entry with quantity>=20g AND reference='expired' (HARD REQUIRED)"""
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
                qty_ok = quantity >= EXPECTED_GROCERY_BLUE_MOUNTAIN_MIN_QTY
                reason_ok = reference is not None and (
                    "expired" in reference.lower() or "expire" in reference.lower()
                )
                if qty_ok and reason_ok:
                    print(
                        f"D3: PASS - Found Blue Mountain entry with quantity={quantity}g and reason='{reference}'"
                    )
                    return 0.1
                else:
                    print(
                        f"D3: FAIL - Blue Mountain found but quantity={quantity}g (expected >= {EXPECTED_GROCERY_BLUE_MOUNTAIN_MIN_QTY}) or reason='{reference}' (expected 'expired')"
                    )
                    return 0.0

        print("D3: FAIL - No Blue Mountain coffee entry found")
        return 0.0
    except sqlite3.Error as e:
        print(f"FAIL: Database error: {e}")
        return 0.0


def check_d4_grocery_kenya_aa():
    """D4: Grocery Kenya AA — DB: entry with quantity>=8g AND reference='insufficient/shortage' (HARD REQUIRED)"""
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
                qty_ok = quantity >= EXPECTED_GROCERY_KENYA_AA_MIN_QTY
                reason_ok = reference is not None and (
                    "insufficient" in reference.lower()
                    or "shortage" in reference.lower()
                )
                if qty_ok and reason_ok:
                    print(
                        f"D4: PASS - Found Kenya AA entry with quantity={quantity}g and reason='{reference}'"
                    )
                    return 0.1
                else:
                    print(
                        f"D4: FAIL - Kenya AA found but quantity={quantity}g (expected >= {EXPECTED_GROCERY_KENYA_AA_MIN_QTY}) or reason='{reference}' (expected 'insufficient/shortage')"
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
        print("D5: PASS (0.1)")
        return 0.1
    else:
        print(f"D5: FAIL (0.0) - found {found}/3 required elements")
        return 0.0


def check_d6_response_coffee_timing(response):
    """D6: Response coffee timing — 30-min brew AND tomorrow/date AND 06:30 AND 7am/departure inference"""
    print("\n=== D6: Response Coffee Timing ===")

    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    response_lower = response.lower()
    found = 0

    has_30min = "30" in response_lower and (
        "min" in response_lower or "minute" in response_lower
    )
    if has_30min:
        print("PASS: Explicit 30-minute brew duration mentioned")
        found += 1
    else:
        print("FAIL: Explicit 30-minute brew duration not mentioned")

    has_tomorrow_reference = (
        "tomorrow" in response_lower
        or "2026-05-10" in response_lower
        or "2026/05/10" in response_lower
    )
    if has_tomorrow_reference:
        print("PASS: Tomorrow/date reference mentioned")
    else:
        print("FAIL: Tomorrow/date reference not mentioned")

    has_0630 = "06:30" in response_lower or "6:30" in response_lower
    if has_0630:
        print("PASS: Start time 06:30 mentioned")
        found += 1
    else:
        print("FAIL: Start time 06:30 not mentioned")

    has_departure_inference = False
    sentences = re.split(r"[.!?\n]", response_lower)
    for sentence in sentences:
        if ("30" in sentence or "brew" in sentence or "06:30" in sentence or "6:30" in sentence) and (
            "tomorrow" in sentence
            or "2026-05-10" in sentence
            or "7" in sentence
            or "07:" in sentence
            or "leave" in sentence
            or "departure" in sentence
            or "ready by" in sentence
        ):
            has_departure_inference = True
            break
    if has_departure_inference:
        print("PASS: Tomorrow's 7am/departure inference tied to brew time")
        found += 1
    else:
        print("FAIL: Tomorrow's 7am/departure inference not tied to brew time")

    if found == 3 and has_tomorrow_reference:
        print("D6: PASS (0.1)")
        return 0.1
    elif found >= 2:
        print("D6: PARTIAL (0.05)")
        return 0.05
    else:
        print(f"D6: FAIL (0.0) - found {found}/3 required elements, tomorrow/date required")
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
        print("D7: PASS (0.1)")
        return 0.1
    elif found == 1:
        print("D7: PARTIAL (0.05)")
        return 0.05
    else:
        print("D7: FAIL (0.0)")
        return 0.0


def check_d8_response_shopping_list_action(response):
    """D8: Response shopping-list action — reports coffee beans were added to the shopping list"""
    print("\n=== D8: Response Shopping List Action ===")

    if response is None:
        print("FAIL: Could not get agent response")
        return 0.0

    response_lower = response.lower()
    sentences = [s.strip() for s in re.split(r"[.!?\n]", response_lower) if s.strip()]

    list_action_patterns = [
        r"shopping list",
        r"grocery list",
        r"added",
        r"put",
        r"included",
        r"placed",
        r"on the list",
    ]

    def sentence_mentions_item_added(sentence: str, item_keywords: list[str]) -> bool:
        has_item = all(keyword in sentence for keyword in item_keywords)
        has_list = any(re.search(pattern, sentence) for pattern in list_action_patterns)
        return has_item and has_list

    blue_mountain_reported = any(
        sentence_mentions_item_added(sentence, ["blue", "mountain"])
        for sentence in sentences
    )
    kenya_aa_reported = any(
        sentence_mentions_item_added(sentence, ["kenya"])
        for sentence in sentences
    )

    if blue_mountain_reported and kenya_aa_reported:
        print("PASS: Report says both coffee bean items were added to the shopping list")
        print("D8: PASS (0.1)")
        return 0.1
    elif blue_mountain_reported or kenya_aa_reported:
        reported_item = "Blue Mountain" if blue_mountain_reported else "Kenya AA"
        print(f"PARTIAL: Report says only {reported_item} was added to the shopping list")
        print("D8: PARTIAL (0.05)")
        return 0.05

    print("FAIL: Report does not clearly say the named coffee bean items were added to the shopping list")
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
    results["D8"] = check_d8_response_shopping_list_action(response)

    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)

    total_score = 0.0
    passed_count = 0

    for dim, score in results.items():
        max_score = 0.2 if dim in ["D1", "D2"] else 0.1
        partial_threshold = 0.1 if dim == "D1" else 0.05
        status = "PASS" if score >= max_score else "PARTIAL" if score >= partial_threshold else "FAIL"
        hard_req = " (HARD REQUIRED)" if dim in ["D1", "D2", "D3", "D4"] else ""
        print(f"  {dim}: {score:.3f}/{max_score:.3f} [{status}]{hard_req}")
        total_score += score
        if score >= max_score:
            passed_count += 1

    print(f"\nTotal Score: {total_score:.3f}/1.0")
    print(f"Dimensions passed: {passed_count}/8")

    # Check hard requirements (D1, D2, D3, D4)
    hard_req_pass = all(
        [
            results["D1"] >= 0.2,
            results["D2"] >= 0.2,
            results["D3"] >= 0.1,
            results["D4"] >= 0.1,
        ]
    )
    print(
        f"Hard requirements: D1={results['D1'] >= 0.2}, D2={results['D2'] >= 0.2}, D3={results['D3'] >= 0.1}, D4={results['D4'] >= 0.1}"
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
