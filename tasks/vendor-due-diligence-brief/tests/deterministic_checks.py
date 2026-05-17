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

    min_red_flags = key.get("min_red_flags", 3)
    red_flags_ok = (
        isinstance(result.get("red_flags"), list)
        and len(result.get("red_flags", [])) >= min_red_flags
    )
    red_flags_minimum = 1.0 if red_flags_ok else 0.0

    return {
        "structural_valid": structural_valid,
        "red_flags_minimum": red_flags_minimum,
    }


def anchor_scores(result: dict, key: dict) -> dict[str, float]:
    anchors = key.get("anchors", [])
    if not anchors:
        return {"anchor_coverage": 0.0}
    text = result_as_text(result)
    hit_count = sum(1 for anchor in anchors if anchor.lower() in text)
    return {"anchor_coverage": round(hit_count / len(anchors), 4)}
