#!/usr/bin/env python3
import json
import re
import sqlite3
import sys
from pathlib import Path

BENCHMARK_DATE = "2026-05-09"
SEEDED_COFFEE_START = "07:00"
MIN_DELAYED_COFFEE_START = "07:20"
BENCHMARK_WORKOUT_START = "2026-05-09T09:00:00Z"
RECOVERY_WORKOUTS = {"walking", "yoga", "swimming"}


def without_spaces(text):
    return re.sub(r"\s+", "", text.lower())


def find_harbor_log_path():
    for path in [
        Path("/workspace/.openclaw/agents/main/sessions/harbor.jsonl"),
        Path("/root/.openclaw/agents/main/sessions/harbor.jsonl"),
        Path("/logs/agent/openclaw-state/agents/main/sessions/harbor.jsonl"),
    ]:
        if path.exists():
            return path
    return None


def _collect_strings(value, output, depth=0):
    if depth > 15:
        return
    if isinstance(value, str):
        output.append(value)
    elif isinstance(value, dict):
        for item in value.values():
            _collect_strings(item, output, depth + 1)
    elif isinstance(value, list):
        for item in value:
            _collect_strings(item, output, depth + 1)


def detect_direct_api_calls():
    log_path = find_harbor_log_path()
    if log_path is None:
        return False, "No harbor.jsonl found"

    patterns = [
        r"(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+http://localhost:(?:5004|5007)/api/",
        r"curl\s+.*http://localhost:(?:5004|5007)/api/",
        r"http\s+(?:GET|POST|PUT|DELETE|PATCH)\s+localhost:(?:5004|5007)/api/",
        r"wget\s+.*http://localhost:(?:5004|5007)/api/",
        r"requests\.(?:get|post|put|delete|patch)\s*\(\s*[\"']http://localhost:(?:5004|5007)/api/",
        r"[\"']http://localhost:(?:5004|5007)/api/",
        r"[\"']/?api/(?:thermostat|coffee-schedule|calendar|health)",
        r"fetch\s*\(\s*[\\]*[\"']/?api/",
        r"sqlite3\s+/(?:tmp|var/lib/mock-data|workspace)/(?:[^\s]+)",
        r"\bpython(?:3)?\b.*(?:write_text|open\().*(?:mosi_smart_home\.sqlite|health\.db)",
        r"\b(?:cp|mv|tee|jq)\b.*(?:mosi_smart_home\.sqlite|health\.db)",
    ]

    violations = []
    with open(log_path) as handle:
        for line_num, line in enumerate(handle, 1):
            texts = [line]
            try:
                entry = json.loads(line)
                _collect_strings(entry, texts)
            except json.JSONDecodeError:
                pass
            for text in texts:
                if any(re.search(pattern, text) for pattern in patterns):
                    violations.append(
                        f"Line {line_num}: direct API or state access detected"
                    )
                    break
    if violations:
        return True, "; ".join(violations[:5])
    return False, "No direct API calls detected"


def get_all_assistant_messages():
    log_path = find_harbor_log_path()
    if log_path is None:
        return None

    all_contents = []
    with open(log_path) as handle:
        for line in handle:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if (
                entry.get("type") != "message"
                or entry.get("message", {}).get("role") != "assistant"
            ):
                continue
            content = entry.get("message", {}).get("content")
            if isinstance(content, str):
                all_contents.append(content)
            elif isinstance(content, list):
                parts = [
                    block.get("text", "")
                    for block in content
                    if isinstance(block, dict)
                    and block.get("type") == "text"
                    and block.get("text")
                ]
                if parts:
                    all_contents.append(" ".join(parts))
    return " ".join(all_contents) if all_contents else None


def get_agent_response():
    response = get_all_assistant_messages()
    if response is None and find_harbor_log_path() is None:
        response_path = Path("/workspace/output/response.txt")
        if response_path.exists():
            response = response_path.read_text()
    return response


def time_to_minutes(value):
    hour, minute = value.split(":")[:2]
    return int(hour) * 60 + int(minute)


def derive_coffee_status(schedule_date, start_time, current_time):
    current_date = current_time.split("T")[0]
    if current_date < schedule_date:
        return "scheduled"
    if current_date > schedule_date:
        return "ready"

    match = re.search(r"T(\d{2}):(\d{2}):", current_time)
    if not match:
        return "scheduled"
    current_minutes = int(match.group(1)) * 60 + int(match.group(2))
    start_minutes = time_to_minutes(start_time)
    if current_minutes < start_minutes - 30:
        return "scheduled"
    if current_minutes < start_minutes:
        return "preparing"
    if current_minutes < start_minutes + 30:
        return "brewing"
    return "ready"


