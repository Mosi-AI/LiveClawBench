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


def normalize_set(values) -> set[str]:
    if not isinstance(values, list):
        return set()
    return {normalize(item) for item in values if str(item).strip()}


def load_browser_events(path: Path) -> list[dict]:
    if not path.exists():
        return []
    events = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            events.append(payload)
    return events


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

        source_ids = {
            normalize(row[0])
            for row in conn.execute("SELECT source_id FROM sources")
            if row and row[0] is not None
        }
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

        required_sources = normalize_set(key.get("required_source_ids"))
        required_facts = {
            normalize(k): normalize(v)
            for k, v in key.get("required_fact_values", {}).items()
        }

        source_score = (
            1.0
            if required_sources.issubset(source_ids)
            else round(
                len(required_sources & source_ids) / max(1, len(required_sources)), 4
            )
        )
        fact_hits = 0
        for fact_key, fact_value in required_facts.items():
            if fact_values.get(fact_key) == fact_value:
                fact_hits += 1
        fact_score = round(fact_hits / max(1, len(required_facts)), 4)
        qa_hits = 0
        for fact_key, fact_value in required_facts.items():
            if qa_answers.get(fact_key) == fact_value:
                qa_hits += 1
        qa_score = round(qa_hits / max(1, len(required_facts)), 4)
        return round((source_score + fact_score + qa_score) / 3, 4)
    finally:
        conn.close()


def browser_trace_score(key: dict, events: list[dict]) -> float:
    searched = any(event.get("event") == "search" for event in events)
    page_ids = {
        normalize(event.get("doc_id", ""))
        for event in events
        if event.get("event") in {"click", "page"}
    }
    required = normalize_set(key.get("required_evidence_ids"))
    low_conf = normalize_set(key.get("required_low_confidence_ids"))
    required_ok = required.issubset(page_ids)
    low_conf_ok = bool(low_conf & page_ids)
    if searched and required_ok and low_conf_ok:
        return 1.0
    if searched and required_ok:
        return 0.75
    if searched or required_ok:
        return 0.5
    return 0.0


def weighted_sum(score: dict, rubric: dict) -> float:
    return round(sum(score.get(key, 0.0) * weight for key, weight in rubric.items()), 4)


def main() -> None:
    key = load_json(KEY)
    rubric = load_json(RUBRIC)
    result = load_json(OUT / "result.json")
    events = load_browser_events(OUT / "browser_mock_access.jsonl")

    db_path = WORK / "db" / "spec_decode_knowledge.db"
    score = {}
    required_fields = {
        "task_id",
        "topic_id",
        "db_path",
        "retrieved_evidence_ids",
        "query_answers",
        "updated_artifacts",
    }
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
    for question_id, expected in expected_answers.items():
        if normalize(actual_answers.get(question_id, "")) == normalize(expected):
            hits += 1
    score["query_accuracy"] = round(hits / max(1, len(expected_answers)), 4)
    score["evidence_trace"] = browser_trace_score(key, events)
    score["workspace_update"] = artifact_paths_valid(result)
    score["final_score"] = weighted_sum(score, rubric)

    (ROOT / "reward.json").write_text(
        json.dumps(score, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (ROOT / "reward.txt").write_text(str(score["final_score"]), encoding="utf-8")


if __name__ == "__main__":
    main()
