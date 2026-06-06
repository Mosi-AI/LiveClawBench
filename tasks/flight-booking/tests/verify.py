#!/usr/bin/env python3
"""Verify flight-booking task: check if flight booked correctly.

PR-6 / B6.2 ③ — verifier-backend alignment
==========================================

Earlier the verifier imported the Flask SQLAlchemy app at
``/workspace/environment/airline-app/backend`` and queried its
``instance/airline.db``. PR-3 (commit ``3bd33dbd``) moved this task's
backend to the Bun ``mock-airline`` binary, which writes to
``/var/lib/mock-data/airline/airline.db`` (Bun SQLite, schema defined in
``mock-platform/mocks/airline/src/db/schema.ts``). The Flask DB was no
longer reachable by the running app, so every booking the agent created
through ``http://localhost:5173`` lived in the mock DB and the verifier
saw an empty bookings table.

The fix is to read the mock-airline SQLite database directly with the
stdlib ``sqlite3`` module. No SQLAlchemy, no Flask import, no
``create_app("development")``. The schema is flat (``users``,
``flights``, ``bookings`` with the columns listed in
``schema.ts``) so plain SQL covers everything the old SQLAlchemy
queries did.

Scoring (unchanged):
  * 0.8 — booking found for Peter on next Monday, JFK → LAX, cabin economy
  * +0.2 — bonus if the flight departs at exactly 10:00 (preferred slot)
  Total cap 1.0; pass threshold 1.0 (test.sh exits 0 only at full score).
"""

import sqlite3
import sys
from datetime import datetime, timedelta

AIRLINE_DB_PATH = "/var/lib/mock-data/airline/airline.db"
PETER_EMAIL = "peter.griffin@work.mosi.inc"


def check() -> float:
    try:
        conn = sqlite3.connect(f"file:{AIRLINE_DB_PATH}?mode=ro", uri=True)
    except sqlite3.OperationalError as exc:
        print(f"FAIL: mock-airline DB not reachable at {AIRLINE_DB_PATH}: {exc}")
        return 0.0
    conn.row_factory = sqlite3.Row
    try:
        peter = conn.execute(
            "SELECT id, email, first_name, last_name FROM users WHERE email = ?",
            (PETER_EMAIL,),
        ).fetchone()
        if peter is None:
            print(f"FAIL: Peter Griffin user not found (email={PETER_EMAIL})")
            return 0.0

        # Calculate next Monday (same algorithm as the previous Flask-backed
        # verifier so the task semantics do not shift)
        today = datetime.now()
        days_until_next_monday = (7 - today.weekday()) % 7
        if days_until_next_monday == 0:
            days_until_next_monday = 7
        next_monday = today + timedelta(days=days_until_next_monday)
        next_monday_date = next_monday.date()

        # Join bookings to flights so we can filter by route + date in one
        # query. departure_time is stored as TEXT in ISO format; we compare
        # date(...) to the literal YYYY-MM-DD of next Monday.
        rows = conn.execute(
            """
            SELECT b.id            AS booking_id,
                   b.booking_reference,
                   b.cabin_class,
                   f.flight_number,
                   f.origin_code,
                   f.destination_code,
                   f.departure_time
              FROM bookings b
              JOIN flights f ON f.id = b.flight_id
             WHERE b.user_id = ?
               AND f.origin_code = 'JFK'
               AND f.destination_code = 'LAX'
               AND date(f.departure_time) = ?
            """,
            (peter["id"], next_monday_date.isoformat()),
        ).fetchall()
    finally:
        conn.close()

    if not rows:
        print("FAIL: No booking found for Peter Griffin on next Monday from JFK to LAX")
        return 0.0

    # Prefer an economy booking; fall back to printing what we found so the
    # debug output is useful even when the cabin class is wrong.
    target = next(
        (r for r in rows if (r["cabin_class"] or "").lower() == "economy"), None
    )
    if target is None:
        chosen = rows[0]
        print(
            f"Found booking {chosen['booking_reference']} on flight "
            f"{chosen['flight_number']} but cabin_class="
            f"{chosen['cabin_class']!r} is not economy"
        )
        return 0.0

    print(f"Found booking: {target['booking_reference']}")
    print(
        f"  Flight: {target['flight_number']} "
        f"({target['origin_code']} -> {target['destination_code']})"
    )
    print(f"  Departure: {target['departure_time']}")
    print(f"  Cabin class: {target['cabin_class']}")

    score = 0.8

    # Bonus 0.2 for the 10:00 AM departure slot (matches legacy verifier)
    try:
        dep = datetime.fromisoformat(target["departure_time"].replace("Z", "+00:00"))
    except (TypeError, ValueError):
        dep = None

    if dep is not None and dep.hour == 10 and dep.minute == 0:
        print("  ✓ Flight departs at 10:00 AM (optimal time)")
        score += 0.2
    elif dep is not None:
        print(f"  Flight departs at {dep.hour:02d}:{dep.minute:02d} (not 10:00 AM)")
    else:
        print(f"  Could not parse departure_time={target['departure_time']!r}")

    print(f"\nFinal score: {score:.2f}")
    return min(score, 1.0)


score = check()
print(f"Score: {score}/1.0")
sys.exit(0 if score >= 1.0 else 1)
