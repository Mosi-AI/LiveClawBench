import importlib.util
import json
import sqlite3
import tempfile
import tomllib
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
SOLUTION_PATH = TASK_DIR / "solution" / "solve.sh"
BINARY_MAP_PATH = REPO_ROOT / "mock-platform" / "config" / "task-binary-map.json"
REGISTRY_PATH = REPO_ROOT / "registry.json"
CASES_REGISTRY_PATH = REPO_ROOT / "docs" / "metadata" / "cases_registry.csv"
CASES_REGISTRY_ZH_PATH = REPO_ROOT / "docs" / "metadata" / "cases_registry_zh.csv"
BUILD_IMAGES_PATH = REPO_ROOT / "mock-platform" / "scripts" / "build-task-images.ts"
TASK_TOML_PATH = TASK_DIR / "task.toml"

spec = importlib.util.spec_from_file_location(
    "sleep_trend_recovery_verify", VERIFY_PATH
)
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class SleepTrendRecoveryVerifierContractTests(unittest.TestCase):
    def _make_workout_conn(self):
        conn = sqlite3.connect(":memory:")
        conn.executescript(
            """
            CREATE TABLE calendar_event (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                start_time TEXT NOT NULL,
                event_type TEXT,
                workout_type TEXT,
                status TEXT,
                updated_at TEXT
            );
            """
        )
        return conn

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
            CREATE TABLE wearable_recovery_state (
                id INTEGER PRIMARY KEY,
                sleep_hours REAL NOT NULL,
                sleep_score REAL NOT NULL,
                readiness REAL NOT NULL,
                resting_heart_rate REAL NOT NULL
            );
            CREATE TABLE user_constraints (
                id INTEGER PRIMARY KEY,
                calorie_target REAL NOT NULL,
                macro_targets TEXT NOT NULL,
                allergy_constraints TEXT NOT NULL,
                weekly_budget_limit REAL NOT NULL
            );
            CREATE TABLE recipe (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                meal_type TEXT NOT NULL,
                ingredients TEXT NOT NULL,
                calories_total REAL NOT NULL,
                allergens TEXT
            );
            CREATE TABLE meal_plan (
                id INTEGER PRIMARY KEY,
                plan_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                plan_data TEXT NOT NULL
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

    def test_smarthome_seed_populates_wearable_data_aligned_with_health_outlier(self):
        health_conn = sqlite3.connect(":memory:")
        health_conn.executescript(
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
        health_conn.executescript(HEALTH_SEED_PATH.read_text())
        snapshot = health_conn.execute(
            """
            SELECT sleep_hours, sleep_quality, total_activity_min, resting_heart_rate_bpm
            FROM health_daily_snapshot
            WHERE user_id = 1 AND date = '2026-05-09'
            """
        ).fetchone()
        self.assertEqual((6.5, 62.0, 29.0, 110), snapshot)

        smarthome_conn = sqlite3.connect(":memory:")
        smarthome_conn.executescript(
            """
            CREATE TABLE benchmark_clock (
                id INTEGER PRIMARY KEY,
                clock_time TEXT NOT NULL
            );
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
            CREATE TABLE wearable_recovery_state (
                id INTEGER PRIMARY KEY,
                sleep_hours REAL NOT NULL,
                sleep_score REAL NOT NULL,
                readiness REAL NOT NULL,
                resting_heart_rate REAL NOT NULL
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
            CREATE TABLE user_constraints (
                id INTEGER PRIMARY KEY,
                calorie_target REAL NOT NULL,
                macro_targets TEXT NOT NULL,
                allergy_constraints TEXT NOT NULL,
                weekly_budget_limit REAL NOT NULL
            );
            CREATE TABLE recipe (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                meal_type TEXT NOT NULL,
                ingredients TEXT NOT NULL,
                calories_total REAL NOT NULL,
                allergens TEXT
            );
            CREATE TABLE meal_plan (
                id INTEGER PRIMARY KEY,
                plan_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                plan_data TEXT NOT NULL
            );
            """
        )
        smarthome_conn.executescript(SMARTHOME_SEED_PATH.read_text())

        wearable = smarthome_conn.execute(
            """
            SELECT sleep_hours, sleep_score, readiness, resting_heart_rate
            FROM wearable_recovery_state
            WHERE id = 1
            """
        ).fetchone()
        self.assertEqual((6.5, 62.0, 34.0, 110.0), wearable)

    def test_smarthome_seed_populates_meal_plan_page_dependencies(self):
        conn = sqlite3.connect(":memory:")
        conn.executescript(
            """
            CREATE TABLE benchmark_clock (
                id INTEGER PRIMARY KEY,
                clock_time TEXT NOT NULL
            );
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
            CREATE TABLE wearable_recovery_state (
                id INTEGER PRIMARY KEY,
                sleep_hours REAL NOT NULL,
                sleep_score REAL NOT NULL,
                readiness REAL NOT NULL,
                resting_heart_rate REAL NOT NULL
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
            CREATE TABLE user_constraints (
                id INTEGER PRIMARY KEY,
                calorie_target REAL NOT NULL,
                macro_targets TEXT NOT NULL,
                allergy_constraints TEXT NOT NULL,
                weekly_budget_limit REAL NOT NULL
            );
            CREATE TABLE recipe (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                meal_type TEXT NOT NULL,
                ingredients TEXT NOT NULL,
                calories_total REAL NOT NULL,
                allergens TEXT
            );
            """
        )
        conn.executescript(SMARTHOME_SEED_PATH.read_text())

        constraints = conn.execute(
            """
            SELECT calorie_target, macro_targets, allergy_constraints, weekly_budget_limit
            FROM user_constraints
            WHERE id = 1
            """
        ).fetchone()
        self.assertEqual(
            (2000.0, '{"protein": 150, "carbs": 250, "fat": 65}', '["shellfish"]', 150.0),
            constraints,
        )

        recipe_rows = conn.execute(
            "SELECT meal_type, COUNT(*) FROM recipe GROUP BY meal_type ORDER BY meal_type"
        ).fetchall()
        self.assertEqual(
            [("breakfast", 3), ("dinner", 4), ("lunch", 3)],
            recipe_rows,
        )

    def test_check_workout_allows_renamed_recovery_workout_at_original_time(self):
        conn = self._make_workout_conn()
        conn.execute(
            """
            INSERT INTO calendar_event (
                id, title, start_time, event_type, workout_type, status, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                1,
                "Recovery Swim",
                "2026-05-09T09:00:00Z",
                "workout",
                "swimming",
                "undone",
                "2026-05-09T07:45:00Z",
            ),
        )

        passed, detail = verify.check_workout(conn)
        self.assertTrue(passed)
        self.assertEqual("title=Recovery Swim, workout_type=swimming", detail)

    def test_check_workout_rejects_multiple_workouts_at_original_time(self):
        conn = self._make_workout_conn()
        conn.executemany(
            """
            INSERT INTO calendar_event (
                id, title, start_time, event_type, workout_type, status, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    1,
                    "Recovery Walk",
                    "2026-05-09T09:00:00Z",
                    "workout",
                    "walking",
                    "undone",
                    "2026-05-09T07:45:00Z",
                ),
                (
                    2,
                    "Recovery Yoga",
                    "2026-05-09T09:00:00Z",
                    "workout",
                    "yoga",
                    "undone",
                    "2026-05-09T07:45:00Z",
                ),
            ],
        )

        passed, detail = verify.check_workout(conn)
        self.assertFalse(passed)
        self.assertEqual(
            "Expected exactly one benchmark workout at 2026-05-09T09:00:00Z, found 2",
            detail,
        )

    def test_response_scoring_requires_sleep_metrics_recovery_rationale_hr_and_coffee_ready_discovery(
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
        self.assertTrue(flags["coffee_ready_discovery"])
        self.assertTrue(flags["coffee_tomorrow_followup"])
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
        self.assertTrue(flags["coffee_ready_discovery"])
        self.assertTrue(flags["coffee_tomorrow_followup"])
        self.assertIn("actions_confirmed", details)

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

        discovery_only = (
            "Sleep duration was 6.5 hrs, Sleep Quality was 62%, Light Sleep was 4.09h, "
            "Deep Sleep was 1.11h, and REM Sleep was 1.3h, which shows poor recovery because the sleep quality is low "
            "and the sleep stages are not restorative enough. Resting HR was 110 bpm, which is elevated. "
            "I set the thermostat to comfort at 76°F, changed the HIIT workout to swimming, and delayed coffee to 07:30. "
            "The coffee page showed READY before the edit, so this schedule change cannot affect coffee already brewed today."
        )
        score, flags, details = verify.score_response(discovery_only)
        self.assertEqual(0.35, score)
        self.assertTrue(flags["coffee_ready_discovery"])
        self.assertFalse(flags["coffee_tomorrow_followup"])
        self.assertIn("coffee_tomorrow_followup", details)

        tomorrow_schedule_only = (
            "Sleep duration was 6.5 hrs, Sleep Quality was 62%, Light Sleep was 4.09h, "
            "Deep Sleep was 1.11h, and REM Sleep was 1.3h, which shows poor recovery because the sleep quality is low "
            "and the sleep stages are not restorative enough. Resting HR was 110 bpm, which is elevated. "
            "I set the thermostat to comfort at 76°F, changed the HIIT workout to swimming, and delayed coffee to 07:30. "
            "The coffee page showed READY before the edit, so it cannot affect coffee already brewed today. "
            "Would you like me to change tomorrow's coffee schedule instead?"
        )
        score, flags, details = verify.score_response(tomorrow_schedule_only)
        self.assertEqual(0.4, score)
        self.assertTrue(flags["coffee_ready_discovery"])
        self.assertTrue(flags["coffee_tomorrow_followup"])
        self.assertEqual({}, details)

        shallow = (
            "Sleep Quality was 62%, so I changed the thermostat, workout, and coffee."
        )
        score, flags, details = verify.score_response(shallow)
        self.assertLess(score, 0.4)
        self.assertFalse(flags["sleep_metrics"])
        self.assertFalse(flags["hr_abnormal"])
        self.assertFalse(flags["coffee_ready_discovery"])
        self.assertFalse(flags["coffee_tomorrow_followup"])
        self.assertIn("sleep_metrics", details)

    def test_reference_solution_response_satisfies_required_response_contract(self):
        solve_text = SOLUTION_PATH.read_text()
        response = solve_text.split(
            "cat > /workspace/output/response.txt <<'EOF'\n", 1
        )[1].split("\nEOF", 1)[0]

        score, flags, details = verify.score_response(response)
        self.assertEqual(0.4, score)
        self.assertTrue(flags["sleep_metrics"])
        self.assertTrue(flags["recovery_rationale"])
        self.assertTrue(flags["hr_abnormal"])
        self.assertTrue(flags["coffee_ready_discovery"])
        self.assertTrue(flags["coffee_tomorrow_followup"])
        self.assertEqual({}, details)

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

    def test_get_agent_response_aggregates_all_assistant_messages_from_harbor_log(self):
        with tempfile.NamedTemporaryFile("w", delete=False) as f:
            f.write(
                json.dumps(
                    {
                        "type": "message",
                        "message": {
                            "role": "assistant",
                            "content": "Sleep duration was 6.5 hrs and Sleep Quality was 62%.",
                        },
                    }
                )
                + "\n"
            )
            f.write(
                json.dumps(
                    {
                        "type": "message",
                        "message": {
                            "role": "assistant",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "Resting HR was 110 bpm and elevated.",
                                }
                            ],
                        },
                    }
                )
                + "\n"
            )
            f.write(
                json.dumps(
                    {
                        "type": "message",
                        "message": {
                            "role": "assistant",
                            "content": "The coffee page showed READY before the edit, so this schedule change cannot affect coffee already brewed today.",
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
                response = verify.get_agent_response()
            self.assertEqual(
                "Sleep duration was 6.5 hrs and Sleep Quality was 62%. Resting HR was 110 bpm and elevated. The coffee page showed READY before the edit, so this schedule change cannot affect coffee already brewed today.",
                response,
            )
        finally:
            log_path.unlink()

    def test_get_agent_response_prefers_harbor_aggregate_over_response_txt(self):
        with tempfile.NamedTemporaryFile("w", delete=False) as f:
            f.write(
                json.dumps(
                    {
                        "type": "message",
                        "message": {
                            "role": "assistant",
                            "content": "aggregated harbor response",
                        },
                    }
                )
                + "\n"
            )
            log_path = Path(f.name)

        try:
            with mock.patch.object(
                verify, "find_harbor_log_path", return_value=log_path
            ), mock.patch.object(
                verify.Path, "exists", return_value=True
            ), mock.patch.object(
                verify.Path, "read_text", return_value="response.txt fallback"
            ):
                response = verify.get_agent_response()
            self.assertEqual("aggregated harbor response", response)
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
        metadata = tomllib.loads(TASK_TOML_PATH.read_text())["metadata"]
        self.assertEqual(["Health & Wellness", "Smart Home"], metadata["domains_multi"])

        registry_text = CASES_REGISTRY_PATH.read_text()
        case_row = next(
            line
            for line in registry_text.splitlines()
            if ",sleep-trend-recovery1," in line
        )
        self.assertIn("reflective diagnosis,sleep-trend-recovery1", case_row)
        self.assertIn("Health & Wellness ; Smart Home", case_row)
        self.assertNotIn("Health & Wellness ; E-commerce & Daily Svcs", case_row)

        registry_zh_text = CASES_REGISTRY_ZH_PATH.read_text()
        case_zh_row = next(
            line
            for line in registry_zh_text.splitlines()
            if ",sleep-trend-recovery1," in line
        )
        self.assertIn("reflective diagnosis,sleep-trend-recovery1", case_zh_row)
        self.assertIn("Health & Wellness ; Smart Home", case_zh_row)
        self.assertNotIn(
            "Health & Wellness ; E-commerce & Daily Svcs", case_zh_row
        )
        self.assertIn('"sleep-trend-recovery1"', BUILD_IMAGES_PATH.read_text())


if __name__ == "__main__":
    unittest.main()
