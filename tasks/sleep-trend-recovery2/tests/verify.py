#!/usr/bin/env python3
import json
import re
import sqlite3
import sys
from pathlib import Path

HEALTH_DB_PATH = Path("/workspace/health.db")
SMARTHOME_DB_PATH = Path("/tmp/mosi_smart_home.sqlite")
REWARD_DIR = Path("/logs/verifier")
TODAY = "2026-05-09"
TOMORROW = "2026-05-10"
RECENT_START = "2026-05-03"
RECENT_END = "2026-05-08"
DROP_THRESHOLD = 15.0
LOW_INTENSITY_WORKOUTS = {"yoga", "walking", "cycling", "rest"}
TRACKED_TREND_WINDOWS = (7, 14, 30)
HIIT_ACTION_SCORE = 0.25
TODAY_COFFEE_SCORE = 0.10
TOMORROW_COFFEE_SCORE = 0.20
PROTECTED_CALENDAR_PENALTY = 0.15
PROTECTED_COFFEE_PENALTY = 0.15


def find_harbor_log_path():
    for path in [
        Path("/workspace/.openclaw/agents/main/sessions/harbor.jsonl"),
        Path("/root/.openclaw/agents/main/sessions/harbor.jsonl"),
        Path("/logs/agent/openclaw-state/agents/main/sessions/harbor.jsonl"),
    ]:
        if path.exists():
            return path
    return None


def get_agent_response():
    log_path = find_harbor_log_path()
    messages = []
    if log_path is not None:
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
                    parts = [
                        block.get("text", "").strip()
                        for block in content
                        if isinstance(block, dict)
                        and block.get("type") == "text"
                        and block.get("text")
                    ]
                    if parts:
                        messages.append(" ".join(parts))
    if messages:
        return " ".join(messages)

    fallback = Path("/workspace/output/response.txt")
    if fallback.exists():
        return fallback.read_text()
    return ""


