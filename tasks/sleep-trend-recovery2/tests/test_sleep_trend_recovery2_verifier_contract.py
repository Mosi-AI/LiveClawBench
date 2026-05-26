import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib

TASK_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = TASK_DIR.parent.parent
VERIFY_PATH = TASK_DIR / "tests" / "verify.py"
TEST_SH_PATH = TASK_DIR / "tests" / "test.sh"
DOCKERFILE_PATH = TASK_DIR / "environment" / "Dockerfile"
HEALTH_SEED_PATH = TASK_DIR / "environment" / "health-seed.sql"
SMARTHOME_SEED_PATH = TASK_DIR / "environment" / "seed.sql"
STARTUP_PATH = TASK_DIR / "environment" / "startup.sh"
SOLUTION_PATH = TASK_DIR / "solution" / "solve.sh"
TASK_TOML_PATH = TASK_DIR / "task.toml"
BINARY_MAP_PATH = REPO_ROOT / "mock-platform" / "config" / "task-binary-map.json"
REGISTRY_PATH = REPO_ROOT / "registry.json"
CASES_REGISTRY_PATH = REPO_ROOT / "docs" / "metadata" / "cases_registry.csv"
CASES_REGISTRY_ZH_PATH = REPO_ROOT / "docs" / "metadata" / "cases_registry_zh.csv"
BUILD_IMAGES_PATH = REPO_ROOT / "mock-platform" / "scripts" / "build-task-images.ts"

