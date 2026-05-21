import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

TASK_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = TASK_DIR.parent.parent
VERIFY_PATH = TASK_DIR / "tests" / "verify.py"
TEST_SH_PATH = TASK_DIR / "tests" / "test.sh"
HEALTH_SEED_PATH = TASK_DIR / "environment" / "health-seed.sql"
SMARTHOME_SEED_PATH = TASK_DIR / "environment" / "seed.sql"
STARTUP_PATH = TASK_DIR / "environment" / "startup.sh"
BINARY_MAP_PATH = REPO_ROOT / "mock-platform" / "config" / "task-binary-map.json"
REGISTRY_PATH = REPO_ROOT / "registry.json"
CASES_REGISTRY_PATH = REPO_ROOT / "docs" / "metadata" / "cases_registry.csv"
BUILD_IMAGES_PATH = REPO_ROOT / "mock-platform" / "scripts" / "build-task-images.ts"

spec = importlib.util.spec_from_file_location(
    "sleep_trend_recovery_verify", VERIFY_PATH
)
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class SleepTrendRecoveryVerifierContractTests(unittest.TestCase):
    def test_health_seed_populates_current_day_sleep_outlier_and_metric_series(self):
        conn = sqlite3.connect(":memory:")
        conn.executescript(
            """
            CREATE TABLE mock_user (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                display_name TEXT
            );
            CREATE TABLE system_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE health_daily_snapshot (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                steps INTEGER,
                active_energy_kcal REAL,
                sleep_hours REAL,
                sleep_quality REAL,
                light_sleep_hours REAL,
                deep_sleep_hours REAL,
                rem_sleep_hours REAL,
                low_intensity_min REAL,
                medium_intensity_min REAL,
                high_intensity_min REAL,
                total_activity_min REAL,
                resting_heart_rate_bpm INTEGER,
                avg_heart_rate_bpm INTEGER,
                weight_kg REAL,
                body_fat_percent REAL,
                blood_oxygen_percent REAL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(user_id, date)
            );
            CREATE TABLE health_metric_series (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                metric_type TEXT NOT NULL,
                date TEXT NOT NULL,
                value REAL NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(user_id, metric_type, date)
            );
            """
        )
        conn.executescript(HEALTH_SEED_PATH.read_text())

        current_date = conn.execute(
            "SELECT value FROM system_config WHERE key = 'current_date'"
        ).fetchone()[0]
        self.assertEqual("2026-05-09", current_date)

        snapshot = conn.execute(
            """
            SELECT sleep_hours, sleep_quality, light_sleep_hours, deep_sleep_hours,
                   rem_sleep_hours, resting_heart_rate_bpm
            FROM health_daily_snapshot
            WHERE user_id = 1 AND date = '2026-05-09'
            """
        ).fetchone()
        self.assertEqual((6.5, 62.0, 4.09, 1.11, 1.3, 110), snapshot)

        metric_values = dict(
            conn.execute(
                """
                SELECT metric_type, value
                FROM health_metric_series
                WHERE user_id = 1 AND date = '2026-05-09'
                  AND metric_type IN (
                    'sleep_hours', 'sleep_quality', 'light_sleep_hours',
                    'deep_sleep_hours', 'rem_sleep_hours', 'resting_heart_rate_bpm'
                  )
                """
            ).fetchall()
        )
        self.assertEqual(
            {
                "sleep_hours": 6.5,
                "sleep_quality": 62.0,
                "light_sleep_hours": 4.09,
                "deep_sleep_hours": 1.11,
                "rem_sleep_hours": 1.3,
                "resting_heart_rate_bpm": 110.0,
            },
            metric_values,
        )

    def test_smarthome_seed_uses_derived_ready_coffee_and_recovery_targets(self):
        conn = sqlite3.connect(":memory:")
        conn.executescript(
            """
            CREATE TABLE thermostat_settings (
                id INTEGER PRIMARY KEY,
                mode TEXT,
                temperature REAL,
                updated_at TEXT
            );
            CREATE TABLE coffee_schedule (
                schedule_date TEXT PRIMARY KEY,
                start_time TEXT,
                beans_grams INTEGER,
                cancelled INTEGER,
                updated_at TEXT
            );
            CREATE TABLE benchmark_clock (
                id INTEGER PRIMARY KEY,
                clock_time TEXT NOT NULL
            );
            CREATE TABLE calendar_event (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                start_time TEXT NOT NULL,
                event_type TEXT,
                workout_type TEXT,
                status TEXT,
                updated_at TEXT
            );
            CREATE TABLE room_metrics (
                id INTEGER PRIMARY KEY,
                temperature REAL,
                humidity REAL,
                unit_temp TEXT,
                noise REAL,
                light REAL,
                air_quality REAL
            );
            CREATE TABLE room (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
            );
            """
        )
        conn.executescript(SMARTHOME_SEED_PATH.read_text())

        clock = conn.execute(
            "SELECT clock_time FROM benchmark_clock WHERE id = 1"
        ).fetchone()[0]
        self.assertEqual("2026-05-09T07:45:00Z", clock)

        thermostat = conn.execute(
            "SELECT mode, temperature FROM thermostat_settings WHERE id = 1"
        ).fetchone()
        self.assertEqual(("eco", 72.0), thermostat)

        workout = conn.execute(
            """
            SELECT title, start_time, event_type, workout_type
            FROM calendar_event
            WHERE title = 'HIIT Workout'
            """
        ).fetchone()
        self.assertEqual(
            ("HIIT Workout", "2026-05-09T09:00:00Z", "workout", "hiit"), workout
        )

        coffee_columns = [
            row[1] for row in conn.execute("PRAGMA table_info(coffee_schedule)")
        ]
        self.assertNotIn("status", coffee_columns)
        today = conn.execute(
            "SELECT start_time, cancelled FROM coffee_schedule WHERE schedule_date = '2026-05-09'"
        ).fetchone()
        tomorrow = conn.execute(
            "SELECT start_time, cancelled FROM coffee_schedule WHERE schedule_date = '2026-05-10'"
        ).fetchone()
        self.assertEqual(("07:00", 0), today)
        self.assertEqual(("07:00", 0), tomorrow)
        self.assertEqual(
            "ready", verify.derive_coffee_status("2026-05-09", "07:00", clock)
        )
        self.assertEqual(
            "scheduled", verify.derive_coffee_status("2026-05-10", "07:00", clock)
        )

    def test_response_scoring_requires_sleep_metrics_recovery_rationale_hr_and_coffee_followup(
        self,
    ):
        complete = (
            "Sleep duration was 6.5 hrs, Sleep Quality was 62%, Light Sleep was 4.09h, "
            "Deep Sleep was 1.11h, and REM Sleep was 1.3h, which indicates poor recovery because sleep quality is low "
            "and the sleep-stage balance is not restorative enough. Resting HR was 110 bpm, "
            "which is notably elevated and concerning for recovery. I set the thermostat "
            "to comfort at 76°F, changed the HIIT workout to swimming, and delayed coffee "
            "to 07:30. The coffee page showed READY before the edit, so this schedule change "
            "cannot affect coffee already brewed today. Would you like me to change tomorrow's coffee time instead?"
        )
        score, flags, details = verify.score_response(complete)
        self.assertEqual(0.4, score)
        self.assertTrue(flags["sleep_metrics"])
        self.assertTrue(flags["hr_abnormal"])
        self.assertTrue(flags["coffee_ready_followup"])
        self.assertEqual({}, details)

        no_rationale = (
            "Sleep duration was 6.5 hrs, Sleep Quality was 62%, Light Sleep was 4.09h, "
            "Deep Sleep was 1.11h, and REM Sleep was 1.3h. Resting HR was 110 bpm and elevated. "
            "I set the thermostat to comfort at 76°F, changed the HIIT workout to swimming, "
            "and delayed coffee to 07:30. The coffee page showed READY before the edit, so this schedule change "
            "cannot affect coffee already brewed today. Would you like me to change tomorrow's coffee time instead?"
        )
        score, flags, details = verify.score_response(no_rationale)
        self.assertLess(score, 0.4)
        self.assertFalse(flags["recovery_rationale"])
        self.assertIn("recovery_rationale", details)

        no_schedule_change = (
            "Sleep duration was 6.5 hrs, Sleep Quality was 62%, Light Sleep was 4.09h, "
            "Deep Sleep was 1.11h, and REM Sleep was 1.3h, which shows poor recovery because the sleep quality is low "
            "and the sleep stages are not restorative enough. Resting HR was 110 bpm, which is elevated. "
            "I set the thermostat to comfort at 76°F and changed the HIIT workout to swimming. "
            "The coffee page showed READY before the edit, so it cannot affect coffee already brewed today. "
            "Would you like me to change tomorrow's coffee time instead?"
        )
        score, flags, details = verify.score_response(no_schedule_change)
        self.assertLess(score, 0.4)
        self.assertFalse(flags["coffee_ready_followup"])
        self.assertIn("coffee_ready_followup", details)

        shallow_rationale = (
            "Sleep duration was 6.5 hrs, Sleep Quality was 62%, Light Sleep was 4.09h, "
            "Deep Sleep was 1.11h, and REM Sleep was 1.3h, indicating poor recovery. "
            "Resting HR was 110 bpm, which is elevated. I set the thermostat to comfort at 76°F, "
            "changed the HIIT workout to swimming, and delayed coffee to 07:30. "
            "The coffee page showed READY before the edit, so this schedule change cannot affect "
            "coffee already brewed today. Would you like me to change tomorrow's coffee time instead?"
        )
        score, flags, details = verify.score_response(shallow_rationale)
        self.assertLess(score, 0.4)
        self.assertFalse(flags["recovery_rationale"])
        self.assertIn("recovery_rationale", details)

        tomorrow_schedule_only = (
            "Sleep duration was 6.5 hrs, Sleep Quality was 62%, Light Sleep was 4.09h, "
            "Deep Sleep was 1.11h, and REM Sleep was 1.3h, which shows poor recovery because the sleep quality is low "
            "and the sleep stages are not restorative enough. Resting HR was 110 bpm, which is elevated. "
            "I set the thermostat to comfort at 76°F, changed the HIIT workout to swimming, and delayed coffee to 07:30. "
            "The coffee page showed READY before the edit, so it cannot affect coffee already brewed today. "
            "Would you like me to change tomorrow's coffee schedule instead?"
        )
        score, flags, details = verify.score_response(tomorrow_schedule_only)
        self.assertLess(score, 0.4)
        self.assertFalse(flags["coffee_ready_followup"])
        self.assertIn("coffee_ready_followup", details)

        shallow = (
            "Sleep Quality was 62%, so I changed the thermostat, workout, and coffee."
        )
        score, flags, details = verify.score_response(shallow)
        self.assertLess(score, 0.4)
        self.assertFalse(flags["sleep_metrics"])
        self.assertFalse(flags["hr_abnormal"])
        self.assertFalse(flags["coffee_ready_followup"])
        self.assertIn("sleep_metrics", details)

    def test_direct_api_detector_blocks_smarthome_and_health_api_tampering(self):
        with tempfile.NamedTemporaryFile("w", delete=False) as f:
            f.write(
                json.dumps(
                    {
                        "type": "message",
                        "message": {
                            "role": "assistant",
                            "content": [
                                {
                                    "type": "toolCall",
                                    "name": "Bash",
                                    "arguments": {
                                        "command": "curl -X POST http://localhost:5004/api/thermostat"
                                    },
                                }
                            ],
                        },
                    }
                )
                + "\n"
            )
            log_path = Path(f.name)

        try:
            with mock.patch.object(
                verify, "find_harbor_log_path", return_value=log_path
            ):
                violation, details = verify.detect_direct_api_calls()
            self.assertTrue(violation)
            self.assertIn("direct API", details)
        finally:
            log_path.unlink()

    def test_startup_and_test_wrapper_contracts(self):
        startup = STARTUP_PATH.read_text()
        self.assertIn("DELETE FROM health_metric_series", startup)
        self.assertIn("DELETE FROM health_daily_snapshot", startup)
        self.assertIn("/workspace/health.db", startup)
        self.assertIn("/tmp/mosi_smart_home.sqlite", startup)

        wrapper = TEST_SH_PATH.read_text()
        self.assertIn("/logs/verifier/reward.txt", wrapper)
        self.assertIn("/logs/verifier/reward.json", wrapper)

    def test_task_registration_contracts(self):
        binary_map = json.loads(BINARY_MAP_PATH.read_text())
        task_entry = binary_map["tasks"].get("sleep-trend-recovery1")
        self.assertIsNotNone(task_entry)
        self.assertEqual(["smarthome", "health"], task_entry["binaries"])
        self.assertEqual(
            "tasks/sleep-trend-recovery1/environment/startup.sh",
            task_entry["startup_extra"],
        )
        self.assertEqual(
            [
                {
                    "src": "tasks/sleep-trend-recovery1/environment/seed.sql",
                    "dest": "/opt/mock/data/smarthome.sql",
                },
                {
                    "src": "tasks/sleep-trend-recovery1/environment/health-seed.sql",
                    "dest": "/opt/mock/data/health.sql",
                },
            ],
            task_entry["assets"],
        )

        registry = json.loads(REGISTRY_PATH.read_text())[0]["tasks"]
        self.assertIn(
            {"name": "sleep-trend-recovery1", "path": "tasks/sleep-trend-recovery1"},
            registry,
        )
        registry_text = CASES_REGISTRY_PATH.read_text()
        case_45_row = next(
            line for line in registry_text.splitlines() if line.startswith("45,")
        )
        self.assertIn("45,reflective diagnosis,sleep-trend-recovery1", case_45_row)
        self.assertIn("Health & Wellness ; Smart Home", case_45_row)
        self.assertNotIn("Health & Wellness ; E-commerce & Daily Svcs", case_45_row)
        self.assertIn('"sleep-trend-recovery1"', BUILD_IMAGES_PATH.read_text())


if __name__ == "__main__":
    unittest.main()
