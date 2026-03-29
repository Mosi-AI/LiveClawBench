#!/usr/bin/env python3
import json
import os
import sqlite3
from pathlib import Path

ROOT = Path.home() / ".openclaw"
OUT = ROOT / "output"
WORK = ROOT / "workspace"
KEY = Path(__file__).with_name("answer_key.json")
LOCAL_SEED_WORK = Path(__file__).resolve().parents[1] / "environment" / "workspace_seed"

SYSTEM_ROOT_FILES = {
    "AGENTS.md",
    "BOOTSTRAP.md",
    "HEARTBEAT.md",
    "IDENTITY.md",
    "SOUL.md",
    "TOOLS.md",
    "USER.md",
}


# ---------------------------------------------------------------------------
# JSON / text helpers
# ---------------------------------------------------------------------------


def load_json(path: Path):
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def read_text(path: Path) -> str:
    if not path.is_file():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def normalize(value) -> str:
    return str(value).strip().lower()


def normalize_set(values) -> set[str]:
    if not isinstance(values, list):
        return set()
    return {normalize(item) for item in values if str(item).strip()}


def concept_in_text(text: str, keywords: list[str]) -> bool:
    text_lower = text.lower()
    return any(kw.lower() in text_lower for kw in keywords)


def multi_concept_match(text: str, keywords: list[str], min_matches: int = 2) -> bool:
    """Return True if at least min_matches keywords appear in text."""
    text_lower = text.lower()
    matched = sum(1 for kw in keywords if kw.lower() in text_lower)
    return matched >= min_matches


def collect_all_text(obj, depth: int = 0) -> str:
    """Recursively collect all string values from a JSON structure."""
    if depth > 20:
        return ""
    if isinstance(obj, str):
        return obj
    if isinstance(obj, (int, float)):
        return str(obj)
    if isinstance(obj, dict):
        return " ".join(collect_all_text(v, depth + 1) for v in obj.values())
    if isinstance(obj, list):
        return " ".join(collect_all_text(v, depth + 1) for v in obj)
    return ""


def load_result_payload() -> dict:
    """Load result.json from multiple candidate paths."""
    for path in (
        OUT / "result.json",
        WORK / "output" / "result.json",
        WORK / "result.json",
    ):
        payload = load_json(path)
        if payload:
            return payload
    return {}


# ---------------------------------------------------------------------------
# Browser trace helpers
# ---------------------------------------------------------------------------


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


def resolve_browser_log() -> Path:
    candidates = [
        OUT / "browser_mock_access.jsonl",
        Path("/shared/browser_mock_access.jsonl"),
    ]
    env_path = os.environ.get("BROWSER_MOCK_ACCESS_LOG")
    if env_path:
        candidates.insert(0, Path(env_path))
    for candidate in candidates:
        if candidate.exists() and candidate.stat().st_size > 0:
            return candidate
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return OUT / "browser_mock_access.jsonl"


# ---------------------------------------------------------------------------
# Workspace / artifact helpers
# ---------------------------------------------------------------------------


def resolve_workspace_path(rel_path: str) -> Path | None:
    if not isinstance(rel_path, str) or not rel_path.strip():
        return None
    candidate = (WORK / rel_path).resolve()
    try:
        candidate.relative_to(WORK.resolve())
    except ValueError:
        return None
    return candidate


def is_durable_artifact(path: Path) -> bool:
    if not path.is_file() or path.suffix != ".md" or path.stat().st_size <= 0:
        return False
    try:
        rel = path.resolve().relative_to(WORK.resolve())
    except ValueError:
        return False
    if rel.parts and rel.parts[0] in {"corpus", "output"}:
        return False
    if path.parent == WORK and path.name in SYSTEM_ROOT_FILES:
        return False
    return True


def workspace_relpath(path: Path) -> Path:
    return path.resolve().relative_to(WORK.resolve())