def check_health_source_data(db_path="/workspace/health.db"):
    try:
        conn = sqlite3.connect(db_path)
    except sqlite3.Error as exc:
        return False, f"Cannot connect to health database: {exc}"

    try:
        current_date = conn.execute(
            "SELECT value FROM system_config WHERE key = 'current_date'"
        ).fetchone()
        current_time = conn.execute(
            "SELECT value FROM system_config WHERE key = 'current_time'"
        ).fetchone()
        if current_date is None or current_date[0] != BENCHMARK_DATE:
            return (
                False,
                f"current_date={None if current_date is None else current_date[0]}",
            )
        if current_time is None or current_time[0] != "07:45":
            return (
                False,
                f"current_time={None if current_time is None else current_time[0]}",
            )

        snapshot = conn.execute(
            """
            SELECT sleep_hours, sleep_quality, light_sleep_hours, deep_sleep_hours,
                   rem_sleep_hours, resting_heart_rate_bpm
            FROM health_daily_snapshot
            WHERE user_id = 1 AND date = ?
            """,
            (BENCHMARK_DATE,),
        ).fetchone()
        if snapshot != (6.5, 62.0, 4.09, 1.11, 1.3, 110):
            return False, f"benchmark-day health snapshot={snapshot}"

        for metric_type, expected in {
            "sleep_hours": 6.5,
            "sleep_quality": 62.0,
            "light_sleep_hours": 4.09,
            "deep_sleep_hours": 1.11,
            "rem_sleep_hours": 1.3,
            "resting_heart_rate_bpm": 110.0,
        }.items():
            row = conn.execute(
                "SELECT value FROM health_metric_series WHERE user_id = 1 AND metric_type = ? AND date = ?",
                (metric_type, BENCHMARK_DATE),
            ).fetchone()
            if row is None or abs(float(row[0]) - expected) > 0.01:
                return False, f"{metric_type} series={None if row is None else row[0]}"
    finally:
        conn.close()
    return True, "Health source data matches task contract"


def check_thermostat(conn):
    row = conn.execute(
        "SELECT mode, temperature FROM thermostat_settings WHERE id = 1"
    ).fetchone()
    if row is None:
        return False, "No thermostat_settings row found"
    mode, temperature = row
    if mode != "comfort" or abs(float(temperature) - 76.0) > 0.25:
        return False, f"mode={mode}, temperature={temperature}"
    return True, f"mode={mode}, temperature={temperature}"


def check_workout(conn):
    rows = conn.execute(
        """
        SELECT title, workout_type
        FROM calendar_event
        WHERE event_type = 'workout'
          AND start_time = ?
        """
        ,
        (BENCHMARK_WORKOUT_START,),
    ).fetchall()
    if len(rows) != 1:
        return (
            False,
            f"Expected exactly one benchmark workout at {BENCHMARK_WORKOUT_START}, found {len(rows)}",
        )
    title, workout_type = rows[0]
    workout_type = (workout_type or "").lower()
    if workout_type not in RECOVERY_WORKOUTS:
        return False, f"workout_type={workout_type}"
    return True, f"title={title}, workout_type={workout_type}"


def check_coffee(conn):
    columns = [row[1] for row in conn.execute("PRAGMA table_info(coffee_schedule)")]
    if "status" in columns:
        return False, "coffee_schedule must not persist status"

    clock_row = conn.execute(
        "SELECT clock_time FROM benchmark_clock WHERE id = 1"
    ).fetchone()
    if clock_row is None:
        return False, "No benchmark_clock row found"
    initial_status = derive_coffee_status(
        BENCHMARK_DATE, SEEDED_COFFEE_START, clock_row[0]
    )
    if initial_status != "ready":
        return False, f"initial derived coffee status={initial_status}"

    row = conn.execute(
        "SELECT start_time, cancelled FROM coffee_schedule WHERE schedule_date = ?",
        (BENCHMARK_DATE,),
    ).fetchone()
    if row is None:
        return False, "No benchmark-day coffee schedule found"
    start_time, cancelled = row
    if int(cancelled) != 0:
        return False, "benchmark-day coffee schedule is cancelled"
    if time_to_minutes(start_time) < time_to_minutes(MIN_DELAYED_COFFEE_START):
        return False, f"start_time={start_time}"
    return True, f"start_time={start_time}, initial_status={initial_status}"


def _has_number_with_unit(text, number, units):
    unit_pattern = "|".join(re.escape(unit) for unit in units)
    escaped = re.escape(number).replace("\\.", r"[.]?")
    return bool(re.search(rf"\b{escaped}\s*(?:{unit_pattern})?\b", text))