def time_to_minutes(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{2}:\d{2}", value):
        return None
    hour, minute = value.split(":")
    hour_int = int(hour)
    minute_int = int(minute)
    if hour_int > 23 or minute_int > 59:
        return None
    return hour_int * 60 + minute_int


def compute_trend(values):
    if not values:
        return "stable"
    mid = len(values) // 2
    if mid == 0:
        return "stable"
    first_half = sum(values[:mid]) / mid
    second_half = sum(values[mid:]) / (len(values) - mid)
    if first_half == 0:
        return "stable"
    change = ((second_half - first_half) / first_half) * 100
    if change > 5:
        return "rising"
    if change < -5:
        return "falling"
    return "stable"


def read_metric_window(conn, metric_type, days):
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
    return [float(value) for (value,) in rows]


def read_health_signal(conn):
    rows = conn.execute(
        """
        SELECT date, sleep_quality
        FROM health_daily_snapshot
        WHERE user_id = 1 AND date BETWEEN ? AND ?
        ORDER BY date
        """,
        (RECENT_START, TODAY),
    ).fetchall()
    values = {date: float(value) for date, value in rows}
    prior_values = [
        values[date] for date in sorted(values) if RECENT_START <= date <= RECENT_END
    ]
    today_value = values.get(TODAY)
    if len(prior_values) != 6 or today_value is None:
        raise ValueError("missing required Sleep Quality rows")
    prior_average = round(sum(prior_values) / len(prior_values), 1)
    drop = round(prior_average - today_value, 1)

    companion = {}
    for metric in [
        "sleep_hours",
        "light_sleep_hours",
        "deep_sleep_hours",
        "rem_sleep_hours",
    ]:
        metric_rows = conn.execute(
            """
            SELECT date, value
            FROM health_metric_series
            WHERE user_id = 1 AND metric_type = ? AND date BETWEEN ? AND ?
            ORDER BY date
            """,
            (metric, RECENT_START, TODAY),
        ).fetchall()
        if len(metric_rows) != 7:
            raise ValueError(f"missing required {metric} rows")
        companion[metric] = {date: float(value) for date, value in metric_rows}

    trend_windows = {
        days: compute_trend(read_metric_window(conn, "sleep_quality", days))
        for days in TRACKED_TREND_WINDOWS
    }

    return {
        "today": today_value,
        "prior_average": prior_average,
        "drop": drop,
        "action_branch": drop >= DROP_THRESHOLD,
        "companion": companion,
        "trend_windows": trend_windows,
    }


def score_high_intensity_actions(conn):
    rows = conn.execute(
        """
        SELECT id, title, workout_type
        FROM calendar_event
        WHERE event_type = 'workout'
          AND start_time >= '2026-05-10T00:00:00Z'
          AND start_time < '2026-05-11T00:00:00Z'
        ORDER BY id
        """
    ).fetchall()
    if not rows:
        return 0.0, "no tomorrow workouts remain to review"

    remaining_high_intensity = []
    for event_id, title, workout_type in rows:
        workout_type = (workout_type or "").lower()
        if workout_type not in LOW_INTENSITY_WORKOUTS:
            remaining_high_intensity.append(f"{event_id}:{title}:{workout_type}")

    if remaining_high_intensity:
        return 0.0, "unprocessed high-intensity workouts remain: " + ", ".join(
            remaining_high_intensity
        )

    return HIIT_ACTION_SCORE, "all high-intensity workouts handled"


def score_today_coffee(conn):
    row = conn.execute(
        "SELECT start_time, cancelled FROM coffee_schedule WHERE schedule_date = ?",
        (TODAY,),
    ).fetchone()
    if row is None:
        return 0.0, "today coffee row missing"
    start_time, cancelled = row
    if start_time == "07:00" and int(cancelled) == 0:
        return TODAY_COFFEE_SCORE, "today coffee unchanged at 07:00"
    return 0.0, f"today coffee changed: start_time={start_time}, cancelled={cancelled}"


def score_tomorrow_coffee(conn):
    row = conn.execute(
        "SELECT start_time, cancelled FROM coffee_schedule WHERE schedule_date = ?",
        (TOMORROW,),
    ).fetchone()
    if row is None:
        return 0.0, "tomorrow coffee row missing"
    start_time, cancelled = row
    if int(cancelled) != 0:
        return 0.0, "tomorrow coffee cancelled"
    minutes = time_to_minutes(start_time)
    if minutes is None:
        return 0.0, f"invalid tomorrow coffee time={start_time}"
    if start_time == "08:30":
        return TOMORROW_COFFEE_SCORE, "tomorrow coffee delayed to optimal 08:30"
    if time_to_minutes("08:00") <= minutes <= time_to_minutes("08:29"):
        return 0.15, f"tomorrow coffee delayed to {start_time}"
    if time_to_minutes("07:30") <= minutes <= time_to_minutes("07:59"):
        return 0.10, f"tomorrow coffee delayed to {start_time}"
    if time_to_minutes("07:01") <= minutes <= time_to_minutes("07:29"):
        return 0.05, f"tomorrow coffee slightly delayed to {start_time}"
    return 0.0, f"tomorrow coffee not acceptably delayed: {start_time}"


def check_protected_calendar_state(conn):
    expected_calendar = [
        (1, "Online Daily Sync", "2026-05-09T09:00:00Z", "work", None),
        (2, "Today Recovery Walk", "2026-05-09T18:30:00Z", "workout", "walking"),
        (4, "Team Meeting", "2026-05-10T14:00:00Z", "meeting", None),
        (5, "Online Daily Sync", "2026-05-10T09:00:00Z", "work", None),
    ]
    actual_calendar = conn.execute(
        """
        SELECT id, title, start_time, event_type, workout_type
        FROM calendar_event
        WHERE NOT (
            event_type = 'workout'
            AND start_time >= '2026-05-10T00:00:00Z'
            AND start_time < '2026-05-11T00:00:00Z'
        )
        ORDER BY id
        """
    ).fetchall()
    if actual_calendar != expected_calendar:
        changed_event_id = None
        for actual, expected in zip(actual_calendar, expected_calendar):
            if actual != expected:
                changed_event_id = expected[0]
                break
        if changed_event_id is not None:
            return False, f"protected event {changed_event_id} changed: {actual}"
        return False, f"protected calendar rows changed: {actual_calendar}"
    return True, "protected calendar events unchanged"


def check_protected_coffee_state(conn):
    expected_coffee = [
        ("2026-05-03", "07:00", 0),
        ("2026-05-04", "07:00", 0),
        ("2026-05-05", "07:00", 0),
        ("2026-05-06", "07:00", 0),
        ("2026-05-07", "07:00", 0),
        ("2026-05-08", "07:00", 0),
        ("2026-05-09", "07:00", 0),
    ]
    actual_coffee = conn.execute(
        """
        SELECT schedule_date, start_time, cancelled
        FROM coffee_schedule
        WHERE schedule_date != ?
        ORDER BY schedule_date
        """,
        (TOMORROW,),
    ).fetchall()
    if actual_coffee != expected_coffee:
        return False, f"protected coffee schedule changed: {actual_coffee}"
    return True, "protected coffee schedule unchanged"


def check_protected_smarthome_state(conn):
    calendar_pass, calendar_detail = check_protected_calendar_state(conn)
    if not calendar_pass:
        return False, calendar_detail

    coffee_pass, coffee_detail = check_protected_coffee_state(conn)
    if not coffee_pass:
        return False, coffee_detail

    return True, "protected events unchanged"


def score_state(conn):
    hiit_score, hiit_detail = score_high_intensity_actions(conn)
    today_score, today_detail = score_today_coffee(conn)
    tomorrow_score, tomorrow_detail = score_tomorrow_coffee(conn)
    protected_calendar_pass, protected_calendar_detail = check_protected_calendar_state(
        conn
    )
    protected_coffee_pass, protected_coffee_detail = check_protected_coffee_state(conn)
    protected_pass = protected_calendar_pass and protected_coffee_pass
    protected_detail = (
        "protected events unchanged"
        if protected_pass
        else "; ".join(
            detail
            for passed, detail in [
                (protected_calendar_pass, protected_calendar_detail),
                (protected_coffee_pass, protected_coffee_detail),
            ]
            if not passed
        )
    )
    protected_penalty = round(
        (0.0 if protected_calendar_pass else PROTECTED_CALENDAR_PENALTY)
        + (0.0 if protected_coffee_pass else PROTECTED_COFFEE_PENALTY),
        2,
    )
    required_gates_passed = (
        hiit_score == HIIT_ACTION_SCORE
        and today_score == TODAY_COFFEE_SCORE
        and tomorrow_score > 0.0
        and protected_pass
    )
    raw_positive_score = round(hiit_score + today_score + tomorrow_score, 2)
    return {
        "hiit_action": hiit_score,
        "today_coffee": today_score,
        "tomorrow_coffee": tomorrow_score,
        "protected_state": 1.0 if protected_pass else 0.0,
        "protected_calendar_state": 1.0 if protected_calendar_pass else 0.0,
        "protected_coffee_state": 1.0 if protected_coffee_pass else 0.0,
        "protected_penalty": protected_penalty,
        "raw_positive_score": raw_positive_score,
        "required_gates_passed": required_gates_passed,
        "_meta_hiit_action": hiit_detail,
        "_meta_today_coffee": today_detail,
        "_meta_tomorrow_coffee": tomorrow_detail,
        "_meta_protected_state": protected_detail,
        "_meta_protected_calendar_state": protected_calendar_detail,
        "_meta_protected_coffee_state": protected_coffee_detail,
    }


def _mentions_number(text, candidates):
    for candidate in candidates:
        escaped = re.escape(str(candidate)).replace("\\.", r"[.]?")
        if re.search(rf"\b{escaped}\b", text):
            return True
    return False


def score_response_sleep_comparison(text, health):
    checks = [
        _mentions_number(text, [int(health["today"]), f"{health['today']:.0f}"])
        and re.search(r"sleep\s*quality|sleep\s*score", text),
        _mentions_number(
            text, [health["prior_average"], int(health["prior_average"]), 80]
        ),
        _mentions_number(text, [health["drop"], int(health["drop"]), 29]),
    ]
    passed = sum(bool(item) for item in checks)
    if passed == 3:
        return 0.10
    if passed >= 2:
        return 0.05
    return 0.0


def score_response_trend_limitation(text):
    falling_7d = re.search(r"7[- ]day", text) and re.search(
        r"falling|declining|downward|drop", text
    )
    stable_14d = re.search(r"14[- ]day", text) and re.search(r"stable", text)
    stable_30d = re.search(r"30[- ]day", text) and re.search(r"stable", text)
    explanation = re.search(
        r"long(?:er)?\s+window|time\s+span|smooth|dilut|cannot\s+fully|can't\s+fully|not\s+fully|single\s+bad\s+night|one\s+bad\s+night",
        text,
    ) and re.search(r"yesterday|last\s+night|poor\s+sleep|recovery|bad\s+night", text)
    if falling_7d and stable_14d and stable_30d and explanation:
        return 0.08
    if falling_7d or stable_14d or stable_30d:
        return 0.04
    return 0.0


def score_response_companion_sleep_metrics(text):
    sleep_duration = re.search(r"sleep\s*(duration|hours?)", text)
    light_sleep = re.search(r"light\s*sleep", text)
    deep_sleep = re.search(r"deep\s*sleep", text)
    rem_sleep = re.search(r"rem\s*sleep", text)
    analysis = re.search(
        r"lower|fell|reduced|dominated|poor|not\s+restorative|point", text
    )
    count = sum(
        bool(item) for item in [sleep_duration, light_sleep, deep_sleep, rem_sleep]
    )
    if count == 4 and analysis:
        return 0.08
    if count >= 1:
        return 0.04
    return 0.0


def score_response_hiit_reasoning(text):
    action = re.search(
        r"hiit|sprint|boxing|high[- ]intensity|workout", text
    ) and re.search(
        r"delete|remove|changed|downgrad|replace|yoga|walking|cycling|rest", text
    )
    coverage = re.search(
        r"all\s+high[- ]intensity|every\s+high[- ]intensity|sprint|boxing",
        text,
    )
    reason = re.search(r"recovery|sleep\s+drop|poor\s+sleep|avoid", text)
    if action and coverage and reason:
        return 0.07
    if action and reason:
        return 0.035
    return 0.0


def score_response_coffee_reasoning(text):
    new_time = re.search(r"08:30|8:30", text)
    old_time = re.search(r"07:00|7:00", text)
    event = re.search(r"09:00|9:00|daily\s+sync|earliest", text)
    brew = re.search(r"30[- ]?minute|brew|finish", text)
    if new_time and old_time and event and brew:
        return 0.07
    if new_time:
        return 0.035
    return 0.0


def score_response_unsynced_recovery(text):
    zeroed = (
        re.search(r"wearable|recovery(?:\s+data)?|smart[- ]home", text)
        and re.search(r"date|today", text)
        and re.search(
            r"all\s+(?:the\s+)?values?\s+(?:are\s+)?0|all\s+0|0\s+values|zeros?",
            text,
        )
    )
    unsynced = re.search(
        r"not\s+sync|unsync|has\s+not\s+been\s+sync|health\s+data|should\s+not\s+be\s+trusted|cannot\s+be\s+trusted|before\s+relying",
        text,
    )
    if zeroed and unsynced:
        return 0.05
    if zeroed:
        return 0.02
    return 0.0


def score_response(response, health):
    text = response.lower()
    scores = {
        "sleep_comparison": score_response_sleep_comparison(text, health),
        "trend_limitation": score_response_trend_limitation(text),
        "companion_sleep_metrics": score_response_companion_sleep_metrics(text),
        "hiit_reasoning": score_response_hiit_reasoning(text),
        "coffee_reasoning": score_response_coffee_reasoning(text),
        "unsynced_recovery": score_response_unsynced_recovery(text),
    }
    details = {
        key: "missing or incomplete" for key, value in scores.items() if value == 0.0
    }
    return round(sum(scores.values()), 2), details


def canonical_reward(state_scores, response_score, seeded_action_branch):
    raw_weighted_total = round(
        state_scores.get(
            "raw_positive_score",
            state_scores["hiit_action"]
            + state_scores["today_coffee"]
            + state_scores["tomorrow_coffee"],
        )
        + response_score,
        2,
    )
    protected_penalty = float(state_scores.get("protected_penalty", 0.0))
    reward = round(max(0.0, raw_weighted_total - protected_penalty), 2)
    if protected_penalty:
        return reward, f"protected penalty applied: {protected_penalty:.2f}"
    return reward, "no protected penalty"


def build_reward_payload(
    reward, state_scores, response_score, raw_weighted_total, meta
):
    payload = {
        "reward": round(float(reward), 2),
        "hiit_action": round(float(state_scores.get("hiit_action", 0.0)), 2),
        "today_coffee": round(float(state_scores.get("today_coffee", 0.0)), 2),
        "tomorrow_coffee": round(float(state_scores.get("tomorrow_coffee", 0.0)), 2),
        "protected_state": round(float(state_scores.get("protected_state", 0.0)), 2),
        "protected_penalty": round(
            float(state_scores.get("protected_penalty", 0.0)), 2
        ),
        "response_content": round(float(response_score), 2),
        "raw_weighted_total": round(float(raw_weighted_total), 2),
        "required_gates_passed": float(
            bool(state_scores.get("required_gates_passed", False))
        ),
    }
    for key, value in meta.items():
        payload[f"_meta_{key}"] = value
    return payload


def write_reward_files(payload, details):
    REWARD_DIR.mkdir(parents=True, exist_ok=True)
    (REWARD_DIR / "reward.txt").write_text(f"{payload['reward']:.2f}\n")
    (REWARD_DIR / "reward.json").write_text(json.dumps(payload, indent=2) + "\n")
    (REWARD_DIR / "details.json").write_text(json.dumps(details, indent=2) + "\n")


def fail_with_reward(reason):
    payload = build_reward_payload(
        reward=0.0,
        state_scores={},
        response_score=0.0,
        raw_weighted_total=0.0,
        meta={"failure": reason},
    )
    write_reward_files(payload, {"failure": reason})
    print(f"FAILED: {reason}")
    print("Score: 0.0/1.0")
    sys.exit(1)


def main():
    try:
        health_conn = sqlite3.connect(HEALTH_DB_PATH)
    except sqlite3.Error as exc:
        fail_with_reward(f"cannot connect to health database: {exc}")
    try:
        try:
            health = read_health_signal(health_conn)
        finally:
            health_conn.close()
    except Exception as exc:
        fail_with_reward(f"invalid health source data: {exc}")

    try:
        smarthome_conn = sqlite3.connect(SMARTHOME_DB_PATH)
    except sqlite3.Error as exc:
        fail_with_reward(f"cannot connect to smarthome database: {exc}")
    try:
        state_scores = score_state(smarthome_conn)
    except Exception as exc:
        smarthome_conn.close()
        fail_with_reward(f"invalid smarthome state: {exc}")
    finally:
        smarthome_conn.close()

    response = get_agent_response()
    response_score, response_details = score_response(response, health)
    raw_weighted_total = round(
        state_scores["raw_positive_score"] + response_score,
        2,
    )
    reward, gate_detail = canonical_reward(
        state_scores, response_score, seeded_action_branch=health["action_branch"]
    )
    details = {
        "state": {
            key: value
            for key, value in state_scores.items()
            if key.startswith("_meta_")
        },
        "response": response_details,
        "gate": gate_detail,
        "health": {
            "today_sleep_quality": health["today"],
            "prior_average": health["prior_average"],
            "drop": health["drop"],
            "trend_windows": health["trend_windows"],
        },
    }
    payload = build_reward_payload(
        reward=reward,
        state_scores=state_scores,
        response_score=response_score,
        raw_weighted_total=raw_weighted_total,
        meta={
            "gate": gate_detail,
            "action_branch": "1" if health["action_branch"] else "0",
        },
    )
    write_reward_files(payload, details)

    print(
        f"D1 (Tomorrow workout recovery actions): {state_scores['hiit_action']:.2f}/0.25"
    )
    print(f"D2 (Today coffee unchanged): {state_scores['today_coffee']:.2f}/0.10")
    print(f"D3 (Tomorrow coffee delay): {state_scores['tomorrow_coffee']:.2f}/0.20")
    print(
        f"D4 (Protected state penalty): -{state_scores['protected_penalty']:.2f}/0.30"
    )
    print(f"D5 (Final response): {response_score:.2f}/0.45")
    print(f"Score: {reward:.2f}/1.0")

    passed = reward >= 0.5
    if not passed:
        print("FAILED: minimum reward did not pass")
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
