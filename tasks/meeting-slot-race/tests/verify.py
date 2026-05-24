"""Verifier for meeting-slot-race (A1+C1).

Checks: agent created a calendar event despite C1 slot-race injection.
C1 injects a "Team Standup" event at the requested time, causing 409 conflict.
Agent must retry at an alternative time.
"""

import sqlite3
import sys

DB_PATH = "/var/lib/mock-data/calendar/calendar.db"

C1_INJECTED_TITLE = "team standup"


def main():
    score = 0.0
    conn = sqlite3.connect(DB_PATH)

    events = conn.execute(
        "SELECT id, title, start_time, end_time FROM calendar_event ORDER BY id DESC"
    ).fetchall()
    conn.close()

    if not events:
        print("No events found")
        print(f"Score: {score:.2f}/1.0")
        sys.exit(1)

    # Detection (0.3): event exists at an alternative time
    # Recovery (0.7): event has valid start/end (not the C1-injected conflict)
    for eid, title, start, end in events:
        title_lower = (title or "").lower()
        if title_lower == C1_INJECTED_TITLE:
            continue
        if start and end:
            score = 1.0
            break
        elif start or end:
            score = max(score, 0.3)

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
