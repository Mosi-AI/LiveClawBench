#!/usr/bin/env python3
import json
import re
import sqlite3
import sys
from pathlib import Path

HEALTH_DB_PATH = Path("/workspace/health.db")
SMARTHOME_DB_PATH = Path("/tmp/mosi_smart_home.sqlite")
SHOP_ORDERS_PATH = Path("/tmp/mosi_shop_orders.json")
REWARD_DIR = Path("/logs/verifier")
FINAL_RESPONSE_FALLBACK = Path("/logs/agent/final_response.txt")
HARBOR_LOG_CANDIDATES = [
    Path("/workspace/.openclaw/agents/main/sessions/harbor.jsonl"),
    Path("/root/.openclaw/agents/main/sessions/harbor.jsonl"),
    Path("/logs/agent/openclaw-state/agents/main/sessions/harbor.jsonl"),
    Path("/logs/agent/harbor.jsonl"),
]

TODAY = "2026-05-09"
TOMORROW = "2026-05-10"
FUTURE_START = "2026-05-10T00:00:00Z"
FUTURE_END = "2026-05-16T23:59:59Z"
ORIGINAL_ORDER_IDS = {"ORD000001", "ORD000002", "ORD000003", "ORD000004", "ORD000005"}
FULL_RECOVERY_WORKOUTS = {"yoga", "walking", "rest"}
MEDIUM_INTENSITY_WORKOUTS = {"swimming", "cycling"}
HIGH_INTENSITY_WORKOUTS = {"hiit", "strength"}
ORIGINAL_FUTURE_WORKOUT_TYPES = {
    "2026-05-10": "hiit",
    "2026-05-11": "strength",
    "2026-05-12": "swimming",
    "2026-05-13": "hiit",
    "2026-05-14": "strength",
    "2026-05-15": "swimming",
    "2026-05-16": "hiit",
}

SLEEP_METRIC_TERMS = {
    "sleep_quality": ["sleep quality", "sleep score"],
    "sleep_hours": ["sleep duration", "sleep hours", "sleep total", "true sleep"],
    "light_sleep_hours": ["light sleep"],
    "deep_sleep_hours": ["deep sleep"],
    "rem_sleep_hours": ["rem sleep", "rem"],
}
SLEEP_METRIC_WINDOWS = (7, 14, 30)
SEVEN_DAY_SLEEP_SCORE = 0.03
LONG_WINDOW_SLEEP_SCORE = 0.003
EXERCISE_TREND_SCORE = 0.01
WORKOUT_INFERENCE_TOTAL = 0.08
RESPONSE_CONTENT_TOTAL = 0.42

EXERCISE_TREND_ANOMALIES = [
    ("low_intensity_7_min", ["low intensity", "7"], ["8"], ["12.9"]),
    ("medium_intensity_7_average", ["medium intensity", "7"], [], ["6.64", "6.6"]),
    ("high_intensity_7_average", ["high intensity", "7"], ["48"], ["35"]),
    ("high_intensity_14_average", ["high intensity", "14"], ["22"], ["35"]),
]


def close_enough(value, expected, tolerance=0.05):
    try:
        return abs(float(value) - expected) <= tolerance
    except (TypeError, ValueError):
        return False


def norm(text):
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def mentions_number(text, candidates):
    for candidate in candidates:
        raw = str(candidate)
        pattern = re.escape(raw).replace(r"\.", r"[.]?")
        if re.search(rf"(?<!\d){pattern}(?!\d)", text):
            return True
    return False


def number_candidates(value):
    candidates = {f"{float(value):.2f}", f"{float(value):.1f}"}
    if close_enough(float(value), round(float(value)), tolerance=0.001):
        candidates.add(str(int(round(float(value)))))
    return sorted(candidates)


def window_mentioned(text, days):
    normalized = norm(text)
    return bool(
        re.search(rf"\b{days}\b", normalized)
        or f"{days}day" in text
        or f"{days}-day" in text
    )


def metric_mentioned(text, metric_type):
    normalized = norm(text)
    return any(term in normalized for term in SLEEP_METRIC_TERMS[metric_type])


