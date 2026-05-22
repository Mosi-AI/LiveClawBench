#!/usr/bin/env python3
import json
import sqlite3
from pathlib import Path

ROOT = Path.home() / ".openclaw"
OUT = ROOT / "output"
KEY = Path(__file__).with_name("answer_key.json")

CALENDAR_DB_PATH = "/var/lib/mock-data/calendar/calendar.db"
ORIGINAL_DESCRIPTION = "Quarterly partnership review with TerraScale Logistics"


def load_json(path: Path):
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def find_terrascale_event(keyword: str = "TerraScale") -> dict | None:
    """Find the TerraScale meeting event from the calendar DB."""
    try:
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, title, start_time, description FROM calendar_event "
            "WHERE user_id = 1 AND title LIKE ? ORDER BY id LIMIT 1",
            (f"%{keyword}%",),
        )
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    except Exception:
        return None


def structural_scores(event: dict | None) -> dict[str, float]:
    """Check whether the calendar description was meaningfully updated."""
    if not event:
        return {"description_updated": 0.0}
    desc = (event.get("description") or "").strip()
    updated = (
        bool(desc)
        and desc != ORIGINAL_DESCRIPTION
        and len(desc) > len(ORIGINAL_DESCRIPTION)
    )
    return {"description_updated": 1.0 if updated else 0.0}


def anchor_scores(event: dict | None, key: dict) -> dict[str, float]:
    """Check how many risk categories are covered in the description."""
    if not event:
        return {"anchor_coverage": 0.0}
    desc_lower = (event.get("description") or "").lower()
    groups = key.get("anchor_groups", {})
    if not groups:
        return {"anchor_coverage": 0.0}
    hit_count = sum(
        1 for terms in groups.values() if any(t.lower() in desc_lower for t in terms)
    )
    return {"anchor_coverage": round(hit_count / len(groups), 4)}
