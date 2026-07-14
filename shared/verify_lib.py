"""Shared verifier utilities for LiveClawBench tasks.

This module is copied into every task Docker image at /opt/mock/python/verify_lib.py
by build-task-images.ts. Verifier scripts can import from it via:

    from verify_lib import wait_for_tables

PYTHONPATH=/opt/mock/python is set in the per-task Docker image so the import
resolves without sys.path manipulation.
"""

import os
import sqlite3
import time


def wait_for_tables(db_path: str, required_tables: list[str], timeout: int = 60) -> None:
    """Defensive: wait for sqlite DB to exist AND contain all required tables.

    Mitigates the race where the verifier runs before the mock service has
    finished schema bootstrap (Issue #108 §2.3, Issue #110 B2).

    On timeout: prints a WARNING with diagnostic info (parent-dir listing)
    and RETURNS. We don't raise SystemExit because that would short-circuit
    the verifier and turn a "DB late" condition into a hard 0 — see
    GitHub issue #108 §2.3 for the underlying mock-vs-verifier race,
    and PR #113 review for the regression that motivated this design.
    The downstream sqlite3.connect() will surface a normal OperationalError
    if the file truly does not exist, which the verifier's per-anomaly
    try/except will score as 0 for that dimension only.

    Timeout can be overridden at runtime via MOCK_READY_TIMEOUT env var
    (Issue #108 §2.3 — cold-start variance on loaded CI runners).
    Invalid values (empty / non-integer) silently fall back to the default,
    so a misconfigured env var cannot crash the verifier at module load.
    """
    try:
        timeout = int(os.environ.get("MOCK_READY_TIMEOUT", str(timeout)))
    except (ValueError, TypeError):
        pass
    deadline = time.monotonic() + timeout
    last_err = None
    while time.monotonic() < deadline:
        if os.path.isfile(db_path):
            try:
                with sqlite3.connect(db_path) as _c:
                    names = {
                        r[0]
                        for r in _c.execute(
                            "SELECT name FROM sqlite_master WHERE type='table'"
                        )
                    }
                if all(t in names for t in required_tables):
                    return
                last_err = (
                    f"missing={[t for t in required_tables if t not in names]} "
                    f"present={sorted(names)[:10]}"
                )
            except sqlite3.Error as e:
                last_err = str(e)
        time.sleep(1)
    parent = os.path.dirname(db_path) or "/"
    try:
        entries = os.listdir(parent) if os.path.isdir(parent) else "<no such dir>"
    except OSError as e:
        entries = f"<listdir failed: {e}>"
    print(
        f"WARNING: DB {db_path} not ready after {timeout}s ({last_err}); "
        f"parent {parent} contents: {entries}. "
        f"Proceeding; downstream queries will fail per-dimension if mock truly absent.",
        flush=True,
    )
