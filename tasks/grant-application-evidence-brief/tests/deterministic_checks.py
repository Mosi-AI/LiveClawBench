#!/usr/bin/env python3
"""Deterministic pre-checks for grant-application-evidence-brief."""

import json
from pathlib import Path

ROOT = Path.home() / ".openclaw"
OUT = ROOT / "output"
RESULT_PATH = OUT / "result.json"

REQUIRED_FIELDS = [
    "project_objective",
    "supporting_evidence",
    "novelty",
    "evidence_gaps",
    "next_steps",
]


def load_result() -> dict:
    if not RESULT_PATH.exists():
        return {}
    try:
        payload = json.loads(RESULT_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return payload if isinstance(payload, dict) else {}


def check_structure(result: dict) -> dict[str, float]:
    scores: dict[str, float] = {}

    # result.json exists and is a dict
    scores["result_exists"] = 1.0 if result else 0.0
    if not result:
        return scores

    # All required fields present
    missing = [f for f in REQUIRED_FIELDS if f not in result]
    scores["fields_complete"] = 1.0 if not missing else 0.0

    # supporting_evidence >= 3 items
    evidence = result.get("supporting_evidence", [])
    scores["evidence_count"] = (
        1.0 if isinstance(evidence, list) and len(evidence) >= 3 else 0.0
    )

    # evidence_gaps >= 2 items
    gaps = result.get("evidence_gaps", [])
    scores["gaps_count"] = 1.0 if isinstance(gaps, list) and len(gaps) >= 2 else 0.0

    return scores


def check_a2_corrections(result: dict) -> dict[str, float]:
    """Check that specific outdated claims from the old draft are corrected."""
    if not result:
        return {"a2_f1_updated": 0.0, "a2_venue_updated": 0.0}

    # Flatten all text in the result
    text = json.dumps(result, ensure_ascii=False).lower()

    # A2 check 1: Old draft cited "78.3%" F1 as current result.
    # Correct value from latest materials: 84.1%.
    # Pass if "84.1" appears (agent used updated figure).
    scores: dict[str, float] = {}
    scores["a2_f1_updated"] = 1.0 if "84.1" in text else 0.0

    # A2 check 2: Old draft said "submit to EMNLP 2024" as planned venue.
    # Correct: paper was accepted at ACL 2025.
    # Pass if "acl 2025" appears (agent acknowledged acceptance).
    scores["a2_venue_updated"] = 1.0 if "acl 2025" in text else 0.0

    return scores


def run() -> tuple[dict[str, float], dict]:
    result = load_result()
    scores = {}
    scores.update(check_structure(result))
    scores.update(check_a2_corrections(result))
    return scores, result


if __name__ == "__main__":
    scores, _ = run()
    print(json.dumps(scores, indent=2))
