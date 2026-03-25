#!/usr/bin/env python3
import json
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
    "MEMORY.md",
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


def browser_trace_score(required_ids: list[str], events: list[dict]) -> float:
    searched = any(event.get("event") == "search" for event in events)
    clicked_ids = {
        normalize(event.get("doc_id", ""))
        for event in events
        if event.get("event") == "click"
    }
    page_ids = {
        normalize(event.get("doc_id", ""))
        for event in events
        if event.get("event") == "page"
    }
    required = {normalize(doc_id) for doc_id in required_ids}
    evidence_ok = required.issubset(page_ids | clicked_ids)
    return (
        1.0 if searched and evidence_ok else (0.5 if searched or evidence_ok else 0.0)
    )


def weighted_sum(score: dict, rubric: dict) -> float:
    return round(sum(score.get(key, 0.0) * weight for key, weight in rubric.items()), 4)


def main() -> None:
    key = load_json(KEY)
    rubric = load_json(RUBRIC)
    result = load_json(OUT / "result.json")
    events = load_browser_events(OUT / "browser_mock_access.jsonl")

    score = {}
    required_fields = {
        "task_id",
        "topic_id",
        "incorrect_old_claim_ids",
        "corrected_claim_ids",
        "required_evidence_ids",
        "updated_artifacts",
    }
    score["result_contract_valid"] = (
        1.0 if required_fields.issubset(result.keys()) else 0.0
    )

    repair_hits = 0
    repair_hits += (
        1
        if normalize_set(result.get("incorrect_old_claim_ids"))
        == normalize_set(key.get("incorrect_old_claim_ids"))
        else 0
    )
    repair_hits += (
        1
        if normalize_set(result.get("corrected_claim_ids"))
        == normalize_set(key.get("corrected_claim_ids"))
        else 0
    )
    repair_hits += (
        1
        if normalize_set(result.get("required_evidence_ids"))
        == normalize_set(key.get("required_evidence_ids"))
        else 0
    )
    score["repair_accuracy"] = round(repair_hits / 3, 4)
    score["evidence_trace"] = browser_trace_score(
        key.get("required_evidence_ids", []), events
    )
    score["workspace_update"] = artifact_paths_valid(result)
    score["final_score"] = weighted_sum(score, rubric)

    (ROOT / "reward.json").write_text(
        json.dumps(score, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (ROOT / "reward.txt").write_text(str(score["final_score"]), encoding="utf-8")


if __name__ == "__main__":
    main()