def metric_window_summary(conn, metric_type, days):
    rows = conn.execute(
        """
        SELECT value
        FROM health_metric_series
        WHERE user_id = 1
          AND metric_type = ?
          AND date BETWEEN date(?, ?) AND ?
        ORDER BY date
        """,
        (metric_type, TODAY, f"-{days - 1} day", TODAY),
    ).fetchall()
    if len(rows) != days:
        raise ValueError(f"missing {days}-day {metric_type} rows")
    values = [float(value) for (value,) in rows]
    return {
        "mean": round(sum(values) / len(values), 2),
        "min": round(min(values), 2),
        "max": round(max(values), 2),
        "latest": round(values[-1], 2),
    }


def metric_window_numbers(summary):
    candidates = []
    for value in summary.values():
        candidates.extend(number_candidates(value))
    return sorted(set(candidates))


def load_shop_orders(path=SHOP_ORDERS_PATH):
    return json.loads(Path(path).read_text())


def order_items_by_id(orders):
    result = {}
    for order in orders:
        order_id = order.get("order_id", "")
        items = order.get("items") or []
        if order_id and items:
            result[order_id] = items[0]
    return result


def order_matches(order, product_terms, quantity=None):
    items = order.get("items") or []
    for item in items:
        title = (item.get("title") or "").lower()
        if all(term in title for term in product_terms):
            if quantity is None or int(item.get("quantity", 0)) == quantity:
                return True
    return False


def valid_new_order_reference(reference, orders, product_terms):
    if not reference or reference in ORIGINAL_ORDER_IDS:
        return False
    for order in orders:
        if order.get("order_id") == reference and order_matches(order, product_terms, quantity=1):
            return True
    return False


def valid_new_order_exists(orders, product_terms):
    return any(
        order.get("order_id") not in ORIGINAL_ORDER_IDS
        and order_matches(order, product_terms, quantity=1)
        for order in orders
    )


def read_health_signal(conn):
    row = conn.execute(
        """
        SELECT sleep_hours, sleep_quality, light_sleep_hours, deep_sleep_hours, rem_sleep_hours,
               low_intensity_min, medium_intensity_min, high_intensity_min, resting_heart_rate_bpm
        FROM health_daily_snapshot WHERE user_id = 1 AND date = ?
        """,
        (TODAY,),
    ).fetchone()
    if row is None:
        raise ValueError("missing benchmark-day health snapshot")
    sleep_hours, sleep_quality, light, deep, rem, low, medium, high, rhr = row
    true_sleep = round(float(light) + float(deep) + float(rem), 2)

    overrides = {
        (metric, days): {"mean": mean, "min": min_v, "max": max_v, "has_mean": has_mean, "has_min": has_min, "has_max": has_max}
        for metric, days, mean, min_v, max_v, has_mean, has_min, has_max in conn.execute(
            """
            SELECT metric_type, days, mean, min, max, has_mean, has_min, has_max
            FROM health_trend_override WHERE user_id = 1
            """
        )
    }
    required = {
        ("sleep_quality", 7), ("sleep_quality", 30), ("sleep_hours", 14),
        ("sleep_hours", 30), ("low_intensity_min", 7), ("high_intensity_min", 7),
        ("high_intensity_min", 14),
    }
    missing = required - set(overrides)
    if missing:
        raise ValueError(f"missing trend overrides: {sorted(missing)}")

    sleep_windows = {
        days: {
            metric_type: metric_window_summary(conn, metric_type, days)
            for metric_type in SLEEP_METRIC_TERMS
        }
        for days in SLEEP_METRIC_WINDOWS
    }

    return {
        "display_sleep_hours": float(sleep_hours),
        "true_sleep_hours": true_sleep,
        "sleep_quality": float(sleep_quality),
        "light_sleep_hours": float(light),
        "deep_sleep_hours": float(deep),
        "rem_sleep_hours": float(rem),
        "low_intensity_min": float(low),
        "medium_intensity_min": float(medium),
        "high_intensity_min": float(high),
        "resting_heart_rate_bpm": int(rhr),
        "overrides": overrides,
        "sleep_windows": sleep_windows,
    }


def score_wearable_repair(conn):
    row = conn.execute("SELECT sleep_hours, readiness FROM wearable_recovery_state WHERE id = 1").fetchone()
    if row is None:
        return 0.0, False, "sleep_hours=None readiness=None"
    sleep_hours, readiness = row
    sleep_pass = close_enough(sleep_hours, 6.5)
    readiness_pass = close_enough(readiness, 68.0)
    score = (0.04 if sleep_pass else 0.0) + (0.04 if readiness_pass else 0.0)
    return round(score, 2), sleep_pass and readiness_pass, f"sleep_hours={sleep_hours} readiness={readiness}"


