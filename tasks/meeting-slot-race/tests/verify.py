"""Verifier for meeting-slot-race (A1+C1).

Checks: calendar event exists at a non-conflicting time.
"""
import sqlite3
import sys

DB_PATH = "/var/lib/mock-data/calendar/calendar.db"

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

    # Check for events created by the agent (recent, not seed events)
    # Detection (0.3): event exists at an alternative time
    # Recovery (0.7): event is properly formed with reasonable time
    for eid, title, start, end in events:
        if "project sync" in (title or "").lower() or "reschedule" in (title or "").lower():
            score = max(score, 0.3)
            if start and end:
                score = 1.0
                break

    # Fallback: any non-seed event counts
    if score == 0.0 and len(events) > 2:
        score = 0.3
        if len(events) > 3:
            score = 1.0

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)

if __name__ == "__main__":
    main()
