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
    "REQUEST.md",
    "SOUL.md",
    "TOOLS.md",
    "USER.md",
}


def load_json(path: Path) -> dict:
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


def weighted_sum(score: dict, rubric: dict) -> float:
    return round(sum(score.get(key, 0.0) * weight for key, weight in rubric.items()), 4)


def replacement_score(actual: dict, expected: dict) -> float:
    if not isinstance(actual, dict):
        return 0.0
    hits = 0
    for claim_id, replacement_id in expected.items():
        if normalize(actual.get(claim_id, "")) == normalize(replacement_id):
            hits += 1
    return round(hits / max(1, len(expected)), 4)


def main() -> None:
    key = load_json(KEY)
    rubric = load_json(RUBRIC)
    result = load_json(OUT / "result.json")

    score = {}
    required_fields = {
        "task_id",
        "topic_id",
        "preserved_claim_ids",
        "updated_claim_ids",
        "removed_claim_ids",
        "replacement_claims",
        "evidence_source_ids",
        "updated_artifacts",
    }
    score["result_contract_valid"] = (
        1.0 if required_fields.issubset(result.keys()) else 0.0
    )

    delta_hits = 0
    delta_hits += (
        1
        if normalize_set(result.get("preserved_claim_ids"))
        == normalize_set(key.get("preserved_claim_ids"))
        else 0
    )
    delta_hits += (
        1
        if normalize_set(result.get("updated_claim_ids"))
        == normalize_set(key.get("updated_claim_ids"))
        else 0
    )
    delta_hits += (
        1
        if normalize_set(result.get("removed_claim_ids"))
        == normalize_set(key.get("removed_claim_ids"))
        else 0
    )
    score["delta_accuracy"] = round(delta_hits / 3, 4)
    score["replacement_accuracy"] = replacement_score(
        result.get("replacement_claims"), key.get("replacement_claims", {})
    )
    score["source_usage"] = (
        1.0
        if normalize_set(result.get("evidence_source_ids"))
        == normalize_set(key.get("evidence_source_ids"))
        else 0.0
    )
    score["workspace_update"] = artifact_paths_valid(result)
    score["final_score"] = weighted_sum(score, rubric)

    (ROOT / "reward.json").write_text(
        json.dumps(score, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (ROOT / "reward.txt").write_text(str(score["final_score"]), encoding="utf-8")


if __name__ == "__main__":
    main()