spec = importlib.util.spec_from_file_location(
    "sleep_trend_recovery2_verify", VERIFY_PATH
)
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class SleepTrendRecovery2VerifierContractTests(unittest.TestCase):
    def _health_schema_conn(self):
        conn = sqlite3.connect(":memory:")
        conn.executescript(
            """
            CREATE TABLE mock_user (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                display_name TEXT,
                created_at TEXT
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
        return conn

    def _smarthome_schema_conn(self):
        conn = sqlite3.connect(":memory:")
        conn.executescript(
            """
            CREATE TABLE thermostat_settings (
                id INTEGER PRIMARY KEY,
                mode TEXT NOT NULL,
                temperature REAL NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE coffee_schedule (
                schedule_date TEXT PRIMARY KEY,
                start_time TEXT NOT NULL,
                beans_grams INTEGER DEFAULT 20,
                cancelled INTEGER DEFAULT 0,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE benchmark_clock (
                id INTEGER PRIMARY KEY,
                clock_time TEXT NOT NULL
            );
            CREATE TABLE room_metrics (
                id INTEGER PRIMARY KEY,
                temperature REAL NOT NULL,
                humidity REAL NOT NULL,
                unit_temp TEXT NOT NULL,
                noise REAL,
                light REAL,
                air_quality REAL
            );
            CREATE TABLE room (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
            );
            CREATE TABLE inventory_item (
                id INTEGER PRIMARY KEY,
                item_name TEXT NOT NULL,
                quantity REAL NOT NULL,
                unit TEXT NOT NULL,
                location TEXT NOT NULL,
                expiry_date TEXT,
                category TEXT,
                updated_at TEXT
            );
            CREATE TABLE grocery_product (
                product_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                quantity REAL NOT NULL,
                unit TEXT NOT NULL,
                stock_status TEXT NOT NULL,
                substitute_for TEXT,
                reference TEXT
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
                workout_type TEXT CHECK (workout_type IN ('hiit', 'yoga', 'walking', 'cycling', 'strength', 'swimming', 'rest') OR workout_type IS NULL),
                status TEXT NOT NULL DEFAULT 'undone',
                updated_at TEXT NOT NULL
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
        return conn

    def test_health_seed_encodes_sleep_quality_drop_and_companion_metrics(self):
        conn = self._health_schema_conn()
        conn.executescript(HEALTH_SEED_PATH.read_text())

        current_date = conn.execute(
            "SELECT value FROM system_config WHERE key = 'current_date'"
        ).fetchone()[0]
        self.assertEqual("2026-05-09", current_date)

        recent = conn.execute(
            """
            SELECT date, sleep_quality
            FROM health_daily_snapshot
            WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
            ORDER BY date
            """
        ).fetchall()
        self.assertEqual(
            [
                ("2026-05-03", 82.0),
                ("2026-05-04", 79.0),
                ("2026-05-05", 81.0),
                ("2026-05-06", 78.0),
                ("2026-05-07", 80.0),
                ("2026-05-08", 83.0),
                ("2026-05-09", 52.0),
            ],
            recent,
        )
        prior_avg = sum(value for _, value in recent[:6]) / 6
        self.assertEqual(80.5, prior_avg)
        self.assertEqual(28.5, prior_avg - recent[-1][1])

        counts = dict(
            conn.execute(
                """
                SELECT metric_type, COUNT(*)
                FROM health_metric_series
                WHERE user_id = 1
                  AND date BETWEEN '2026-05-03' AND '2026-05-09'
                  AND metric_type IN ('sleep_hours', 'light_sleep_hours', 'deep_sleep_hours', 'rem_sleep_hours')
                GROUP BY metric_type
                """
            ).fetchall()
        )
        self.assertEqual(
            {
                "sleep_hours": 7,
                "light_sleep_hours": 7,
                "deep_sleep_hours": 7,
                "rem_sleep_hours": 7,
            },
            counts,
        )

    def test_health_seed_makes_today_activity_look_partially_counted(self):
        conn = self._health_schema_conn()
        conn.executescript(HEALTH_SEED_PATH.read_text())

        today_steps, today_active_energy = conn.execute(
            """
            SELECT steps, active_energy_kcal
            FROM health_daily_snapshot
            WHERE user_id = 1 AND date = '2026-05-09'
            """
        ).fetchone()

        self.assertEqual(1250, today_steps)
        self.assertEqual(48.0, today_active_energy)

    def test_instruction_does_not_disclose_task_dates(self):
        instruction = (TASK_DIR / "instruction.md").read_text()

        self.assertNotIn("2026-05-09", instruction)
        self.assertNotIn("2026-05-10", instruction)
        self.assertIn("tomorrow's schedule", instruction)

    def test_smarthome_seed_sets_multiple_high_intensity_targets_and_zeroed_wearable_row(
        self,
    ):
        conn = self._smarthome_schema_conn()
        conn.executescript(SMARTHOME_SEED_PATH.read_text())

        self.assertEqual(
            "2026-05-09T07:45:00Z",
            conn.execute(
                "SELECT clock_time FROM benchmark_clock WHERE id = 1"
            ).fetchone()[0],
        )
        self.assertEqual(
            ("07:00", 0),
            conn.execute(
                "SELECT start_time, cancelled FROM coffee_schedule WHERE schedule_date = '2026-05-09'"
            ).fetchone(),
        )
        self.assertEqual(
            ("07:00", 0),
            conn.execute(
                "SELECT start_time, cancelled FROM coffee_schedule WHERE schedule_date = '2026-05-10'"
            ).fetchone(),
        )
        self.assertEqual(
            ("HIIT Workout", "2026-05-10T12:00:00Z", "workout", "hiit"),
            conn.execute(
                """
                SELECT title, start_time, event_type, workout_type
                FROM calendar_event
                WHERE id = 3
                """
            ).fetchone(),
        )
        self.assertEqual(
            ("Sprint Intervals", "2026-05-10T17:30:00Z", "workout", "hiit"),
            conn.execute(
                """
                SELECT title, start_time, event_type, workout_type
                FROM calendar_event
                WHERE id = 6
                """
            ).fetchone(),
        )
        self.assertEqual(
            ("Boxing Conditioning", "2026-05-10T19:00:00Z", "workout", "strength"),
            conn.execute(
                """
                SELECT title, start_time, event_type, workout_type
                FROM calendar_event
                WHERE id = 7
                """
            ).fetchone(),
        )
        self.assertEqual(
            ("Team Meeting", "2026-05-10T14:00:00Z", "meeting", None),
            conn.execute(
                """
                SELECT title, start_time, event_type, workout_type
                FROM calendar_event
                WHERE id = 4
                """
            ).fetchone(),
        )
        self.assertEqual(
            (1, 0.0, 0.0, 0.0, 0.0),
            conn.execute(
                """
                SELECT id, sleep_hours, sleep_score, readiness, resting_heart_rate
                FROM wearable_recovery_state
                """
            ).fetchone(),
        )

    def test_smarthome_seed_has_realistic_comfort_inventory_and_coffee_beans(self):
        conn = self._smarthome_schema_conn()
        conn.executescript(SMARTHOME_SEED_PATH.read_text())

        items = conn.execute(
            """
            SELECT item_name, quantity, unit, location, expiry_date, category
            FROM inventory_item
            ORDER BY id
            """
        ).fetchall()

        self.assertGreaterEqual(len(items), 10)
        self.assertIn(
            (
                "Ethiopian Yirgacheffe Coffee Beans",
                220.0,
                "grams",
                "pantry",
                "2026-09-30",
                "coffee",
            ),
            items,
        )
        self.assertIn(
            (
                "Chamomile Tea",
                18.0,
                "bags",
                "pantry",
                "2027-01-15",
                "beverage",
            ),
            items,
        )
        self.assertIn(
            (
                "Electrolyte Tablets",
                6.0,
                "tablets",
                "pantry",
                "2026-08-01",
                "recovery",
            ),
            items,
        )

        valid_coffee_grams = conn.execute(
            """
            SELECT SUM(quantity)
            FROM inventory_item
            WHERE category = 'coffee'
              AND unit = 'grams'
              AND expiry_date > '2026-05-10'
            """
        ).fetchone()[0]
        self.assertGreaterEqual(valid_coffee_grams, 20.0)

        comfort_categories = {
            row[0]
            for row in conn.execute(
                "SELECT DISTINCT category FROM inventory_item WHERE category IS NOT NULL"
            )
        }
        self.assertTrue(
            {"recovery", "beverage", "breakfast", "protein", "produce"}.issubset(
                comfort_categories
            )
        )

        visible_locations = {"fridge", "pantry"}
        hidden_items = [
            f"{item_name}:{location}"
            for item_name, _quantity, _unit, location, _expiry_date, _category in items
            if location not in visible_locations
        ]
        self.assertEqual([], hidden_items)

    def test_zero_work_branch_scores_keep_partial_credit_without_hard_gate(self):
        health_conn = self._health_schema_conn()
        health_conn.executescript(HEALTH_SEED_PATH.read_text())
        smarthome_conn = self._smarthome_schema_conn()
        smarthome_conn.executescript(SMARTHOME_SEED_PATH.read_text())

        health = verify.read_health_signal(health_conn)
        results = verify.score_state(smarthome_conn)
        response_score, response_details = verify.score_response("", health)
        reward, gate_details = verify.canonical_reward(
            results, response_score, seeded_action_branch=True
        )

        self.assertEqual(0.10, reward)
        self.assertEqual(0.0, results["hiit_action"])
        self.assertEqual(0.10, results["today_coffee"])
        self.assertEqual(0.0, results["tomorrow_coffee"])
        self.assertFalse(results["required_gates_passed"])
        self.assertEqual(0.0, results["protected_penalty"])
        self.assertEqual(0.0, response_score)
        self.assertIn("no protected penalty", gate_details.lower())
        self.assertIn("sleep_comparison", response_details)

    def test_high_intensity_actions_require_processing_all_tomorrow_workouts(self):
        conn = self._smarthome_schema_conn()
        conn.executescript(SMARTHOME_SEED_PATH.read_text())
        conn.execute(
            "UPDATE calendar_event SET title = 'Recovery Yoga', workout_type = 'yoga' WHERE id = 3"
        )

        score, detail = verify.score_high_intensity_actions(conn)

        self.assertEqual(0.0, score)
        self.assertIn("unprocessed", detail.lower())
        self.assertIn("6", detail)

    def test_protected_state_fails_if_today_schedule_changes(self):
        conn = self._smarthome_schema_conn()
        conn.executescript(SMARTHOME_SEED_PATH.read_text())
        conn.execute("UPDATE calendar_event SET title = 'Today Tempo Run' WHERE id = 2")

        protected_pass, detail = verify.check_protected_smarthome_state(conn)
        state_scores = verify.score_state(conn)

        self.assertFalse(protected_pass)
        self.assertIn("protected event 2 changed", detail)
        self.assertEqual(0.0, state_scores["protected_state"])
        self.assertEqual(0.15, state_scores["protected_penalty"])
        self.assertEqual(0.0, state_scores["protected_calendar_state"])
        self.assertEqual(1.0, state_scores["protected_coffee_state"])
        self.assertFalse(state_scores["required_gates_passed"])

    def test_protected_state_fails_if_historical_coffee_schedule_changes(self):
        conn = self._smarthome_schema_conn()
        conn.executescript(SMARTHOME_SEED_PATH.read_text())
        conn.execute(
            "UPDATE coffee_schedule SET start_time = '06:45' WHERE schedule_date = '2026-05-08'"
        )

        protected_pass, detail = verify.check_protected_smarthome_state(conn)
        state_scores = verify.score_state(conn)

        self.assertFalse(protected_pass)
        self.assertIn("protected coffee schedule changed", detail)
        self.assertEqual(0.0, state_scores["protected_state"])
        self.assertEqual(0.15, state_scores["protected_penalty"])
        self.assertEqual(1.0, state_scores["protected_calendar_state"])
        self.assertEqual(0.0, state_scores["protected_coffee_state"])
        self.assertFalse(state_scores["required_gates_passed"])

    def test_high_intensity_actions_pass_after_all_tomorrow_workouts_are_downgraded(
        self,
    ):
        conn = self._smarthome_schema_conn()
        conn.executescript(SMARTHOME_SEED_PATH.read_text())
        conn.execute(
            "UPDATE calendar_event SET title = 'Recovery Yoga', workout_type = 'yoga' WHERE id = 3"
        )
        conn.execute(
            "UPDATE calendar_event SET title = 'Zone 2 Walk', workout_type = 'walking' WHERE id = 6"
        )
        conn.execute(
            "UPDATE calendar_event SET title = 'Mobility Session', workout_type = 'cycling' WHERE id = 7"
        )

        score, detail = verify.score_high_intensity_actions(conn)

        self.assertEqual(0.25, score)
        self.assertIn("all high-intensity workouts handled", detail.lower())

    def test_missing_tomorrow_coffee_delay_keeps_partial_credit_without_hard_gate(self):
        conn = self._smarthome_schema_conn()
        conn.executescript(SMARTHOME_SEED_PATH.read_text())
        conn.execute(
            "UPDATE calendar_event SET title = 'Recovery Yoga', workout_type = 'yoga' WHERE id = 3"
        )
        conn.execute(
            "UPDATE calendar_event SET title = 'Zone 2 Walk', workout_type = 'walking' WHERE id = 6"
        )
        conn.execute(
            "UPDATE calendar_event SET title = 'Mobility Session', workout_type = 'cycling' WHERE id = 7"
        )

        state_scores = verify.score_state(conn)
        reward, gate_details = verify.canonical_reward(
            state_scores, response_score=0.45, seeded_action_branch=True
        )

        self.assertEqual(0.25, state_scores["hiit_action"])
        self.assertEqual(0.10, state_scores["today_coffee"])
        self.assertEqual(0.0, state_scores["tomorrow_coffee"])
        self.assertFalse(state_scores["required_gates_passed"])
        self.assertEqual(0.80, reward)
        self.assertEqual("no protected penalty", gate_details)

    def test_protected_calendar_and_coffee_failures_each_deduct_fifteen_points(self):
        conn = self._smarthome_schema_conn()
        conn.executescript(SMARTHOME_SEED_PATH.read_text())
        conn.execute(
            "UPDATE coffee_schedule SET start_time = '08:30', cancelled = 0 WHERE schedule_date = '2026-05-10'"
        )
        conn.execute(
            "UPDATE calendar_event SET title = 'Recovery Yoga', workout_type = 'yoga' WHERE id = 3"
        )
        conn.execute(
            "UPDATE calendar_event SET title = 'Zone 2 Walk', workout_type = 'walking' WHERE id = 6"
        )
        conn.execute(
            "UPDATE calendar_event SET title = 'Easy Cycling', workout_type = 'cycling' WHERE id = 7"
        )
        conn.execute(
            "UPDATE calendar_event SET start_time = '2026-05-10T10:00:00Z' WHERE id = 5"
        )
        conn.execute(
            "UPDATE coffee_schedule SET start_time = '06:45' WHERE schedule_date = '2026-05-08'"
        )

        state_scores = verify.score_state(conn)
        reward, gate_details = verify.canonical_reward(
            state_scores, response_score=0.45, seeded_action_branch=True
        )

        self.assertEqual(1.0, state_scores["raw_positive_score"] + 0.45)
        self.assertEqual(0.30, state_scores["protected_penalty"])
        self.assertEqual(0.70, reward)
        self.assertIn("protected penalty applied: 0.30", gate_details)

    def test_protected_state_allows_replacing_tomorrow_workouts_with_equivalent_rows(
        self,
    ):
        conn = self._smarthome_schema_conn()
        conn.executescript(SMARTHOME_SEED_PATH.read_text())
        conn.execute("DELETE FROM calendar_event WHERE id IN (3, 6, 7)")
        conn.executescript(
            """
            INSERT INTO calendar_event (id, title, start_time, event_type, workout_type, status, updated_at) VALUES
            (8, 'Recovery Yoga', '2026-05-10T12:00:00Z', 'workout', 'yoga', 'undone', '2026-05-08T20:00:00Z'),
            (9, 'Zone 2 Walk', '2026-05-10T17:30:00Z', 'workout', 'walking', 'undone', '2026-05-08T20:00:00Z'),
            (10, 'Easy Cycling', '2026-05-10T19:00:00Z', 'workout', 'cycling', 'undone', '2026-05-08T20:00:00Z');
            """
        )

        protected_pass, detail = verify.check_protected_smarthome_state(conn)
        hiit_score, hiit_detail = verify.score_high_intensity_actions(conn)

        self.assertTrue(protected_pass, detail)
        self.assertEqual("protected events unchanged", detail)
        self.assertEqual(0.25, hiit_score)
        self.assertIn("all high-intensity workouts handled", hiit_detail.lower())

    def test_oracle_state_and_response_score_full_reward(self):
        health_conn = self._health_schema_conn()
        health_conn.executescript(HEALTH_SEED_PATH.read_text())
        smarthome_conn = self._smarthome_schema_conn()
        smarthome_conn.executescript(SMARTHOME_SEED_PATH.read_text())
        smarthome_conn.execute(
            "UPDATE coffee_schedule SET start_time = '08:30', cancelled = 0 WHERE schedule_date = '2026-05-10'"
        )
        smarthome_conn.execute(
            "UPDATE calendar_event SET workout_type = 'yoga', title = 'Recovery Yoga' WHERE id = 3"
        )
        smarthome_conn.execute(
            "UPDATE calendar_event SET workout_type = 'walking', title = 'Zone 2 Walk' WHERE id = 6"
        )
        smarthome_conn.execute(
            "UPDATE calendar_event SET workout_type = 'cycling', title = 'Easy Cycling' WHERE id = 7"
        )

        health = verify.read_health_signal(health_conn)
        response = (
            "Today's Sleep Quality was 52, compared with a usual six-day average of 80.5, "
            "a drop of 28.5 points. The 7-day sleep trend is clearly falling, which correctly reflects "
            "last night's poor sleep. The 14-day and 30-day trends still look stable because those longer "
            "windows smooth out a single bad night and cannot fully represent yesterday's recovery dip. "
            "Sleep Duration fell to 5.4 hours, Light Sleep dominated while Deep Sleep and REM Sleep were lower, "
            "so the companion sleep metrics also point to poor recovery. I changed tomorrow's 12:00 HIIT Workout "
            "to Recovery Yoga, downgraded the 17:30 Sprint Intervals to a walk, and replaced the 19:00 Boxing "
            "Conditioning session with easy cycling because the sleep drop suggests avoiding all high-intensity exercise. "
            "I left today's 07:00 coffee unchanged and delayed tomorrow's coffee from 07:00 to 08:30, which still gives "
            "a 30-minute brew window before the 09:00 Online Daily Sync. The smart-home Wearable & Recovery page shows today's "
            "date but all the values are 0, so it has not been synced with the health data yet and should not be trusted."
        )
        results = verify.score_state(smarthome_conn)
        response_score, response_details = verify.score_response(response, health)
        reward, gate_details = verify.canonical_reward(
            results, response_score, seeded_action_branch=True
        )

        self.assertEqual(1.0, reward)
        self.assertEqual(0.45, response_score)
        self.assertTrue(results["required_gates_passed"])
        self.assertEqual("no protected penalty", gate_details)
        self.assertEqual({}, response_details)

    def test_reward_json_payload_uses_numeric_values_except_meta_strings(self):
        payload = verify.build_reward_payload(
            reward=1.0,
            state_scores={
                "hiit_action": 0.25,
                "today_coffee": 0.10,
                "tomorrow_coffee": 0.2,
                "protected_state": 1.0,
                "protected_penalty": 0.0,
                "required_gates_passed": True,
            },
            response_score=0.45,
            raw_weighted_total=1.0,
            meta={"summary": "ok"},
        )

        self.assertEqual(1.0, payload["reward"])
        for key, value in payload.items():
            if key.startswith("_meta_"):
                continue
            self.assertIsInstance(value, (int, float), key)

    def test_reference_solution_response_satisfies_response_contract(self):
        solve_text = SOLUTION_PATH.read_text()
        response = solve_text.split(
            "cat > /workspace/output/response.txt <<'EOF'\n", 1
        )[1].split("\nEOF", 1)[0]
        health_conn = self._health_schema_conn()
        health_conn.executescript(HEALTH_SEED_PATH.read_text())
        health = verify.read_health_signal(health_conn)

        score, details = verify.score_response(response, health)

        self.assertEqual(0.45, score)
        self.assertEqual({}, details)

    def test_response_contract_requires_windowed_trend_and_zero_value_sync_explanation(
        self,
    ):
        health_conn = self._health_schema_conn()
        health_conn.executescript(HEALTH_SEED_PATH.read_text())
        health = verify.read_health_signal(health_conn)

        response = (
            "Today's sleep quality was 52 versus the usual 80.5 average, a 28.5-point drop. "
            "The 7-day trend is falling, while the 14-day and 30-day trends are stable because "
            "longer windows smooth out one bad night. The wearable page shows today's date but all "
            "values are 0, so it is not synced with health yet."
        )

        score, details = verify.score_response(response, health)

        self.assertGreaterEqual(score, 0.23)
        self.assertNotIn("trend_limitation", details)
        self.assertNotIn("unsynced_recovery", details)

    def test_task_registration_contracts(self):
        metadata = tomllib.loads(TASK_TOML_PATH.read_text())["metadata"]
        self.assertEqual(119, metadata["case_id"])
        self.assertEqual("Health & Fitness", metadata["domain"])
        self.assertEqual(["Health & Fitness", "Smart Home"], metadata["domains_multi"])
        self.assertEqual(1, metadata["factor_a1"])
        self.assertEqual(1, metadata["factor_a2"])
        self.assertEqual(1, metadata["factor_b1"])

        binary_map = json.loads(BINARY_MAP_PATH.read_text())
        task_entry = binary_map["tasks"].get("sleep-trend-recovery2")
        self.assertIsNotNone(task_entry)
        self.assertEqual(["smarthome", "health"], task_entry["binaries"])
        self.assertEqual(
            "tasks/sleep-trend-recovery2/environment/startup.sh",
            task_entry["startup_extra"],
        )

        registry = json.loads(REGISTRY_PATH.read_text())[0]["tasks"]
        self.assertIn(
            {"name": "sleep-trend-recovery2", "path": "tasks/sleep-trend-recovery2"},
            registry,
        )
        self.assertIn(
            ',sleep-trend-recovery2,"Review sleep-quality trend data in the health app, infer recovery-oriented changes, and adjust only tomorrow\'s smart home schedule",M,"Two-mock recovery task combining health and smarthome; evaluates recognition of a sharp sleep-quality drop despite a broadly stable visible trend, companion sleep metric analysis, and a B1 implicit goal: infer that tomorrow\'s HIIT workout and coffee timing should be adjusted while today and protected meetings remain unchanged",Health & Fitness,Health & Fitness ; Smart Home,1,1,1,0,implemented',
            CASES_REGISTRY_PATH.read_text(),
        )
        self.assertIn(
            ",sleep-trend-recovery2,在健康应用中查看睡眠质量趋势数据，推断恢复导向的调整，并且只修改明天的智能家居日程,M,双 mock 恢复任务，结合 health 与 smarthome；评价 agent 识别虽然可见趋势大致稳定但睡眠质量显著下降，分析伴随睡眠指标，并隐式推断应调整明天 HIIT 运动和咖啡时间，同时保持今天和受保护会议不变,Health & Fitness,Health & Fitness ; Smart Home,1,1,1,0,implemented",
            CASES_REGISTRY_ZH_PATH.read_text(),
        )
        self.assertIn('"sleep-trend-recovery2"', BUILD_IMAGES_PATH.read_text())

    def test_get_agent_response_aggregates_harbor_messages_and_fallback(self):
        with tempfile.NamedTemporaryFile("w", delete=False) as f:
            f.write(
                json.dumps(
                    {
                        "type": "message",
                        "message": {
                            "role": "assistant",
                            "content": [
                                {"type": "text", "text": "first response"},
                                {"type": "text", "text": "second response"},
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
                self.assertEqual(
                    "first response second response", verify.get_agent_response()
                )
        finally:
            log_path.unlink()

    def test_startup_and_test_wrapper_contracts(self):
        startup = STARTUP_PATH.read_text()
        self.assertIn("DELETE FROM health_metric_series", startup)
        self.assertIn("/workspace/health.db", startup)
        self.assertIn("/tmp/mosi_smart_home.sqlite", startup)
        self.assertNotIn("mock-health", startup)
        self.assertNotIn("mock-smarthome", startup)
        build_images = BUILD_IMAGES_PATH.read_text()
        self.assertIn(
            "export HEALTH_DB_PATH=/var/lib/mock-data/health/health.db",
            build_images,
        )

        wrapper = TEST_SH_PATH.read_text()
        self.assertIn("python3 /tests/verify.py", wrapper)
        self.assertIn("/logs/verifier", wrapper)

    def test_environment_dockerfile_overlays_task_assets_and_stays_alive(self):
        dockerfile = DOCKERFILE_PATH.read_text()
        self.assertIn(
            "FROM liveclawbench-sleep-trend-recovery2-base:latest", dockerfile
        )
        self.assertIn("COPY seed.sql /opt/mock/data/smarthome.sql", dockerfile)
        self.assertIn("COPY health-seed.sql /opt/mock/data/health.sql", dockerfile)
        self.assertNotIn("/opt/mock/startup-overrides/", dockerfile)
        self.assertIn('CMD ["sh", "-c", "sleep infinity"]', dockerfile)


if __name__ == "__main__":
    unittest.main()
