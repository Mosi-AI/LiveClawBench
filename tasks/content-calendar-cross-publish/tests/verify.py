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
from datetime import datetime, timedelta

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


def parse_iso(s):
    """Parse ISO-8601 datetime tolerating T/space separators and optional 'Z' suffix.

    The calendar mock stores whatever timestamp string the agent submits, so
    the verifier must accept both '2026-06-01T09:00:00' and '2026-06-01T09:00:00Z'.
    Returns a naive datetime; both sides of any comparison go through the same
    normalization so the implicit UTC offset cancels.
    """
    if not s:
        raise ValueError("empty timestamp")
    s = s.strip()
    if " " in s and "T" not in s:
        s = s.replace(" ", "T", 1)
    if s.endswith("Z"):
        s = s[:-1]
    return datetime.fromisoformat(s)


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
    """Calendar content events must pair with scheduled social posts.

    The campaign contract requires 3 social posts in the June 1-8 window
    and a matching calendar event for each. The verifier pairs each
    event_type='content' calendar event with the closest unmatched
    scheduled post by absolute time delta, counts the pair when within
    5 minutes, and awards full credit for >= 3 matched pairs.
    """
    if SOCIAL_DB_PATH is None:
        print("SKIP: Could not find social database for content event matching")
        return 0.15

    try:
        social_conn = sqlite3.connect(SOCIAL_DB_PATH)
        social_conn.row_factory = sqlite3.Row
        social_cursor = social_conn.cursor()
        social_cursor.execute(
            """
            SELECT id, content, scheduled_for FROM post
            WHERE author_account_id = 1
              AND status = 'scheduled'
              AND scheduled_for >= '2026-06-01'
              AND scheduled_for <= '2026-06-08'
            """
        )
        post_rows = social_cursor.fetchall()
        social_conn.close()
    except Exception as e:
        print(f"FAIL: Could not load scheduled posts: {e}")
        return 0.0

    try:
        cal_conn = sqlite3.connect(CALENDAR_DB_PATH)
        cal_conn.row_factory = sqlite3.Row
        cal_cursor = cal_conn.cursor()
        cal_cursor.execute(
            "SELECT id, title, start_time FROM calendar_event WHERE user_id = 1 AND event_type = 'content'"
        )
        event_rows = cal_cursor.fetchall()
        cal_conn.close()
    except Exception as e:
        print(f"FAIL: Could not open calendar database: {e}")
        return 0.0

    if not event_rows:
        print("FAIL: No calendar content events found")
        return 0.0
    if not post_rows:
        print("FAIL: No scheduled posts to pair calendar events with")
        return 0.0

    post_times = []
    for p in post_rows:
        try:
            post_times.append((p["id"], parse_iso(p["scheduled_for"])))
        except Exception as e:
            print(f"WARN: skipping post {p['id']} due to bad scheduled_for '{p['scheduled_for']}': {e}")

    tolerance = timedelta(minutes=5)
    matched_post_ids = set()
    matched_events = 0
    for ev in event_rows:
        try:
            ev_dt = parse_iso(ev["start_time"])
        except Exception as e:
            print(f"WARN: skipping event {ev['id']} due to bad start_time '{ev['start_time']}': {e}")
            continue
        best = None
        for pid, pdt in post_times:
            if pid in matched_post_ids:
                continue
            delta = abs(pdt - ev_dt)
            if delta <= tolerance and (best is None or delta < best[1]):
                best = (pid, delta)
        if best is not None:
            matched_post_ids.add(best[0])
            matched_events += 1

    if matched_events >= 3:
        print(f"PASS: {matched_events} content calendar events paired with scheduled posts")
        return 0.25
    if matched_events > 0:
        print(f"PARTIAL: {matched_events}/3 content calendar events paired with scheduled posts")
        return 0.1
    print(
        f"FAIL: 0 content calendar events match scheduled posts within 5 minutes "
        f"({len(event_rows)} events, {len(post_rows)} posts)"
    )
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