def score_response(response):
    text = response.lower()
    compact = without_spaces(response)
    details = {}
    flags = {}
    score = 0.0

    metric_checks = {
        "sleep_duration": re.search(r"sleep\s*(duration|hours?)", text)
        and _has_number_with_unit(text, "6.5", ["hrs", "hours", "h"]),
        "sleep_quality": re.search(r"sleep\s*(quality|score)", text)
        and ("62%" in compact or re.search(r"\b62\s*percent\b", text)),
        "light_sleep": "lightsleep" in compact
        and _has_number_with_unit(text, "4.09", ["hrs", "hours", "h"]),
        "deep_sleep": "deepsleep" in compact
        and _has_number_with_unit(text, "1.11", ["hrs", "hours", "h"]),
        "rem_sleep": "remsleep" in compact
        and _has_number_with_unit(text, "1.3", ["hrs", "hours", "h"]),
    }
    metric_score = sum(0.02 for passed in metric_checks.values() if passed)
    score += metric_score
    flags["sleep_metrics"] = all(metric_checks.values())
    if not flags["sleep_metrics"]:
        details["sleep_metrics"] = [
            name for name, passed in metric_checks.items() if not passed
        ]

    recovery_rationale = re.search(
        r"(?:because|since|due to)\s+(?:[^.?!]*(?:sleep\s*quality\s*(?:is|was)?\s*(?:low|below)|below\s*70|not\s+restorative|insufficient|fragmented|stage\s+balance|deep\s*sleep|rem\s*sleep|resting\s*(?:hr|heart rate)\s*(?:is|was)?\s*(?:high|elevated|above)))",
        text,
    )
    flags["recovery_rationale"] = bool(recovery_rationale)
    if flags["recovery_rationale"]:
        score += 0.05
    else:
        details["recovery_rationale"] = (
            "Missing explanation of why the current-day values indicate poor recovery"
        )

    hr_value = re.search(r"110\s*(?:bpm|beats|heart)", text)
    hr_abnormal = (
        re.search(r"resting\s*(?:hr|heart rate)", text)
        and hr_value
        and re.search(
            r"abnormal|anomalous|high|elevated|tachycardia|above\s*100|concerning|notably",
            text,
        )
    )
    if hr_abnormal:
        score += 0.05
    elif hr_value:
        score += 0.025
    flags["hr_abnormal"] = bool(hr_abnormal)
    if not flags["hr_abnormal"]:
        details["hr_abnormal"] = "Resting HR 110 bpm not flagged as elevated/abnormal"

    action_checks = {
        "thermostat": "thermostat" in text
        and re.search(r"comfort", text)
        and re.search(r"76\s*(?:°?f|degrees?)", text),
        "workout": re.search(r"hiit|high-intensity|workout", text)
        and re.search(r"walking|yoga|swimming|gentler|easier", text),
        "coffee_delay": "coffee" in text
        and re.search(r"delay|delayed|07:2[0-9]|07:3[0-9]|7:2[0-9]|7:3[0-9]", text),
    }
    action_points = 0.10 / len(action_checks)
    score += sum(action_points for passed in action_checks.values() if passed)
    flags["actions_confirmed"] = all(action_checks.values())
    if not flags["actions_confirmed"]:
        details["actions_confirmed"] = [
            name for name, passed in action_checks.items() if not passed
        ]

    ready_language = re.search(r"ready|already\s*(?:brewed|made|done|complete)", text)
    impact_language = re.search(
        r"cannot|can't|won't|will not|does not|doesn't", text
    ) and re.search(r"affect|change|retroactive|undo", text)
    today_brewed = re.search(r"today|already\s*brewed|brewed\s*today", text)
    flags["coffee_ready_discovery"] = bool(
        ready_language and impact_language and today_brewed
    )
    if flags["coffee_ready_discovery"]:
        score += 0.05
    else:
        details["coffee_ready_discovery"] = (
            "Missing READY/already-brewed impact explanation"
        )

    tomorrow_question = (
        re.search(r"tomorrow", text)
        and re.search(r"would you like|do you want|should i|want me|ask|change", text)
        and re.search(r"coffee|schedule|time", text)
    )
    flags["coffee_tomorrow_followup"] = bool(tomorrow_question)
    if flags["coffee_tomorrow_followup"]:
        score += 0.05
    else:
        details["coffee_tomorrow_followup"] = (
            "Missing tomorrow coffee follow-up question"
        )

    return round(score, 2), flags, details


