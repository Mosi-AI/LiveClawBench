#!/usr/bin/env python3
import json
import os
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
# Key-name hints for incorrect / corrected claim extraction
# ---------------------------------------------------------------------------

INCORRECT_KEY_HINTS = {
    "incorrect",
    "stale",
    "old",
    "wrong",
    "before",
    "prior",
    "original",
    "outdated",
    "bad",
    "false",
    "invalid",
}
CORRECTED_KEY_HINTS = {
    "correct",
    "repair",
    "fix",
    "new",
    "after",
    "updated",
    "revised",
    "replacement",
    "good",
    "valid",
    "true",
    "current",
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


# ---------------------------------------------------------------------------
# Flexible text extraction from arbitrary JSON structures
# ---------------------------------------------------------------------------


def _extract_text_from_value(value) -> str:
    parts: list[str] = []
    if isinstance(value, str):
        parts.append(value)
    elif isinstance(value, list):
        for item in value:
            parts.append(_extract_text_from_value(item))
    elif isinstance(value, dict):
        for v in value.values():
            parts.append(_extract_text_from_value(v))
    return " ".join(parts)


def _key_matches_hints(key: str, hints: set[str]) -> bool:
    key_lower = key.lower()
    return any(h in key_lower for h in hints)


def extract_claim_texts(result: dict) -> tuple[str, str]:
    """Walk result dict and extract text for incorrect / corrected categories."""
    incorrect_parts: list[str] = []
    corrected_parts: list[str] = []

    def walk(obj, parent_key: str = ""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if _key_matches_hints(k, INCORRECT_KEY_HINTS):
                    incorrect_parts.append(_extract_text_from_value(v))
                    if isinstance(v, (dict, list)):
                        walk(v, k)
                elif _key_matches_hints(k, CORRECTED_KEY_HINTS):
                    corrected_parts.append(_extract_text_from_value(v))
                    if isinstance(v, (dict, list)):
                        walk(v, k)
                else:
                    walk(v, k)
        elif isinstance(obj, list):
            for item in obj:
                walk(item, parent_key)

    walk(result)
    return (
        " ".join(incorrect_parts).lower(),
        " ".join(corrected_parts).lower(),
    )


def concept_in_text(text: str, keywords: list[str]) -> bool:
    return any(kw.lower() in text for kw in keywords)


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


def repair_accuracy_score(result: dict, key: dict) -> dict[str, float]:
    incorrect_text, corrected_text = extract_claim_texts(result)

    # Also check the full result text as a fallback
    full_text = _extract_text_from_value(result).lower()

    incorrect_hints = key.get("incorrect_hints", {})
    corrected_hints = key.get("corrected_hints", {})
    total = len(incorrect_hints) + len(corrected_hints)
    if total == 0:
        return {"repair_accuracy": 0.0}

    correct = 0
    for keywords in incorrect_hints.values():
        if concept_in_text(incorrect_text, keywords) or concept_in_text(
            full_text, keywords
        ):
            correct += 1
    for keywords in corrected_hints.values():
        if concept_in_text(corrected_text, keywords) or concept_in_text(
            full_text, keywords
        ):
            correct += 1

    return {"repair_accuracy": round(correct / total, 4)}


def browser_trace_score(key: dict, events: list[dict]) -> dict[str, float]:
    searched = any(event.get("event") == "search" for event in events)
    page_ids = {
        normalize(event.get("doc_id", ""))
        for event in events
        if event.get("event") in {"click", "page"}
    }

    validated = {normalize(doc_id) for doc_id in key.get("validated_doc_ids", [])}
    visited_validated = len(validated & page_ids)

    search_score = 1.0 if searched else 0.0
    visit_score = round(min(1.0, visited_validated / max(1, len(validated))), 4)
    combined = round((search_score + visit_score) / 2, 4)

    return {"browser_trace": combined}


def weighted_sum(score: dict, rubric: dict) -> float:
    return round(sum(score.get(key, 0.0) * weight for key, weight in rubric.items()), 4)


def main() -> None:
    key = load_json(KEY)
    result = load_json(OUT / "result.json")
    events = load_browser_events(resolve_browser_log())

    scores = structural_scores(result)
    scores.update(repair_accuracy_score(result, key))
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
