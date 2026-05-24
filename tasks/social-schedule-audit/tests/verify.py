#!/usr/bin/env python3
"""
Verifier for social-schedule-audit task (case_id=50).

Checks that the agent fixed 5 scheduling anomalies seeded into the social DB.
Weighted scoring: 0.1 / 0.1 / 0.3 / 0.2 / 0.3, total 1.0.

Anomalies:
  1. Post 101: status=published but published_at=NULL -> fixed if published_at set OR status changed
  2. Post 102: status=scheduled with past date -> fixed if now published
  3. Post 103: status=published but no action_log -> fixed if action_log exists or status changed
  4. Post 104: status=draft but action_log says published -> fixed if status matches log (published)
  5. Post 101 metrics: 0 impressions but 50000 likes (implausible) -> fixed if metric corrected

Verification uses direct SQLite access for fields not reliably exposed via the API.
"""

import sqlite3
import sys

DB_PATH = "/opt/mock/data/social/social.db"


def get_post(db: sqlite3.Connection, post_id: int) -> dict | None:
    row = db.execute(
        "SELECT id, status, published_at, scheduled_for FROM post WHERE id = ?",
        (post_id,),
    ).fetchone()
    if row is None:
        return None
    return {
        "id": row[0],
        "status": row[1],
        "published_at": row[2],
        "scheduled_for": row[3],
    }


def has_action_log(
    db: sqlite3.Connection, post_id: int, action_type: str | None = None
) -> bool:
    if action_type:
        row = db.execute(
            "SELECT COUNT(*) FROM post_action_log WHERE post_id = ? AND action_type = ?",
            (post_id, action_type),
        ).fetchone()
    else:
        row = db.execute(
            "SELECT COUNT(*) FROM post_action_log WHERE post_id = ?",
            (post_id,),
        ).fetchone()
    return row[0] > 0


def get_post_status(db: sqlite3.Connection, post_id: int) -> str | None:
    row = db.execute("SELECT status FROM post WHERE id = ?", (post_id,)).fetchone()
    return row[0] if row else None


def main():
    score = 0.0
    messages = []

    try:
        db = sqlite3.connect(DB_PATH)
        db.execute("PRAGMA journal_mode = WAL")
    except sqlite3.Error as e:
        messages.append(f"FATAL: Cannot open database: {type(e).__name__}: {e}")
        print(f"Score: {score}/1.0")
        for msg in messages:
            print(f"  {msg}")
        sys.exit(1)

    # --- Anomaly 1: Post 101 — published but published_at is NULL ---
    p101 = get_post(db, 101)
    if p101 is None:
        messages.append(
            "ANOMALY 1 (post 101): FAIL — post deleted (task requires repair, not deletion)"
        )
    elif p101["status"] == "deleted":
        messages.append(
            "ANOMALY 1 (post 101): FAIL — post soft-deleted (task requires repair, not deletion)"
        )
    elif p101["status"] != "published" and p101["published_at"] is None:
        messages.append(
            f"ANOMALY 1 (post 101): PASS — status changed to '{p101['status']}' "
            f"(no longer published without timestamp)"
        )
        score += 0.1
    elif p101["published_at"] is not None and p101["status"] == "published":
        messages.append(
            f"ANOMALY 1 (post 101): PASS — published_at now set to '{p101['published_at']}'"
        )
        score += 0.1
    else:
        messages.append(
            f"ANOMALY 1 (post 101): FAIL — status='{p101['status']}', "
            f"published_at={p101['published_at']} (still inconsistent)"
        )

    # --- Anomaly 2: Post 102 — scheduled with past date, should now be published ---
    p102 = get_post(db, 102)
    if p102 is None:
        messages.append(
            "ANOMALY 2 (post 102): FAIL — post deleted (task requires repair, not deletion)"
        )
    elif p102["status"] == "deleted":
        messages.append(
            "ANOMALY 2 (post 102): FAIL — post soft-deleted (task requires repair, not deletion)"
        )
    elif p102["status"] == "published":
        messages.append(
            "ANOMALY 2 (post 102): PASS — status is now 'published'"
            + (
                f", published_at='{p102['published_at']}'"
                if p102["published_at"]
                else ""
            )
        )
        score += 0.1
    elif p102["status"] == "draft":
        messages.append(
            "ANOMALY 2 (post 102): FAIL — changed to 'draft' instead of 'published'"
        )
    else:
        messages.append(
            f"ANOMALY 2 (post 102): FAIL — status is '{p102['status']}' "
            f"(should be 'published')"
        )

    # --- Anomaly 3: Post 103 — published but no action_log entry ---
    p103 = get_post(db, 103)
    p103_has_log = has_action_log(db, 103, "published")
    if p103 is None:
        messages.append(
            "ANOMALY 3 (post 103): FAIL — post deleted (task requires repair, not deletion)"
        )
    elif p103["status"] == "deleted":
        messages.append(
            "ANOMALY 3 (post 103): FAIL — post soft-deleted (task requires repair, not deletion)"
        )
    elif p103_has_log:
        messages.append("ANOMALY 3 (post 103): PASS — action_log entry now exists")
        score += 0.3
    elif p103["status"] != "published":
        messages.append(
            f"ANOMALY 3 (post 103): PASS — status changed to '{p103['status']}' "
            f"(no longer claims to be published without log)"
        )
        score += 0.3
    else:
        messages.append(
            "ANOMALY 3 (post 103): FAIL — still published with no action_log entry"
        )

    # --- Anomaly 4: Post 104 — status=draft but action_log says published ---
    p104_status = get_post_status(db, 104)
    if p104_status is None:
        messages.append(
            "ANOMALY 4 (post 104): FAIL — post deleted (task requires repair, not deletion)"
        )
    elif p104_status == "deleted":
        messages.append(
            "ANOMALY 4 (post 104): FAIL — post soft-deleted (task requires repair, not deletion)"
        )
    elif p104_status == "published":
        messages.append(
            "ANOMALY 4 (post 104): PASS — status now matches action_log ('published')"
        )
        score += 0.2
    elif not has_action_log(db, 104, "published"):
        messages.append(
            f"ANOMALY 4 (post 104): PASS — action_log removed, status is '{p104_status}'"
        )
        score += 0.2
    else:
        messages.append(
            f"ANOMALY 4 (post 104): FAIL — status='{p104_status}' but action_log "
            f"still says 'published' (mismatch persists)"
        )

    # --- Anomaly 5: Post 101 metrics — 0 impressions but 50000 likes (implausible) ---
    metric_row = db.execute(
        "SELECT impressions, likes FROM post_metric WHERE post_id = 101",
    ).fetchone()
    if metric_row is None:
        messages.append(
            "ANOMALY 5 (post 101 metrics): PASS — implausible metric row deleted"
        )
        score += 0.3
    elif metric_row[0] == 0 and metric_row[1] > 0:
        messages.append(
            f"ANOMALY 5 (post 101 metrics): FAIL — still implausible "
            f"(impressions={metric_row[0]}, likes={metric_row[1]})"
        )
    else:
        messages.append(
            f"ANOMALY 5 (post 101 metrics): PASS — metrics corrected "
            f"(impressions={metric_row[0]}, likes={metric_row[1]})"
        )
        score += 0.3

    db.close()

    print(f"Score: {score}/1.0")
    for msg in messages:
        print(f"  {msg}")

    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
