"""Seed metadata helper for verifier-side anchor consistency.

Reads /var/lib/mock-data/seed-meta.json written by the Bun seed function
at container startup. Provides the same anchor_time the Bun seeder used,
so verifiers compute "next Monday" identically.
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path

SEED_META_PATH = Path(
    os.environ.get("SEED_META_PATH", "/var/lib/mock-data/seed-meta.json")
)


def load_seed_meta() -> dict | None:
    """Load seed metadata written by Bun seeder. Returns None if absent."""
    try:
        with open(SEED_META_PATH) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def get_anchor_time() -> datetime:
    """Return the anchor time used by the Bun seeder.

    If seed-meta.json exists, parse its anchor_time field.
    Otherwise fall back to datetime.now() (matches legacy behavior).
    """
    meta = load_seed_meta()
    if meta and "anchor_time" in meta:
        return datetime.strptime(meta["anchor_time"], "%Y-%m-%d %H:%M:%S")
    return datetime.now()


def next_monday(anchor: datetime | None = None) -> datetime:
    """Compute the next Monday from the anchor (or container start if None).

    Uses the same semantics as the Bun seeder: Monday=0 in Python's weekday(),
    so we compute days_until_monday = (7 - anchor.weekday()) % 7, with a
    minimum of 1 day (if today is Monday, pick next Monday).
    """
    if anchor is None:
        anchor = get_anchor_time()
    days_until_monday = (7 - anchor.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    return anchor + timedelta(days=days_until_monday)
