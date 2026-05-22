import importlib.util
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock


TASK_DIR = Path(__file__).resolve().parent.parent
VERIFY_PATH = TASK_DIR / "tests" / "verify.py"

spec = importlib.util.spec_from_file_location(
    "smarthome_morning_checkup_verify", VERIFY_PATH
)
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class SmarthomeMorningCheckupVerifierContractTests(unittest.TestCase):
    def _make_db(self, start_time="07:00", cancelled=0):
        handle = tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False)
        handle.close()

        conn = sqlite3.connect(handle.name)
        conn.executescript(
            """
            CREATE TABLE coffee_schedule (
                schedule_date TEXT PRIMARY KEY,
                start_time TEXT,
                beans_grams INTEGER,
                cancelled INTEGER,
                updated_at TEXT
            );
            """
        )
        conn.execute(
            """
            INSERT INTO coffee_schedule (
                schedule_date, start_time, beans_grams, cancelled, updated_at
            ) VALUES (?, ?, 20, ?, '2026-05-09T06:00:00Z')
            """,
            ("2026-05-09", start_time, cancelled),
        )
        conn.commit()
        conn.close()
        return handle.name

    def test_d2_requires_ready_status_not_brewing(self):
        db_path = self._make_db()
        response = "Coffee is set for 07:00 and is currently brewing."

        try:
            with mock.patch.object(verify, "SQLITE_DB", db_path):
                score = verify.check_d2_coffee_report(response)
        finally:
            Path(db_path).unlink()

        self.assertLess(score, 0.125)

    def test_d2_fails_if_today_coffee_schedule_was_modified(self):
        db_path = self._make_db(start_time="07:30")
        response = "Coffee is set for 07:00 and is currently ready."

        try:
            with mock.patch.object(verify, "SQLITE_DB", db_path):
                score = verify.check_d2_coffee_report(response)
        finally:
            Path(db_path).unlink()

        self.assertEqual(0.0, score)


if __name__ == "__main__":
    unittest.main()
