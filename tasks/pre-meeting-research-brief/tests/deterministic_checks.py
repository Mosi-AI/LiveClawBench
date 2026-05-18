#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path.home() / ".openclaw"
OUT = ROOT / "output"
KEY = Path(__file__).with_name("answer_key.json")


def load_json(path: Path):
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def result_as_text(result: dict) -> str:
    """Flatten all string values in result to a single searchable blob."""
    parts = []

    def walk(obj):
        if isinstance(obj, str):
            parts.append(obj)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)
        elif isinstance(obj, dict):
            for v in obj.values():
                walk(v)

    walk(result)
    return " ".join(parts).lower()


def structural_scores(result: dict, key: dict) -> dict[str, float]:
    required = key.get("required_fields", [])
    structural_valid = 1.0 if result and all(f in result for f in required) else 0.0

    min_points = key.get("min_discussion_points", 3)
    min_questions = key.get("min_questions", 3)
    min_risks = key.get("min_risks", 1)
    min_opportunities = key.get("min_opportunities", 1)

    points_ok = (
        isinstance(result.get("discussion_points"), list)
        and len(result.get("discussion_points", [])) >= min_points
    )
    questions_ok = (
        isinstance(result.get("suggested_questions"), list)
        and len(result.get("suggested_questions", [])) >= min_questions
    )
    risks_ok = (
        isinstance(result.get("risks"), list)
        and len(result.get("risks", [])) >= min_risks
    )
    opportunities_ok = (
        isinstance(result.get("opportunities"), list)
        and len(result.get("opportunities", [])) >= min_opportunities
    )

    structure_completeness = (
        1.0 if (points_ok and questions_ok and risks_ok and opportunities_ok) else 0.0
    )

    return {
        "structural_valid": structural_valid,
        "structure_completeness": structure_completeness,
    }


def anchor_scores(result: dict, key: dict) -> dict[str, float]:
    anchors = key.get("anchors", [])
    if not anchors:
        return {"anchor_coverage": 0.0}
    text = result_as_text(result)
    hit_count = sum(1 for anchor in anchors if anchor.lower() in text)
    return {"anchor_coverage": round(hit_count / len(anchors), 4)}