def write_reward_files(score, results, details, blocked_reason=None):
    reward_dir = Path("/logs/verifier")
    reward_dir.mkdir(parents=True, exist_ok=True)
    (reward_dir / "reward.txt").write_text(f"{score:.2f}\n")
    payload = {
        "reward": round(score, 2),
        "D1": float(results.get("thermostat", False)),
        "D2": float(results.get("workout", False)),
        "D3": float(results.get("coffee", False)),
        "D4": round(float(results.get("response_score", 0.0)), 2),
        "_meta_required_state_passed": float(
            results.get("required_state_passed", False)
        ),
        "_meta_required_response_passed": float(
            results.get("required_response_passed", False)
        ),
        "_meta_sleep_metrics": float(results.get("sleep_metrics", False)),
        "_meta_recovery_rationale": float(results.get("recovery_rationale", False)),
        "_meta_hr_abnormal": float(results.get("hr_abnormal", False)),
        "_meta_actions_confirmed": float(results.get("actions_confirmed", False)),
        "_meta_coffee_ready_discovery": float(
            results.get("coffee_ready_discovery", False)
        ),
        "_meta_coffee_tomorrow_followup": float(
            results.get("coffee_tomorrow_followup", False)
        ),
    }
    if blocked_reason is not None:
        payload["_meta_blocked"] = 1
    (reward_dir / "reward.json").write_text(json.dumps(payload, indent=2) + "\n")
    details_path = reward_dir / "details.json"
    details_path.write_text(json.dumps(details, indent=2) + "\n")


def main():
    results = {}
    details = {}

    violation, violation_details = detect_direct_api_calls()
    if violation:
        print(
            "UI-ONLY CONSTRAINT VIOLATION: direct backend API or state access detected"
        )
        print(f"    -> {violation_details}")
        print("Score: 0.0/1.0")
        write_reward_files(
            0.0, results, {"constraint": violation_details}, "ui_only_constraint"
        )
        sys.exit(1)

    health_pass, health_details = check_health_source_data()
    if not health_pass:
        print("FAILED: Health source data does not match task contract")
        print(f"    -> {health_details}")
        print("Score: 0.0/1.0")
        write_reward_files(
            0.0, results, {"health_source": health_details}, "health_source"
        )
        sys.exit(1)

    try:
        conn = sqlite3.connect("/tmp/mosi_smart_home.sqlite")
    except sqlite3.Error as exc:
        print(f"Error: Cannot connect to smarthome database: {exc}")
        print("Score: 0.0/1.0")
        write_reward_files(0.0, results, {"smarthome": str(exc)}, "smarthome_db")
        sys.exit(1)

    try:
        thermostat_pass, thermostat_details = check_thermostat(conn)
        workout_pass, workout_details = check_workout(conn)
        coffee_pass, coffee_details = check_coffee(conn)
    finally:
        conn.close()

    response = get_agent_response()
    if response is None:
        response_score = 0.0
        response_flags = {
            "sleep_metrics": False,
            "recovery_rationale": False,
            "hr_abnormal": False,
            "actions_confirmed": False,
            "coffee_ready_discovery": False,
            "coffee_tomorrow_followup": False,
        }
        response_details = {"response": "No agent response found"}
    else:
        response_score, response_flags, response_details = score_response(response)

    state_score = 0.0
    for key, passed, detail in [
        ("thermostat", thermostat_pass, thermostat_details),
        ("workout", workout_pass, workout_details),
        ("coffee", coffee_pass, coffee_details),
    ]:
        results[key] = passed
        details[key] = detail
        if passed:
            state_score += 0.20

    results["response_score"] = response_score
    results.update(response_flags)
    details["response"] = response_details
    required_state_passed = thermostat_pass and workout_pass and coffee_pass
    required_response_passed = bool(
        response_flags["sleep_metrics"]
        and response_flags["recovery_rationale"]
        and response_flags["hr_abnormal"]
        and response_flags["coffee_ready_discovery"]
    )
    results["required_state_passed"] = required_state_passed
    results["required_response_passed"] = required_response_passed

    score = round(state_score + response_score, 2)
    print(f"D1 (Thermostat comfort 76°F): {'PASS' if thermostat_pass else 'FAIL'}")
    print(f"    -> {thermostat_details}")
    print(f"D2 (HIIT workout downgraded): {'PASS' if workout_pass else 'FAIL'}")
    print(f"    -> {workout_details}")
    print(
        f"D3 (Coffee delayed with derived READY): {'PASS' if coffee_pass else 'FAIL'}"
    )
    print(f"    -> {coffee_details}")
    print(f"D4 (Final response): {response_score:.2f}/0.40")
    print(f"    -> {response_details}")
    print(f"Score: {score:.2f}/1.0")

    write_reward_files(score, results, details)
    passed = score >= 0.5 and required_state_passed and required_response_passed
    if not passed:
        print("FAILED: Required state or response gates did not pass")
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