def gather_durable_artifact_paths(result: dict) -> list[Path]:
    candidates: list[Path] = []
    seen: set[Path] = set()

    paths = result.get("updated_artifacts")
    if isinstance(paths, list):
        for rel in paths:
            candidate = resolve_workspace_path(rel) if isinstance(rel, str) else None
            if candidate is not None and candidate not in seen:
                candidates.append(candidate)
                seen.add(candidate)

    for candidate in WORK.glob("*.md"):
        if candidate not in seen:
            candidates.append(candidate)
            seen.add(candidate)

    for subdir in ("memory", "state", "notes"):
        root = WORK / subdir
        if not root.is_dir():
            continue
        for candidate in sorted(root.glob("*.md")):
            if candidate not in seen:
                candidates.append(candidate)
                seen.add(candidate)

    return [c for c in candidates if is_durable_artifact(c)]


def seed_workspace_root() -> Path | None:
    for candidate in (Path("/task/workspace"), LOCAL_SEED_WORK):
        if candidate.is_dir():
            return candidate
    return None


def is_modified_from_seed(path: Path) -> bool:
    if not is_durable_artifact(path):
        return False
    seed_root = seed_workspace_root()
    if seed_root is None:
        return True
    rel = workspace_relpath(path)
    seed_path = seed_root / rel
    if not seed_path.exists():
        return True
    return read_text(path) != read_text(seed_path)


def load_output_texts() -> dict[str, str]:
    outputs: dict[str, str] = {}
    for name in ("final.md", "summary.md", "answer.md"):
        text = read_text(OUT / name).strip()
        if text:
            outputs[name] = text
    return outputs


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


def open_db(db_path: Path):
    if not db_path.exists():
        return None
    try:
        return sqlite3.connect(db_path)
    except sqlite3.Error:
        return None


def table_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    try:
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    except sqlite3.Error:
        return []
    return [str(row[1]) for row in rows if len(row) > 1]


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------


def structural_scores(result: dict) -> dict[str, float]:
    contract = 1.0 if result else 0.0
    modified = [
        p for p in gather_durable_artifact_paths(result) if is_modified_from_seed(p)
    ]
    workspace = 1.0 if modified else 0.0
    return {
        "result_contract_valid": contract,
        "workspace_update": workspace,
    }


def database_integrity_score(key: dict, result: dict) -> dict[str, float]:
    db_path = WORK / "db" / "spec_decode_knowledge.db"
    conn = open_db(db_path)
    if conn is None:
        return {"database_integrity": 0.0}
    try:
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
            if isinstance(row[0], str)
        }
        if not {"sources", "facts", "qa_answers"}.issubset(tables):
            return {"database_integrity": 0.0}

        # Schema check
        required_cols = key.get("required_db_columns", {})
        schema_hits = 0
        schema_total = 0
        for table, columns in required_cols.items():
            schema_total += 1
            if set(columns).issubset(set(table_columns(conn, table))):
                schema_hits += 1
        schema_score = round(schema_hits / max(1, schema_total), 4)

        # Source rows check
        try:
            source_rows = {
                normalize(row[0])
                for row in conn.execute("SELECT source_id FROM sources")
                if row and row[0] is not None
            }
        except sqlite3.Error:
            source_rows = set()
        required_sources = normalize_set(
            key.get("required_local_source_ids")
        ) | normalize_set(key.get("required_evidence_ids"))
        source_score = round(
            len(required_sources & source_rows) / max(1, len(required_sources)), 4
        )

        # Fact values check with keyword matching (flexible key names)
        fact_concepts = key.get("fact_concepts", {})
        required_fact_values = key.get("required_fact_values", {})
        try:
            fact_rows = [
                (normalize(row[0]), normalize(row[1]))
                for row in conn.execute("SELECT fact_key, fact_value FROM facts")
                if row and row[0] is not None
            ]
        except sqlite3.Error:
            fact_rows = []

        fact_hits = 0
        fact_total = len(required_fact_values)
        for fact_key, expected_value in required_fact_values.items():
            # Try exact key match first
            matched = False
            for fk, fv in fact_rows:
                if fk == normalize(fact_key):
                    if fv == normalize(expected_value):
                        matched = True
                    elif fact_key in fact_concepts and concept_in_text(
                        fv, fact_concepts[fact_key]
                    ):
                        matched = True
                    break
            # Fallback: search all values by concept keywords (handles different key names)
            if not matched and fact_key in fact_concepts:
                keywords = fact_concepts[fact_key]
                for fk, fv in fact_rows:
                    if concept_in_text(fv, keywords):
                        matched = True
                        break
            if matched:
                fact_hits += 1
        fact_score = round(fact_hits / max(1, fact_total), 4)

        # QA answers check with keyword matching (flexible key names)
        try:
            qa_rows = [
                (normalize(row[0]), normalize(row[1]))
                for row in conn.execute("SELECT question_id, answer FROM qa_answers")
                if row and row[0] is not None
            ]
        except sqlite3.Error:
            qa_rows = []

        qa_hits = 0
        for fact_key, expected_value in required_fact_values.items():
            matched = False
            for qk, qv in qa_rows:
                if qk == normalize(fact_key):
                    if qv == normalize(expected_value):
                        matched = True
                    elif fact_key in fact_concepts and concept_in_text(
                        qv, fact_concepts[fact_key]
                    ):
                        matched = True
                    break
            if not matched and fact_key in fact_concepts:
                keywords = fact_concepts[fact_key]
                for qk, qv in qa_rows:
                    if concept_in_text(qv, keywords):
                        matched = True
                        break
            if matched:
                qa_hits += 1
        qa_score = round(qa_hits / max(1, fact_total), 4)

        return {
            "database_integrity": round(
                (schema_score + source_score + fact_score + qa_score) / 4, 4
            )
        }
    finally:
        conn.close()


