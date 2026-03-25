#!/usr/bin/env python3
import json
import sqlite3
from pathlib import Path

ROOT = Path.home() / ".openclaw"
OUT = ROOT / "output"
WORK = ROOT / "workspace"
KEY = Path(__file__).with_name("answer_key.json")
RUBRIC = Path(__file__).with_name("rubric.json")

IGNORED_WORKSPACE_ROOT_FILES = {
    "AGENTS.md",
    "BOOTSTRAP.md",
    "HEARTBEAT.md",
    "IDENTITY.md",
    "REQUEST.md",
    "SOUL.md",
    "TOOLS.md",
    "USER.md",
}


def load_json(path: Path):
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def normalize(value) -> str:
    return str(value).strip().lower()


def artifact_paths_valid(result: dict) -> float:
    paths = result.get("updated_artifacts")
    if not isinstance(paths, list) or not paths:
        return 0.0
    valid = 0
    for rel in paths:
        if not isinstance(rel, str) or not rel.strip():
            continue
        candidate = (WORK / rel).resolve()
        try:
            candidate.relative_to(WORK.resolve())
        except ValueError:
            continue
        if (
            candidate.is_file()
            and candidate.suffix == ".md"
            and candidate.stat().st_size > 0
        ):
            if (
                candidate.parent == WORK
                and candidate.name in IGNORED_WORKSPACE_ROOT_FILES
            ):
                continue
            valid += 1
    return 1.0 if valid >= 1 else 0.0


def read_trace_text() -> str:
    parts = []
    for path in (
        OUT / "browser_requests.json",
        OUT / "browser_tabs.json",
        OUT / "agent_response.json",
    ):
        if path.exists():
            parts.append(path.read_text(encoding="utf-8", errors="ignore"))
    return "\n".join(parts).lower()


def open_db(db_path: Path):
    if not db_path.exists():
        return None
    try:
        return sqlite3.connect(db_path)
    except sqlite3.Error:
        return None


def database_integrity_score(db_path: Path, key: dict) -> float:
    conn = open_db(db_path)
    if conn is None:
        return 0.0
    try:
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
            if isinstance(row[0], str)
        }
        if not {"sources", "facts", "qa_answers"}.issubset(tables):
            return 0.0
        fact_values = {
            normalize(row[0]): normalize(row[1])
            for row in conn.execute("SELECT fact_key, fact_value FROM facts")
            if row and row[0] is not None
        }
        qa_answers = {
            normalize(row[0]): normalize(row[1])
            for row in conn.execute("SELECT question_id, answer FROM qa_answers")
            if row and row[0] is not None
        }
        expected = {
            normalize(k): normalize(v)
            for k, v in key.get("required_fact_values", {}).items()
        }
        fact_hits = 0
        qa_hits = 0
        for question_id, expected_value in expected.items():
            if fact_values.get(question_id) == expected_value:
                fact_hits += 1
            if qa_answers.get(question_id) == expected_value:
                qa_hits += 1
        return round((fact_hits + qa_hits) / max(1, 2 * len(expected)), 4)
    finally:
        conn.close()


def weighted_sum(score: dict, rubric: dict) -> float:
    return round(sum(score.get(key, 0.0) * weight for key, weight in rubric.items()), 4)


def main() -> None:
    key = load_json(KEY)
    rubric = load_json(RUBRIC)
    result = load_json(OUT / "result.json")
    trace_text = read_trace_text()

    db_path = WORK / "db" / "spec_decode_live.db"
    required_fields = {
        "task_id",
        "topic_id",
        "db_path",
        "required_urls",
        "query_answers",
        "updated_artifacts",
    }
    score = {}
    score["result_contract_valid"] = (
        1.0
        if required_fields.issubset(result.keys())
        and normalize(result.get("db_path")) == normalize(key.get("db_path"))
        else 0.0
    )
    score["database_integrity"] = database_integrity_score(db_path, key)

    expected_answers = key.get("required_fact_values", {})
    actual_answers = result.get("query_answers", {})
    hits = 0
    for question_id, expected_value in expected_answers.items():
        if normalize(actual_answers.get(question_id, "")) == normalize(expected_value):
            hits += 1
    score["query_accuracy"] = round(hits / max(1, len(expected_answers)), 4)

    required_urls = key.get("required_urls", {})
    browser_hits = 0
    for url in required_urls.values():
        if normalize(url) in trace_text:
            browser_hits += 1
    score["browser_trace"] = round(browser_hits / max(1, len(required_urls)), 4)
    score["workspace_update"] = artifact_paths_valid(result)
    score["final_score"] = weighted_sum(score, rubric)

    (ROOT / "reward.json").write_text(
        json.dumps(score, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (ROOT / "reward.txt").write_text(str(score["final_score"]), encoding="utf-8")


if __name__ == "__main__":
    main()
