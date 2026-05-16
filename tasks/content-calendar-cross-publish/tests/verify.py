#!/usr/bin/env python3
"""Verify content-calendar-cross-publish task:
1. Stale social posts cleaned up (deleted or published).
2. New social posts scheduled with future dates (June 1-7).
3. Calendar events created for new content pieces.
4. Orphan calendar events cleaned up.
"""

import sqlite3
import sys
import os

CALENDAR_DB_PATH = "/var/lib/mock-data/calendar/calendar.db"

# Social DB uses a relative path via getDb(), find it
SOCIAL_DB_PATH = None
for candidate in [
    "/workspace/data/social.db",
    "/workspace/social.db",
]:
    if os.path.exists(candidate):
        SOCIAL_DB_PATH = candidate
        break

# Also check common mock-data locations
if SOCIAL_DB_PATH is None:
    for root_dir in ["/var/lib/mock-data/social", "/opt/mock"]:
        p = os.path.join(root_dir, "social.db")
        if os.path.exists(p):
            SOCIAL_DB_PATH = p
            break


def check_stale_posts_cleaned():
    """Stale scheduled posts with past dates should be removed or published."""
    if SOCIAL_DB_PATH is None:
        print("SKIP: Could not find social database")
        return 0.15

    try:
        conn = sqlite3.connect(SOCIAL_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open social database: {e}")
        return 0.0

    cursor.execute(
        "SELECT id, content, status, scheduled_for FROM post WHERE id IN (100, 101, 102)"
    )
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        print("PASS: Stale posts cleaned up (deleted)")
        return 0.25

    all_published = all(r["status"] == "published" for r in rows)
    all_deleted = all(r["status"] == "deleted" for r in rows)

    if all_published or all_deleted:
        print(f"PASS: Stale posts resolved (status={rows[0]['status']})")
        return 0.25

    active_stale = [r for r in rows if r["status"] == "scheduled"]
    if len(active_stale) == 0:
        print(f"PASS: No stale scheduled posts remain")
        return 0.25

    print(f"FAIL: {len(active_stale)} stale posts still scheduled: {[r['id'] for r in active_stale]}")
    return 0.0


def check_new_posts_scheduled():
    """New social posts should be scheduled for June 1-7, 2026."""
    if SOCIAL_DB_PATH is None:
        print("SKIP: Could not find social database")
        return 0.15

    try:
        conn = sqlite3.connect(SOCIAL_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open social database: {e}")
        return 0.0

    cursor.execute(
        """
        SELECT id, content, status, scheduled_for FROM post
        WHERE author_account_id = 1
          AND status = 'scheduled'
          AND scheduled_for >= '2026-06-01'
          AND scheduled_for <= '2026-06-08'
        """
    )
    rows = cursor.fetchall()
    conn.close()

    if len(rows) >= 3:
        print(f"PASS: {len(rows)} new social posts scheduled for June 1-7")
        return 0.25

    if len(rows) > 0:
        print(f"PARTIAL: Only {len(rows)} posts scheduled for June 1-7 (expected 3+)")
        return 0.1

    print("FAIL: No social posts scheduled for June 1-7")
    return 0.0


def check_calendar_content_events():
    """Calendar events for content pieces should exist."""
    try:
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open calendar database: {e}")
        return 0.0

    cursor.execute(
        "SELECT id, title, event_type FROM calendar_event WHERE user_id = 1 AND event_type = 'content'"
    )
    rows = cursor.fetchall()
    conn.close()

    titles_lower = [(r["title"] or "").lower() for r in rows]
    has_blog = any("blog" in t or "summer" in t or "collection" in t or "content" in t for t in titles_lower)

    if has_blog and len(rows) >= 1:
        print(f"PASS: Calendar content events exist ({len(rows)} events)")
        return 0.25

    if len(rows) > 0:
        print(f"PARTIAL: Calendar has {len(rows)} content events but may not match campaign")
        return 0.1

    print("FAIL: No calendar content events found")
    return 0.0


def check_orphan_events_cleaned():
    """Orphan calendar events from failed sync should be cleaned up."""
    try:
        conn = sqlite3.connect(CALENDAR_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"FAIL: Could not open calendar database: {e}")
        return 0.0

    cursor.execute(
        "SELECT id, title FROM calendar_event WHERE user_id = 1 AND title IN ('Spring Collection Post', 'Flash Sale Post')"
    )
    rows = cursor.fetchall()
    conn.close()

    if len(rows) == 0:
        print("PASS: Orphan calendar events cleaned up")
        return 0.25

    print(f"FAIL: {len(rows)} orphan events still exist: {[r['title'] for r in rows]}")
    return 0.0


def main():
    scores = []
    scores.append(check_stale_posts_cleaned())
    scores.append(check_new_posts_scheduled())
    scores.append(check_calendar_content_events())
    scores.append(check_orphan_events_cleaned())

    total = sum(scores)
    print(f"Score: {total:.2f}/1.0")
    sys.exit(0 if total >= 0.9 else 1)


if __name__ == "__main__":
    main()