def score_future_workouts(conn):
    rows = conn.execute(
        """
        SELECT substr(start_time, 1, 10), title, workout_type
        FROM calendar_event
        WHERE event_type = 'workout' AND start_time BETWEEN ? AND ?
        ORDER BY start_time
        """,
        (FUTURE_START, FUTURE_END),
    ).fetchall()
    by_date = {row[0]: (row[1], (row[2] or "").lower()) for row in rows}
    full_credit_dates = []
    partial_credit_dates = []
    failures = []
    for d, original_type in ORIGINAL_FUTURE_WORKOUT_TYPES.items():
        item = by_date.get(d)
        current_type = None if item is None else item[1]
        if current_type in FULL_RECOVERY_WORKOUTS:
            full_credit_dates.append(d)
        elif original_type in HIGH_INTENSITY_WORKOUTS and current_type in MEDIUM_INTENSITY_WORKOUTS:
            partial_credit_dates.append(d)
        elif original_type == "swimming" and current_type in MEDIUM_INTENSITY_WORKOUTS:
            partial_credit_dates.append(d)
        else:
            failures.append(f"{d}:{current_type}")
    score_units = len(full_credit_dates) + 0.5 * len(partial_credit_dates)
    score = round(0.10 * score_units / len(ORIGINAL_FUTURE_WORKOUT_TYPES), 4)
    passed = score_units == len(ORIGINAL_FUTURE_WORKOUT_TYPES)
    if passed:
        detail = "all seven future workouts downgraded for full credit"
    else:
        detail_parts = []
        if partial_credit_dates:
            detail_parts.append(
                "partial credit: " + ", ".join(partial_credit_dates)
            )
        if failures:
            detail_parts.append("no credit: " + ", ".join(failures))
        detail = "; ".join(detail_parts) or "no future workout credit"
    return score, passed, detail


def future_workout_change_observed(conn):
    rows = conn.execute(
        """
        SELECT substr(start_time, 1, 10), workout_type
        FROM calendar_event
        WHERE event_type = 'workout' AND start_time BETWEEN ? AND ?
        ORDER BY start_time
        """,
        (FUTURE_START, FUTURE_END),
    ).fetchall()
    by_date = {date: (workout_type or "").lower() for date, workout_type in rows}
    return any(
        by_date.get(date) != original_type
        for date, original_type in ORIGINAL_FUTURE_WORKOUT_TYPES.items()
    )


