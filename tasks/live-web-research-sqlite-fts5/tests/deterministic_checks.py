#!/usr/bin/env python3
import json
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
# Browser trace helpers
# ---------------------------------------------------------------------------

AGENT_TRACE_CANDIDATES = (
    Path("/logs/agent/trajectory.json"),
    Path("/logs/agent/openclaw-state/agents/main/sessions/harbor.jsonl"),
    Path("/logs/agent/openclaw.txt"),
)


def read_trace_text() -> str:
    parts = []
    for path in (
        OUT / "browser_requests.json",
        OUT / "browser_tabs.json",
        OUT / "agent_response.json",
        *AGENT_TRACE_CANDIDATES,
    ):
        if path.exists():
            parts.append(read_text(path))
    return "\n".join(parts).lower()


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


def table_columns(conn, table_name: str) -> list[str]:
    try:
        return [
            str(row[1])
            for row in conn.execute(f"PRAGMA table_info({table_name})")
            if len(row) >= 2
        ]
    except sqlite3.Error:
        return []


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


def _find_any_db() -> Path | None:
    """Search for any .db or .sqlite file under workspace/db/."""
    db_dir = WORK / "db"
    if not db_dir.is_dir():
        return None
    for pattern in ("*.db", "*.sqlite"):
        for candidate in db_dir.glob(pattern):
            if candidate.is_file() and candidate.stat().st_size > 0:
                return candidate
    return None


def _score_sqlite(conn, key: dict) -> float:
    """Score a SQLite database for fact integrity. Returns 0.0-1.0."""
    tables = {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
        if isinstance(row[0], str)
    }
    if not {"sources", "facts", "qa_answers"}.issubset(tables):
        # Partial credit: at least some tables exist
        table_credit = len({"sources", "facts", "qa_answers"} & tables) / 3.0
        if table_credit == 0:
            return 0.0
        # Still check whatever tables exist below

    fact_concepts = key.get("fact_concepts", {})
    required_fact_values = key.get("required_fact_values", {})

    fact_values = {}
    fact_cols = table_columns(conn, "facts")
    try:
        if {"fact_key", "fact_value"}.issubset(fact_cols):
            fact_values = {
                normalize(row[0]): normalize(row[1])
                for row in conn.execute("SELECT fact_key, fact_value FROM facts")
                if row and row[0] is not None
            }
        elif {"question_id", "answer"}.issubset(fact_cols):
            fact_values = {
                normalize(row[0]): normalize(row[1])
                for row in conn.execute("SELECT question_id, answer FROM facts")
                if row and row[0] is not None
            }
    except sqlite3.Error:
        fact_values = {}

    qa_answers = {}
    qa_cols = table_columns(conn, "qa_answers")
    try:
        if {"question_id", "answer"}.issubset(qa_cols):
            qa_answers = {
                normalize(row[0]): normalize(row[1])
                for row in conn.execute("SELECT question_id, answer FROM qa_answers")
                if row and row[0] is not None
            }
        elif {"fact_key", "fact_value"}.issubset(qa_cols):
            qa_answers = {
                normalize(row[0]): normalize(row[1])
                for row in conn.execute("SELECT fact_key, fact_value FROM qa_answers")
                if row and row[0] is not None
            }
    except sqlite3.Error:
        qa_answers = {}

    fact_hits = 0
    qa_hits = 0
    total = len(required_fact_values)
    for question_id, expected_value in required_fact_values.items():
        nid = normalize(question_id)
        nval = normalize(expected_value)
        actual_fact = fact_values.get(nid, "")
        if actual_fact == nval:
            fact_hits += 1
        elif question_id in fact_concepts and concept_in_text(
            actual_fact, fact_concepts[question_id]
        ):
            fact_hits += 1
        actual_qa = qa_answers.get(nid, "")
        if actual_qa == nval:
            qa_hits += 1
        elif question_id in fact_concepts and concept_in_text(
            actual_qa, fact_concepts[question_id]
        ):
            qa_hits += 1

    return round((fact_hits + qa_hits) / max(1, 2 * total), 4)


def _score_json_as_db(result: dict, key: dict) -> float:
    """Fallback: score result.json as a JSON-based knowledge store. Capped at 0.5."""
    if not result:
        return 0.0
    fact_concepts = key.get("fact_concepts", {})
    required_fact_values = key.get("required_fact_values", {})
    full_text = collect_all_text(result)
    hits = 0
    total = len(required_fact_values)
    for question_id in required_fact_values:
        keywords = fact_concepts.get(question_id, [])
        if multi_concept_match(full_text, keywords, min_matches=2):
            hits += 1
    # Cap at 0.5: JSON is accepted but task asked for a "database"
    return round(0.5 * hits / max(1, total), 4)


def database_integrity_score(key: dict) -> dict[str, float]:
    # Try the expected DB path first, then any .db/.sqlite file
    db_path = WORK / "db" / "spec_decode_live.db"
    conn = open_db(db_path)
    if conn is None:
        alt = _find_any_db()
        if alt is not None:
            conn = open_db(alt)

    if conn is not None:
        try:
            score = _score_sqlite(conn, key)
            return {"database_integrity": score}
        finally:
            conn.close()

    # JSON fallback: treat result.json as a structured knowledge store
    result = load_result_payload()
    return {"database_integrity": _score_json_as_db(result, key)}


def query_accuracy_score(key: dict, result: dict) -> dict[str, float]:
    fact_concepts = key.get("fact_concepts", {})
    required_fact_values = key.get("required_fact_values", {})

    # Primary: check query_answers key (exact or keyword match)
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


def browser_trace_score(key: dict) -> dict[str, float]:
    trace_text = read_trace_text()
    required_urls = key.get("required_urls", {})
    hits = 0
    for url in required_urls.values():
        if normalize(url) in trace_text:
            hits += 1
    return {"browser_trace": round(hits / max(1, len(required_urls)), 4)}


def weighted_sum(score: dict, rubric: dict) -> float:
    return round(sum(score.get(key, 0.0) * weight for key, weight in rubric.items()), 4)


def main() -> None:
    key = load_json(KEY)
    result = load_result_payload()

    scores = structural_scores(result)
    scores.update(database_integrity_score(key))
    scores.update(query_accuracy_score(key, result))
    scores.update(browser_trace_score(key))

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
