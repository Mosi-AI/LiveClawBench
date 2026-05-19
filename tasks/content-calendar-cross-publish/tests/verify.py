#!/usr/bin/env python3
"""Verify content-calendar-cross-publish task:
1. Stale social posts cleaned up (deleted or published).
2. New social posts scheduled with future dates (June 1-7).
3. Calendar events created for new content pieces.
4. Orphan calendar events cleaned up.
"""

import os
import re
import sqlite3
import sys
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

if SOCIAL_DB_PATH is None:
    for root_dir in ["/var/lib/mock-data/social", "/opt/mock"]:
        p = os.path.join(root_dir, "social.db")
        if os.path.exists(p):
            SOCIAL_DB_PATH = p
            break


def parse_iso(s):
    """Parse ISO-8601 datetime into a naive UTC datetime, tolerating T/space
    separators and optional 'Z' suffix. Raises ValueError on failure.
    """
    if not s:
        raise ValueError("empty timestamp")
    s = s.strip()
    if " " in s and "T" not in s:
        s = s.replace(" ", "T", 1)
    if s.endswith("Z"):
        s = s[:-1]
    return datetime.fromisoformat(s)


def open_db(path: str) -> sqlite3.Connection | None:
    """Open a SQLite database with Row factory, or None on failure."""
    try:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        print(f"FAIL: Could not open database {path}: {e}")
        return None


STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "is",
    "it",
    "this",
    "that",
    "from",
    "be",
    "was",
    "are",
    "has",
    "have",
    "will",
    "do",
    "not",
    "no",
    "so",
    "if",
    "as",
    "we",
    "our",
    "your",
    "my",
    "their",
    "its",
    "up",
    "out",
    "can",
    "all",
    "just",
    "about",
    "into",
    "over",
    "after",
    "been",
    "some",
    "them",
    "new",
    "get",
    "make",
    "like",
    "time",
    "only",
    "more",
    "very",
    "also",
    "how",
    "post",
    "posts",
}


def _tokenize(text):
    """Tokenize text into lowercase words, ignoring short tokens and stopwords."""
    words = re.findall(r"[a-z]{3,}", (text or "").lower())
    return set(w for w in words if w not in STOPWORDS)


def _has_keyword_overlap(post_content, event_title, event_description, min_shared=1):
    """Check if a social post and calendar event share meaningful keywords."""
    post_tokens = _tokenize(post_content)
    event_tokens = _tokenize((event_title or "") + " " + (event_description or ""))
    return len(post_tokens & event_tokens) >= min_shared


def check_stale_posts_cleaned():
    """Stale scheduled posts with past dates should be removed or published."""
    if SOCIAL_DB_PATH is None:
        print("SKIP: Could not find social database")
        return 0.15

    conn = open_db(SOCIAL_DB_PATH)
    if not conn:
        return 0.0
    cursor = conn.cursor()
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
        print("PASS: No stale scheduled posts remain")
        return 0.25

    print(
        f"FAIL: {len(active_stale)} stale posts still scheduled: {[r['id'] for r in active_stale]}"
    )
    return 0.0


def check_new_posts_scheduled():
    """New social posts should be scheduled for June 1-7, 2026."""
    if SOCIAL_DB_PATH is None:
        print("SKIP: Could not find social database")
        return 0.15

    conn = open_db(SOCIAL_DB_PATH)
    if not conn:
        return 0.0
    cursor = conn.cursor()
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
    5 minutes AND sharing at least one meaningful campaign keyword, and
    awards full credit for >= 3 matched pairs.
    """
    if SOCIAL_DB_PATH is None:
        print("SKIP: Could not find social database for content event matching")
        return 0.15

    social_conn = open_db(SOCIAL_DB_PATH)
    if not social_conn:
        return 0.0
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

    cal_conn = open_db(CALENDAR_DB_PATH)
    if not cal_conn:
        return 0.0
    cal_cursor = cal_conn.cursor()
    cal_cursor.execute(
        "SELECT id, title, description, start_time FROM calendar_event WHERE user_id = 1 AND event_type = 'content'"
    )
    event_rows = cal_cursor.fetchall()
    cal_conn.close()

    if not event_rows:
        print("FAIL: No calendar content events found")
        return 0.0
    if not post_rows:
        print("FAIL: No scheduled posts to pair calendar events with")
        return 0.0

    post_times = []
    for p in post_rows:
        try:
            post_times.append((p["id"], parse_iso(p["scheduled_for"]), p["content"]))
        except Exception as e:
            print(
                f"WARN: skipping post {p['id']} due to bad scheduled_for '{p['scheduled_for']}': {e}"
            )

    tolerance = timedelta(minutes=5)
    matched_post_ids = set()
    matched_events = 0
    for ev in event_rows:
        try:
            ev_dt = parse_iso(ev["start_time"])
        except Exception as e:
            print(
                f"WARN: skipping event {ev['id']} due to bad start_time '{ev['start_time']}': {e}"
            )
            continue
        best = None
        for pid, pdt, pcontent in post_times:
            if pid in matched_post_ids:
                continue
            delta = abs(pdt - ev_dt)
            ev_desc = ev["description"] or ""
            if delta <= tolerance and _has_keyword_overlap(
                pcontent, ev["title"], ev_desc
            ):
                if best is None or delta < best[1]:
                    best = (pid, delta)
        if best is not None:
            matched_post_ids.add(best[0])
            matched_events += 1

    if matched_events >= 3:
        print(
            f"PASS: {matched_events} content calendar events paired with scheduled posts (time + keyword)"
        )
        return 0.25
    if matched_events > 0:
        print(
            f"PARTIAL: {matched_events}/3 content calendar events paired with scheduled posts (time + keyword)"
        )
        return 0.1
    print(
        f"FAIL: 0 content calendar events match scheduled posts within 5 minutes with keyword overlap "
        f"({len(event_rows)} events, {len(post_rows)} posts)"
    )
    return 0.0


def check_orphan_events_cleaned():
    """Orphan calendar events from failed sync should be cleaned up."""
    conn = open_db(CALENDAR_DB_PATH)
    if not conn:
        return 0.0
    cursor = conn.cursor()
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
    scores = [
        check_stale_posts_cleaned(),
        check_new_posts_scheduled(),
        check_calendar_content_events(),
        check_orphan_events_cleaned(),
    ]
    total = sum(scores)
    print(f"Score: {total:.2f}/1.0")
    sys.exit(0 if total >= 0.9 else 1)


if __name__ == "__main__":
    main()