def time_to_minutes(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{2}:\d{2}", value):
        return None
    hour, minute = map(int, value.split(":"))
    if hour > 23 or minute > 59:
        return None
    return hour * 60 + minute


def score_tomorrow_coffee(conn):
    row = conn.execute("SELECT start_time, cancelled FROM coffee_schedule WHERE schedule_date = ?", (TOMORROW,)).fetchone()
    if row is None:
        return 0.0, False, "missing tomorrow coffee"
    start_time, cancelled = row
    if int(cancelled) != 0:
        return 0.0, False, "tomorrow coffee cancelled"
    minutes = time_to_minutes(start_time)
    if minutes is None:
        return 0.0, False, f"invalid time {start_time}"
    if start_time == "08:30":
        return 0.08, True, "08:30"
    if time_to_minutes("08:00") <= minutes <= time_to_minutes("08:29"):
        return 0.06, True, start_time
    if time_to_minutes("07:30") <= minutes <= time_to_minutes("07:59"):
        return 0.03, True, start_time
    return 0.0, False, start_time


def score_today_coffee(conn):
    row = conn.execute("SELECT start_time, cancelled FROM coffee_schedule WHERE schedule_date = ?", (TODAY,)).fetchone()
    passed = row is not None and row[0] == "07:00" and int(row[1]) == 0
    return (0.04 if passed else 0.0), passed, f"today_coffee={row}"


def grocery_rows(conn):
    rows = conn.execute("SELECT product_id, name, quantity, unit, stock_status, reference FROM grocery_product").fetchall()
    return {norm(name): {"product_id": product_id, "name": name, "quantity": quantity, "unit": unit, "stock_status": stock_status, "reference": reference} for product_id, name, quantity, unit, stock_status, reference in rows}


def score_shopping_list(conn, orders):
    rows = grocery_rows(conn)
    checks = {}
    butter = rows.get("salted butter")
    checks["salted_butter"] = 1.0 if butter and close_enough(butter["quantity"], 1.0) and butter["unit"] == "lb" and butter["reference"] == "ORD000005" else 0.0
    coq10 = rows.get("coq10")
    checks["coq10_reference"] = 1.0 if coq10 and coq10["reference"] == "ORD000001" and close_enough(coq10["quantity"], 30.0) and coq10["unit"] == "capsules" and coq10["stock_status"] == "sufficient" else 0.0
    omega = rows.get("omega 3")
    checks["omega3_entry"] = 1.0 if omega and close_enough(omega["quantity"], 60.0) and omega["unit"] == "softgels" and omega["reference"] == "ORD000003" else 0.0
    magnesium = rows.get("magnesium")
    checks["magnesium_entry"] = 1.0 if magnesium and close_enough(magnesium["quantity"], 60.0) and magnesium["unit"] == "tablets" and magnesium["stock_status"] == "sufficient" and valid_new_order_reference(magnesium["reference"], orders, ["magnesium", "60", "tablets"]) else 0.0
    valerian = rows.get("valerian root")
    valerian_full = bool(valerian and close_enough(valerian["quantity"], 60.0) and valerian["unit"] == "capsules" and valerian["stock_status"] == "sufficient" and valid_new_order_reference(valerian["reference"], orders, ["valerian", "60", "capsules"]))
    valerian_sleep_tea_partial = bool(
        not valerian_full
        and valid_new_order_exists(orders, ["valerian", "sleep", "tea"])
    )
    checks["valerian_entry"] = 1.0 if valerian_full else 0.5 if valerian_sleep_tea_partial else 0.0
    score = 0.05 * sum(checks.values())
    return round(score, 2), all(value == 1.0 for value in checks.values()), checks


def score_new_orders(orders):
    magnesium = any(order.get("order_id") not in ORIGINAL_ORDER_IDS and order_matches(order, ["magnesium", "60", "tablets"], quantity=1) for order in orders)
    valerian = any(order.get("order_id") not in ORIGINAL_ORDER_IDS and order_matches(order, ["valerian", "60", "capsules"], quantity=1) for order in orders)
    return round((0.035 if magnesium else 0.0) + (0.035 if valerian else 0.0), 3), {"magnesium_order": magnesium, "valerian_order": valerian}


def protected_meetings_unchanged(conn):
    rows = conn.execute(
        """
        SELECT substr(start_time, 1, 10), title, start_time, event_type, workout_type
        FROM calendar_event
        WHERE event_type = 'meeting' AND start_time BETWEEN ? AND ?
        ORDER BY start_time
        """,
        (FUTURE_START, FUTURE_END),
    ).fetchall()
    expected = [(f"2026-05-{day:02d}", "Team Standup", f"2026-05-{day:02d}T09:00:00Z", "meeting", None) for day in range(10, 17)]
    return rows == expected


def score_state(conn, orders):
    wearable_score, wearable_pass, wearable_detail = score_wearable_repair(conn)
    future_score, future_pass, future_detail = score_future_workouts(conn)
    future_action = future_workout_change_observed(conn)
    tomorrow_score, tomorrow_pass, tomorrow_detail = score_tomorrow_coffee(conn)
    today_score, today_pass, today_detail = score_today_coffee(conn)
    shopping_score, shopping_pass, shopping_checks = score_shopping_list(conn, orders)
    orders_score, order_checks = score_new_orders(orders)
    meetings_pass = protected_meetings_unchanged(conn)
    required_blockers_passed = wearable_pass and future_pass and today_pass and shopping_pass and meetings_pass
    return {
        "wearable_repair": wearable_score,
        "future_workouts": future_score,
        "tomorrow_coffee": tomorrow_score,
        "today_coffee": today_score,
        "shopping_list": shopping_score,
        "new_orders": orders_score,
        "protected_meetings": 1.0 if meetings_pass else 0.0,
        "state_total": round(wearable_score + future_score + tomorrow_score + today_score + shopping_score + orders_score, 3),
        "required_blockers_passed": required_blockers_passed,
        "has_state_action": bool(wearable_score or future_action or tomorrow_score or shopping_score or orders_score),
        "_meta_wearable": wearable_detail,
        "_meta_future_workouts": future_detail,
        "_meta_tomorrow_coffee": tomorrow_detail,
        "_meta_today_coffee": today_detail,
        "_meta_shopping": shopping_checks,
        "_meta_orders": order_checks,
        "_meta_protected_meetings": "unchanged" if meetings_pass else "changed or missing",
    }


def sleep_window_response_score(text, health):
    sleep_windows = health.get("sleep_windows") if isinstance(health, dict) else None
    if not sleep_windows:
        empty = {
            f"{days}_{metric_type}": False
            for days in SLEEP_METRIC_WINDOWS
            for metric_type in SLEEP_METRIC_TERMS
        }
        return 0.0, 0.0, empty

    found = {}
    seven_day_score = 0.0
    long_window_score = 0.0
    for days in SLEEP_METRIC_WINDOWS:
        for metric_type in SLEEP_METRIC_TERMS:
            summary = sleep_windows[days][metric_type]
            matched = (
                window_mentioned(text, days)
                and metric_mentioned(text, metric_type)
                and mentions_number(text, metric_window_numbers(summary))
            )
            key = f"{days}_{metric_type}"
            found[key] = bool(matched)
            if matched and days == 7:
                seven_day_score += SEVEN_DAY_SLEEP_SCORE
            elif matched:
                long_window_score += LONG_WINDOW_SLEEP_SCORE
    return round(seven_day_score, 3), round(long_window_score, 3), found


def exercise_trend_response_score(text):
    found = {}
    for key, terms, displayed_values, actual_values in EXERCISE_TREND_ANOMALIES:
        term_match = all(term in text for term in terms)
        displayed_match = not displayed_values or mentions_number(text, displayed_values)
        actual_match = mentions_number(text, actual_values)
        found[key] = bool(term_match and displayed_match and actual_match)
    return round(EXERCISE_TREND_SCORE * sum(found.values()), 2), found


def workout_inference_score(text):
    yoga = "yoga" in text and mentions_number(text, [45]) and re.search(r"done|completed", text)
    hiit = "hiit" in text and mentions_number(text, [30]) and re.search(r"done|completed", text)
    exclusions = all(word in text for word in ["strength", "cycling", "swimming"]) and re.search(r"incomplete|excluded|undone|not completed", text)
    score = (0.03 if yoga else 0.0) + (0.03 if hiit else 0.0) + (0.02 if exclusions else 0.0)
    return round(score, 2), {"yoga_45": bool(yoga), "hiit_30": bool(hiit), "incomplete_exclusions": bool(exclusions)}


def final_summary_score(text, sleep_found, exercise_found, workout_found):
    sleep_summary = re.search(r"sleep.*(inconsistent|mismatch|displayed|showed)", text) and mentions_number(text, [8.0, 8]) and mentions_number(text, [6.5]) and re.search(r"correct|updated|set", text)
    trends = sum(value for key, value in sleep_found.items() if key.startswith("7_")) >= 4 and sum(exercise_found.values()) >= 1
    workouts = workout_found.get("yoga_45") and workout_found.get("hiit_30") and workout_found.get("incomplete_exclusions")
    future = re.search(r"all\s+seven|seven|7", text) and re.search(r"high[- ]intensity|hiit|strength|swim", text) and re.search(r"yoga|walking|rest|recovery", text)
    coffee = ("08:30" in text or "8:30" in text) and ("09:00" in text or "9:00" in text) and re.search(r"30[- ]?minute|brew", text)
    shopping = all(term in text for term in ["salted butter", "coq10", "omega", "magnesium", "valerian"])
    score = (0.02 if sleep_summary else 0.0) + (0.02 if trends else 0.0) + (0.02 if workouts else 0.0) + (0.02 if future else 0.0) + (0.02 if coffee else 0.0) + (0.02 if shopping else 0.0)
    checks = {
        "sleep_summary": bool(sleep_summary),
        "trend_summary": bool(trends),
        "workout_summary": bool(workouts),
        "future_workout_summary": bool(future),
        "coffee_summary": bool(coffee),
        "shopping_summary": bool(shopping),
    }
    return round(score, 2), checks


def score_response_components(response, health):
    text = response.lower()
    seven_day_score, long_window_score, sleep_found = sleep_window_response_score(text, health)
    exercise_score, exercise_found = exercise_trend_response_score(text)
    workout_score, workout_found = workout_inference_score(text)
    summary_score, summary_found = final_summary_score(text, sleep_found, exercise_found, workout_found)
    scores = {
        "sleep_7day_analysis": seven_day_score,
        "sleep_14_30_analysis": long_window_score,
        "exercise_trend_analysis": exercise_score,
        "workout_inference": workout_score,
        "final_summary": summary_score,
    }
    details = {}
    if summary_score == 0.0:
        details["sleep_summary"] = "missing or incomplete"
    if seven_day_score < round(SEVEN_DAY_SLEEP_SCORE * len(SLEEP_METRIC_TERMS), 3):
        details["sleep_7day_analysis"] = {key: value for key, value in sleep_found.items() if key.startswith("7_") and not value}
    if long_window_score < 0.01:
        details["sleep_14_30_analysis"] = {key: value for key, value in sleep_found.items() if (key.startswith("14_") or key.startswith("30_")) and not value}
    if exercise_score < 0.02:
        details["exercise_trend_analysis"] = {key: value for key, value in exercise_found.items() if not value}
    if workout_score < WORKOUT_INFERENCE_TOTAL:
        details["workout_inference"] = {key: value for key, value in workout_found.items() if not value}
    for key, value in summary_found.items():
        if not value:
            details[key] = "missing or incomplete"
    total = round(min(RESPONSE_CONTENT_TOTAL, sum(scores.values())), 2)
    return {
        "total": total,
        "scores": scores,
        "details": details,
        "sleep_found": sleep_found,
        "exercise_found": exercise_found,
        "workout_found": workout_found,
        "summary_found": summary_found,
        "required_workout_inference_passed": workout_score >= WORKOUT_INFERENCE_TOTAL,
    }


def score_response(response, health):
    components = score_response_components(response, health)
    return components["total"], components["details"]


def has_required_agent_action(state_scores, response):
    return bool(state_scores.get("has_state_action") or response.strip())


def compute_reward(state_scores, response_score, response, required_response_passed=None):
    if not has_required_agent_action(state_scores, response):
        return 0.0, "zero-work baseline: no required action or substantive response observed"
    reward = round(min(1.0, state_scores["state_total"] + response_score), 2)
    blockers = []
    if not state_scores.get("required_blockers_passed"):
        blockers.append("required state blocker failed")
    if required_response_passed is False:
        blockers.append("required workout inference missing")
    elif response_score < 0.08:
        blockers.append("required response inference missing")
    detail = "; ".join(blockers) if blockers else "all required blockers passed"
    return reward, detail


def format_workout_inference_report(workout_found):
    yoga_score = 0.03 if workout_found.get("yoga_45") else 0.0
    hiit_score = 0.03 if workout_found.get("hiit_30") else 0.0
    excluded_score = 0.02 if workout_found.get("incomplete_exclusions") else 0.0
    total = round(yoga_score + hiit_score + excluded_score, 2)
    return "\n".join(
        [
            f"  (a) Yoga = 45 min (Low, DONE) -> 0.03 pts: {'PASS' if yoga_score else 'FAIL'}",
            f"  (b) HIIT = 30 min (High, DONE) -> 0.03 pts: {'PASS' if hiit_score else 'FAIL'}",
            f"  (c) Strength/Cycling/Swimming excluded (UNDONE) -> 0.02 pts: {'PASS' if excluded_score else 'FAIL'}",
            f"  Total: {total:.2f} pts. REQUIRED.",
        ]
    )


def load_final_response():
    messages = []
    for log_path in HARBOR_LOG_CANDIDATES:
        if not log_path.exists():
            continue
        with log_path.open() as handle:
            for line in handle:
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if entry.get("type") != "message":
                    continue
                message = entry.get("message", {})
                if message.get("role") != "assistant":
                    continue
                content = message.get("content")
                if isinstance(content, str) and content.strip():
                    messages.append(content.strip())
                elif isinstance(content, list):
                    parts = [block.get("text", "").strip() for block in content if isinstance(block, dict) and block.get("type") == "text" and block.get("text")]
                    if parts:
                        messages.append(" ".join(parts))
    if messages:
        return messages[-1]
    if FINAL_RESPONSE_FALLBACK.exists():
        return FINAL_RESPONSE_FALLBACK.read_text()
    return ""


def apply_oracle_state(conn, orders):
    conn.execute("UPDATE wearable_recovery_state SET sleep_hours = 6.5, sleep_score = 60, readiness = 68, resting_heart_rate = 72 WHERE id = 1")
    conn.execute("UPDATE calendar_event SET title = 'Recovery Yoga', workout_type = 'yoga' WHERE event_type = 'workout' AND workout_type IN ('hiit', 'strength', 'swimming') AND start_time BETWEEN ? AND ?", (FUTURE_START, FUTURE_END))
    conn.execute("UPDATE coffee_schedule SET start_time = '08:30', cancelled = 0 WHERE schedule_date = ?", (TOMORROW,))
    conn.execute("UPDATE grocery_product SET quantity = 1, unit = 'lb', stock_status = 'sufficient', reference = 'ORD000005' WHERE name = 'Salted Butter'")
    conn.execute("UPDATE grocery_product SET quantity = 30, unit = 'capsules', stock_status = 'sufficient', reference = 'ORD000001' WHERE name = 'CoQ10'")
    conn.execute("INSERT OR REPLACE INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES ('omega3', 'Omega-3', 60, 'softgels', 'sufficient', NULL, 'ORD000003')")
    conn.execute("INSERT OR REPLACE INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES ('magnesium', 'Magnesium', 60, 'tablets', 'sufficient', NULL, 'ORD000006')")
    conn.execute("INSERT OR REPLACE INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES ('valerian-root', 'Valerian Root', 60, 'capsules', 'sufficient', NULL, 'ORD000007')")
    conn.commit()
    existing = {order.get("order_id") for order in orders}
    for order_id, product_id, title, price in [
        ("ORD000006", "prod_magnesium_60", "Magnesium 60 Tablets", 12.99),
        ("ORD000007", "prod_valerian_60", "Valerian Root 60 Capsules", 14.25),
    ]:
        if order_id not in existing:
            orders.append({
                "order_id": order_id,
                "user_id": "Peter Griffin",
                "items": [{"id": product_id, "product_id": product_id, "title": title, "price": price, "quantity": 1, "image_url": f"https://example.com/{product_id}.jpg"}],
                "total_amount": price,
                "status": "Pending Shipment",
                "create_time": "2026-05-09 07:35:00",
                "shipping_address": "1234 Innovation Drive, San Francisco, CA 94105, USA",
            })


def build_oracle_response(magnesium_order_id, valerian_order_id):
    return f"""I found that the health dashboard sleep total was inconsistent: it displayed 8.0 hours, but light sleep 4.09 h plus deep sleep 1.11 h plus REM sleep 1.3 h equals 6.5 hours, so I corrected the smart-home wearable sleep hours to 6.5 and readiness to 68.

For the last 7 days, sleep quality averaged 77.1 with a 60 low and 82 high, sleep duration averaged 7.13 hours with the latest true sleep at 6.5, light sleep averaged 3.94 hours, deep sleep averaged 1.28 hours, and REM sleep averaged 1.91 hours.

The longer sleep windows were secondary context: 14-day sleep quality averaged 76.43, 14-day sleep duration averaged 7.12 hours, 14-day light sleep averaged 3.89 hours, 14-day deep sleep averaged 1.28 hours, and 14-day REM sleep averaged 1.95 hours. Over 30 days, sleep quality averaged 76.37, sleep duration averaged 7.22 hours, light sleep averaged 3.92 hours, deep sleep averaged 1.30 hours, and REM sleep averaged 2.00 hours.

The trend stats had displayed-versus-actual issues plus exercise context: Sleep Quality 7-day max showed 92% but the series peaks at 82%; Sleep Quality 30-day max showed 95% but peaks at 82%; Sleep Duration 14-day average showed 8.2 hrs but is 7.1 hrs; Sleep Duration 30-day max showed 9.5 hrs but peaks at 8.0 hrs; Low Intensity 7-day min showed 8 min but the trough is 12.9 min; Medium Intensity 7-day average was 6.64 min; High Intensity 7-day average showed 48 min but is 35 min; High Intensity 14-day average showed 22 min but is 35 min.

For yesterday's completed workouts, I counted Yoga as the completed 45-minute low-intensity activity and HIIT as the completed 30-minute high-intensity activity. I excluded Strength, Cycling, and Swimming because they were incomplete.

I changed all seven upcoming high-intensity workouts (HIIT, strength, and swim intervals) from 2026-05-10 through 2026-05-16 to recovery yoga. I left non-target meetings alone.

For coffee, I left today's 07:00 schedule unchanged and moved tomorrow's coffee to 08:30 because brewing takes about 30 minutes and the earliest tomorrow event is the 09:00 Team Standup.

For recovery supplies, I fixed Salted Butter to 1 lb with ORD000005, corrected CoQ10 to ORD000001, added Omega-3 60 softgels with ORD000003, ordered Magnesium 60 Tablets as {magnesium_order_id}, and ordered Valerian Root 60 Capsules as {valerian_order_id}."""


def write_reward_files(payload, details):
    REWARD_DIR.mkdir(parents=True, exist_ok=True)
    (REWARD_DIR / "reward.txt").write_text(f"{payload['reward']:.2f}\n")
    (REWARD_DIR / "reward.json").write_text(json.dumps(payload, indent=2) + "\n")
    (REWARD_DIR / "details.json").write_text(json.dumps(details, indent=2) + "\n")


def fail_with_reward(reason):
    payload = {"reward": 0.0, "state_total": 0.0, "response_content": 0.0, "required_blockers_passed": 0.0, "_meta_failure": reason}
    write_reward_files(payload, {"failure": reason})
    print(f"FAILED: {reason}")
    print("Score: 0.0/1.0")
    sys.exit(1)


def main():
    try:
        health_conn = sqlite3.connect(HEALTH_DB_PATH)
        try:
            health = read_health_signal(health_conn)
        finally:
            health_conn.close()
    except Exception as exc:
        fail_with_reward(f"invalid health source data: {exc}")

    try:
        orders = load_shop_orders(SHOP_ORDERS_PATH)
    except Exception as exc:
        fail_with_reward(f"invalid shop order data: {exc}")

    try:
        smarthome_conn = sqlite3.connect(SMARTHOME_DB_PATH)
        try:
            state_scores = score_state(smarthome_conn, orders)
        finally:
            smarthome_conn.close()
    except Exception as exc:
        fail_with_reward(f"invalid smarthome state: {exc}")

    response = load_final_response()
    response_components = score_response_components(response, health)
    response_score = response_components["total"]
    response_details = response_components["details"]
    required_response_passed = response_components["required_workout_inference_passed"]
    reward, gate_detail = compute_reward(
        state_scores,
        response_score,
        response,
        required_response_passed=required_response_passed,
    )
    passed = reward >= 0.5 and state_scores.get("required_blockers_passed") and required_response_passed

    payload = {
        "reward": round(float(reward), 2),
        "wearable_repair": round(float(state_scores["wearable_repair"]), 3),
        "future_workouts": round(float(state_scores["future_workouts"]), 3),
        "tomorrow_coffee": round(float(state_scores["tomorrow_coffee"]), 3),
        "today_coffee": round(float(state_scores["today_coffee"]), 3),
        "shopping_list": round(float(state_scores["shopping_list"]), 3),
        "new_orders": round(float(state_scores["new_orders"]), 3),
        "response_content": round(float(response_score), 3),
        "state_total": round(float(state_scores["state_total"]), 3),
        "required_blockers_passed": float(bool(state_scores.get("required_blockers_passed"))),
        "required_response_passed": float(bool(required_response_passed)),
        "_meta_gate": gate_detail,
    }
    details = {
        "state": {key: value for key, value in state_scores.items() if key.startswith("_meta_")},
        "response": response_details,
        "health": {
            key: value for key, value in health.items() if key != "overrides"
        },
    }
    write_reward_files(payload, details)

    print(f"D1 (Wearable sleep-hours repair): {state_scores['wearable_repair']:.2f}/0.08")
    print(f"D2a (7-day sleep analysis): {response_components['scores']['sleep_7day_analysis']:.2f}/0.15")
    print(f"D2b (14/30-day sleep context): {response_components['scores']['sleep_14_30_analysis']:.3f}/0.03")
    print(f"D2c (Exercise trend response): {response_components['scores']['exercise_trend_analysis']:.2f}/0.04")
    print(f"D3 (Yesterday workout inference): {response_components['scores']['workout_inference']:.2f}/0.08")
    print(format_workout_inference_report(response_components["workout_found"]))
    print(f"D4 (Seven future workout downgrades): {state_scores['future_workouts']:.2f}/0.10")
    print(f"D5 (Tomorrow coffee): {state_scores['tomorrow_coffee']:.2f}/0.08")
    print(f"D6 (Today coffee preserved): {state_scores['today_coffee']:.2f}/0.04")
    print(f"D7 (Shopping-list reconciliation): {state_scores['shopping_list']:.2f}/0.25")
    print(f"D8 (New supplement orders): {state_scores['new_orders']:.3f}/0.07")
    print(f"D9 (Final response): {response_score:.2f}/0.42")
    print(f"Score: {reward:.2f}/1.0")
    if not passed:
        print(f"FAILED: {gate_detail}")
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