def query_accuracy_score(key: dict, result: dict) -> dict[str, float]:
    fact_concepts = key.get("fact_concepts", {})
    required_fact_values = key.get("required_fact_values", {})

    # Primary: check query_answers key
    actual_answers = result.get("query_answers", {})
    if not isinstance(actual_answers, dict):
        actual_answers = {}

    primary_hits = 0
    total = len(required_fact_values)
    for question_id, expected_value in required_fact_values.items():
        actual = normalize(actual_answers.get(question_id, ""))
        if actual == normalize(expected_value):
            primary_hits += 1
        elif question_id in fact_concepts and concept_in_text(
            actual, fact_concepts[question_id]
        ):
            primary_hits += 1

    # Fallback: if query_answers missing/empty, search entire result.json
    fallback_hits = 0
    if not actual_answers and result:
        full_text = collect_all_text(result)
        for question_id in required_fact_values:
            keywords = fact_concepts.get(question_id, [])
            if multi_concept_match(full_text, keywords, min_matches=2):
                fallback_hits += 1

    hits = max(primary_hits, fallback_hits)
    return {"query_accuracy": round(hits / max(1, total), 4)}


def browser_trace_score(key: dict, events: list[dict]) -> dict[str, float]:
    searched = any(event.get("event") == "search" for event in events)
    page_ids = {
        normalize(event.get("doc_id", ""))
        for event in events
        if event.get("event") in {"click", "page"}
    }

    required = normalize_set(key.get("required_evidence_ids"))
    low_conf = normalize_set(key.get("required_low_confidence_ids"))

    search_score = 1.0 if searched else 0.0
    required_visit_score = round(len(required & page_ids) / max(1, len(required)), 4)
    # Low-confidence page visit is a bonus (0.2), not a full third of the score
    low_conf_bonus = 0.2 if bool(low_conf & page_ids) else 0.0

    base = round((search_score + required_visit_score) / 2, 4)
    return {"browser_trace": round(min(1.0, base + low_conf_bonus), 4)}


def weighted_sum(score: dict, rubric: dict) -> float:
    return round(sum(score.get(key, 0.0) * weight for key, weight in rubric.items()), 4)


def main() -> None:
    key = load_json(KEY)
    result = load_result_payload()
    events = load_browser_events(resolve_browser_log())

    scores = structural_scores(result)
    scores.update(database_integrity_score(key, result))
    scores.update(query_accuracy_score(key, result))
    scores.update(browser_trace_score(key, events))

    payload = {
        "scores": scores,
        "durable_artifacts": [
            str(workspace_relpath(p)) for p in gather_durable_artifact_paths(result)
        ],
        "modified_durable_artifacts": [
            str(workspace_relpath(p))
            for p in gather_durable_artifact_paths(result)
            if is_modified_from_seed(p)
        ],
        "output_texts": sorted(load_output_texts().keys()),
    }
    (OUT / "structural_checks.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
