#!/usr/bin/env python3
import json
import sqlite3
from pathlib import Path

ROOT = Path.home() / ".openclaw"
OUT = ROOT / "output"
KEY = Path(__file__).with_name("answer_key.json")

EMAIL_DB_PATH = "/var/lib/mock-data/email/email.db"


def load_json(path: Path):
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def find_sent_reply(target_email: str) -> dict | None:
    """Find the most recent sent email from peter (sender_id=1) to target_email."""
    try:
        conn = sqlite3.connect(EMAIL_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, subject, body, folder FROM emails "
            "WHERE sender_id = 1 AND folder = 'sent' AND recipient_email = ? "
            "ORDER BY id DESC LIMIT 1",
            (target_email,),
        )
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    except Exception:
        return None


def structural_scores(reply: dict | None) -> dict[str, float]:
    """Check whether a reply was sent to the target email address."""
    sent_reply_found = 1.0 if reply else 0.0
    return {"sent_reply_found": sent_reply_found}


def anchor_scores(reply: dict | None, key: dict) -> dict[str, float]:
    """Check if the reply body contains uncertainty/unverified language."""
    if not reply:
        return {"anchor_coverage": 0.0}
    body_lower = (reply.get("body") or "").lower()
    anchors = key.get("anchors", [])
    if not anchors:
        return {"anchor_coverage": 0.0}
    hit_count = sum(1 for anchor in anchors if anchor.lower() in body_lower)
    return {"anchor_coverage": round(hit_count / len(anchors), 4)}
