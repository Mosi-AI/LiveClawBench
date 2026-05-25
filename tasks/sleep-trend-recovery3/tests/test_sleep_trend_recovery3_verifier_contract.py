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
STARTUP_PATH = TASK_DIR / "environment" / "startup.sh"
HEALTH_SEED_PATH = TASK_DIR / "environment" / "health-seed.sql"
SMARTHOME_SEED_PATH = TASK_DIR / "environment" / "seed.sql"
PRODUCTS_PATH = TASK_DIR / "environment" / "products.json"
SHOP_ORDERS_PATH = TASK_DIR / "environment" / "shop-orders.json"
SOLUTION_PATH = TASK_DIR / "solution" / "solve.sh"
TASK_TOML_PATH = TASK_DIR / "task.toml"
INSTRUCTION_PATH = TASK_DIR / "instruction.md"
BINARY_MAP_PATH = REPO_ROOT / "mock-platform" / "config" / "task-binary-map.json"
SMARTHOME_GROCERY_PAGE_PATH = REPO_ROOT / "mock-platform" / "mocks" / "smarthome" / "src" / "pages" / "inventory.tsx"

spec = importlib.util.spec_from_file_location("sleep_trend_recovery3_verify", VERIFY_PATH)
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class SleepTrendRecovery3VerifierContractTests(unittest.TestCase):
    def _health_schema_conn(self):
        conn = sqlite3.connect(":memory:")
        conn.executescript(
            """
            CREATE TABLE mock_user (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT, created_at TEXT);
            CREATE TABLE system_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
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
            CREATE TABLE health_trend_override (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                metric_type TEXT NOT NULL,
                days INTEGER NOT NULL,
                mean REAL,
                median REAL,
                std_dev REAL,
                min REAL,
                max REAL,
                previous_period_mean REAL,
                change_percent REAL,
                trend TEXT,
                insight TEXT,
                has_mean INTEGER NOT NULL DEFAULT 0,
                has_median INTEGER NOT NULL DEFAULT 0,
                has_std_dev INTEGER NOT NULL DEFAULT 0,
                has_min INTEGER NOT NULL DEFAULT 0,
                has_max INTEGER NOT NULL DEFAULT 0,
                has_previous_period_mean INTEGER NOT NULL DEFAULT 0,
                has_change_percent INTEGER NOT NULL DEFAULT 0,
                has_trend INTEGER NOT NULL DEFAULT 0,
                has_insight INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(user_id, metric_type, days)
            );
            """
        )
        return conn

    def _smarthome_schema_conn(self):
        conn = sqlite3.connect(":memory:")
        conn.executescript(
            """
            CREATE TABLE thermostat_settings (id INTEGER PRIMARY KEY, mode TEXT NOT NULL, temperature REAL NOT NULL, updated_at TEXT NOT NULL);
            CREATE TABLE coffee_schedule (schedule_date TEXT PRIMARY KEY, start_time TEXT NOT NULL, beans_grams INTEGER DEFAULT 20, cancelled INTEGER DEFAULT 0, updated_at TEXT NOT NULL);
            CREATE TABLE benchmark_clock (id INTEGER PRIMARY KEY, clock_time TEXT NOT NULL);
            CREATE TABLE room_metrics (id INTEGER PRIMARY KEY, temperature REAL NOT NULL, humidity REAL NOT NULL, unit_temp TEXT NOT NULL, noise REAL, light REAL, air_quality REAL);
            CREATE TABLE room (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
            CREATE TABLE inventory_item (id INTEGER PRIMARY KEY, item_name TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, location TEXT NOT NULL, expiry_date TEXT, category TEXT, updated_at TEXT);
            CREATE TABLE inventory_snapshot (id INTEGER PRIMARY KEY, item_name TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, location TEXT, captured_at TEXT NOT NULL);
            CREATE TABLE grocery_product (product_id TEXT PRIMARY KEY, name TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, stock_status TEXT NOT NULL, substitute_for TEXT, reference TEXT);
            CREATE TABLE wearable_recovery_state (id INTEGER PRIMARY KEY, sleep_hours REAL NOT NULL, sleep_score REAL NOT NULL, readiness REAL NOT NULL, resting_heart_rate REAL NOT NULL);
            CREATE TABLE calendar_event (id INTEGER PRIMARY KEY, title TEXT NOT NULL, start_time TEXT NOT NULL, event_type TEXT, workout_type TEXT, status TEXT NOT NULL DEFAULT 'undone', updated_at TEXT NOT NULL);
            CREATE TABLE user_constraints (id INTEGER PRIMARY KEY, calorie_target REAL NOT NULL, macro_targets TEXT NOT NULL, allergy_constraints TEXT NOT NULL, weekly_budget_limit REAL NOT NULL);
            CREATE TABLE recipe (id INTEGER PRIMARY KEY, name TEXT NOT NULL, meal_type TEXT NOT NULL, ingredients TEXT NOT NULL, calories_total REAL NOT NULL, allergens TEXT);
            """
        )
        return conn

    def _load_state(self):
        health_conn = self._health_schema_conn()
        smarthome_conn = self._smarthome_schema_conn()
        health_conn.executescript(HEALTH_SEED_PATH.read_text())
        smarthome_conn.executescript(SMARTHOME_SEED_PATH.read_text())
        return health_conn, smarthome_conn

    def test_metadata_instruction_and_binary_map_contracts(self):
        metadata = tomllib.loads(TASK_TOML_PATH.read_text())["metadata"]
        self.assertEqual("hard", metadata["difficulty"])
        self.assertEqual("Health & Fitness", metadata["domain"])
        self.assertEqual(["Health & Fitness", "E-commerce & Daily Svcs"], metadata["domains_multi"])
        self.assertEqual(1, metadata["factor_a1"])
        self.assertEqual(1, metadata["factor_a2"])
        self.assertEqual(1, metadata["factor_b1"])
        self.assertEqual(0, metadata["factor_b2"])
        self.assertEqual(120, metadata["case_id"])

        instruction = INSTRUCTION_PATH.read_text()
        self.assertIn("http://localhost:5007/", instruction)
        self.assertIn("http://localhost:5004/", instruction)
        self.assertIn("http://localhost:1234/", instruction)
        self.assertIn("open it in browser", instruction)
        for hidden in ["6.5", "08:30", "ORD000001", "Score", "reward", "verify.py"]:
            self.assertNotIn(hidden, instruction)

        binary_map = json.loads(BINARY_MAP_PATH.read_text())
        task_entry = binary_map["tasks"].get("sleep-trend-recovery3")
        self.assertIsNotNone(task_entry)
        self.assertEqual(["smarthome", "health", "shop"], task_entry["binaries"])
        self.assertEqual("tasks/sleep-trend-recovery3/environment/startup.sh", task_entry["startup_extra"])
        asset_pairs = {(asset["src"], asset["dest"]) for asset in task_entry["assets"]}
        self.assertIn(("tasks/sleep-trend-recovery3/environment/seed.sql", "/opt/mock/data/smarthome.sql"), asset_pairs)
        self.assertIn(("tasks/sleep-trend-recovery3/environment/health-seed.sql", "/opt/mock/data/health.sql"), asset_pairs)
        self.assertIn(("tasks/sleep-trend-recovery3/environment/products.json", "/opt/mock/static/shop/products.json"), asset_pairs)
        self.assertIn(("tasks/sleep-trend-recovery3/environment/shop-orders.json", "/opt/mock/data/shop-orders.json"), asset_pairs)

    def test_health_seed_contains_corrupted_sleep_and_trend_overrides(self):
        health_conn = self._health_schema_conn()
        health_conn.executescript(HEALTH_SEED_PATH.read_text())

        self.assertEqual("2026-05-09", health_conn.execute("SELECT value FROM system_config WHERE key = 'current_date'").fetchone()[0])
        row = health_conn.execute(
            """
            SELECT sleep_hours, sleep_quality, light_sleep_hours, deep_sleep_hours, rem_sleep_hours,
                   low_intensity_min, medium_intensity_min, high_intensity_min, resting_heart_rate_bpm
            FROM health_daily_snapshot WHERE user_id = 1 AND date = '2026-05-09'
            """
        ).fetchone()
        self.assertEqual((8.0, 60.0, 4.09, 1.11, 1.3, 45.0, 0.0, 30.0, 72), row)
        self.assertAlmostEqual(6.5, row[2] + row[3] + row[4], places=2)

        overrides = {
            (metric, days): (mean, min_value, max_value, has_mean, has_min, has_max)
            for metric, days, mean, min_value, max_value, has_mean, has_min, has_max in health_conn.execute(
                """
                SELECT metric_type, days, mean, min, max, has_mean, has_min, has_max
                FROM health_trend_override
                WHERE user_id = 1
                """
            )
        }
        self.assertEqual(92.0, overrides[("sleep_quality", 7)][2])
        self.assertEqual(95.0, overrides[("sleep_quality", 30)][2])
        self.assertEqual(8.2, overrides[("sleep_hours", 14)][0])
        self.assertEqual(9.5, overrides[("sleep_hours", 30)][2])
        self.assertEqual(8.0, overrides[("low_intensity_min", 7)][1])
        self.assertEqual(48.0, overrides[("high_intensity_min", 7)][0])
        self.assertEqual(22.0, overrides[("high_intensity_min", 14)][0])

        fixed_seed_time = "2026-05-09T07:15:00"
        for table in ["health_daily_snapshot", "health_metric_series", "health_trend_override"]:
            created_values = {
                created_at
                for (created_at,) in health_conn.execute(f"SELECT DISTINCT created_at FROM {table}")
            }
            self.assertEqual({fixed_seed_time}, created_values)
        trend_updated_values = {
            updated_at
            for (updated_at,) in health_conn.execute("SELECT DISTINCT updated_at FROM health_trend_override")
        }
        self.assertEqual({fixed_seed_time}, trend_updated_values)

        sleep_quality_30 = [
            value
            for (value,) in health_conn.execute(
                """
                SELECT value FROM health_metric_series
                WHERE metric_type = 'sleep_quality'
                ORDER BY date
                """
            )
        ]
        self.assertEqual(30, len(sleep_quality_30))
        self.assertEqual(60.0, sleep_quality_30[-1])
        self.assertEqual(82.0, max(sleep_quality_30))
        self.assertGreaterEqual(len(set(sleep_quality_30)), 10)
        self.assertNotEqual(sleep_quality_30[:10], sleep_quality_30[10:20])

    def test_smarthome_seed_contains_full_cross_service_state(self):
        smarthome_conn = self._smarthome_schema_conn()
        smarthome_conn.executescript(SMARTHOME_SEED_PATH.read_text())

        self.assertEqual((8.0, 60.0, 45.0, 72.0), smarthome_conn.execute("SELECT sleep_hours, sleep_score, readiness, resting_heart_rate FROM wearable_recovery_state WHERE id = 1").fetchone())
        self.assertEqual(("07:00", 0), smarthome_conn.execute("SELECT start_time, cancelled FROM coffee_schedule WHERE schedule_date = '2026-05-09'").fetchone())
        self.assertEqual(("07:00", 0), smarthome_conn.execute("SELECT start_time, cancelled FROM coffee_schedule WHERE schedule_date = '2026-05-10'").fetchone())

        pantry_supplies = {
            name: (quantity, unit, category)
            for name, quantity, unit, category in smarthome_conn.execute(
                """
                SELECT item_name, quantity, unit, category
                FROM inventory_item
                WHERE location = 'pantry'
                """
            )
        }
        self.assertEqual((1000.0, "grams", "beverage"), pantry_supplies["Coffee Beans"])
        self.assertEqual((5.0, "kg", "grocery"), pantry_supplies["Jasmine Rice"])
        self.assertEqual((24.0, "bottles", "household"), pantry_supplies["Bottled Water"])
        self.assertEqual((12.0, "rolls", "household"), pantry_supplies["Toilet Paper"])

        yesterday = smarthome_conn.execute(
            """
            SELECT title, workout_type, status FROM calendar_event
            WHERE start_time >= '2026-05-08T00:00:00Z' AND start_time < '2026-05-09T00:00:00Z'
            ORDER BY start_time
            """
        ).fetchall()
        self.assertEqual([
            ("Yoga", "yoga", "done"),
            ("Strength", "strength", "undone"),
            ("HIIT", "hiit", "done"),
            ("Cycling", "cycling", "undone"),
            ("Swimming", "swimming", "undone"),
        ], yesterday)
        self.assertNotEqual(
            ["done", "done", "undone", "undone", "undone"],
            [status for _title, _workout_type, status in yesterday],
        )

        future_workouts = smarthome_conn.execute(
            """
            SELECT substr(start_time, 1, 10), title, workout_type FROM calendar_event
            WHERE start_time BETWEEN '2026-05-10T00:00:00Z' AND '2026-05-16T23:59:59Z'
              AND event_type = 'workout'
            ORDER BY start_time
            """
        ).fetchall()
        self.assertEqual([
            ("2026-05-10", "HIIT Workout", "hiit"),
            ("2026-05-11", "Strength Session", "strength"),
            ("2026-05-12", "Swim Intervals", "swimming"),
            ("2026-05-13", "HIIT Workout", "hiit"),
            ("2026-05-14", "Strength Session", "strength"),
            ("2026-05-15", "Swim Intervals", "swimming"),
            ("2026-05-16", "HIIT Workout", "hiit"),
        ], future_workouts)

        shopping = {name: (quantity, unit, stock, ref) for name, quantity, unit, stock, ref in smarthome_conn.execute("SELECT name, quantity, unit, stock_status, reference FROM grocery_product")}
        self.assertEqual((2.0, "lbs", "sufficient", "ORD000005"), shopping["Salted Butter"])
        self.assertEqual((30.0, "capsules", "sufficient", "ORD000003"), shopping["CoQ10"])
        self.assertNotIn("Omega-3", shopping)

    def test_shop_assets_do_not_couple_smarthome_ui_contract(self):
        products = json.loads(PRODUCTS_PATH.read_text())
        titles = {product["title"]: product for product in products}
        for title in ["CoQ10 30 Capsules", "Omega-3 60 Softgels", "Magnesium 60 Tablets", "Valerian Root 60 Capsules"]:
            self.assertIn(title, titles)

        orders = json.loads(SHOP_ORDERS_PATH.read_text())
        order_items = {order["order_id"]: order["items"][0]["title"] for order in orders}
        self.assertEqual("CoQ10 30 Capsules", order_items["ORD000001"])
        self.assertEqual("Omega-3 60 Softgels", order_items["ORD000003"])
        self.assertEqual("Salted Butter 1 lb", order_items["ORD000005"])

        grocery_page = SMARTHOME_GROCERY_PAGE_PATH.read_text()
        self.assertIn("Track items that need restocking.", grocery_page)
        self.assertNotIn("Items available in the shop should be ordered and kept in sync with orders.", grocery_page)
        self.assertNotIn("http://localhost:1234/orders", grocery_page)
        self.assertNotIn("http://localhost:1234/", grocery_page)
        self.assertNotIn("Shop recovery supplements", grocery_page)

    def test_verifier_zero_work_oracle_and_response_contracts(self):
        health_conn, smarthome_conn = self._load_state()
        health = verify.read_health_signal(health_conn)
        orders = verify.load_shop_orders(SHOP_ORDERS_PATH)

        state_scores = verify.score_state(smarthome_conn, orders)
        response_score, response_details = verify.score_response("", health)
        reward, details = verify.compute_reward(state_scores, response_score, "")
        self.assertEqual(0.0, reward)
        self.assertIn("zero-work", details.lower())
        self.assertFalse(state_scores["required_blockers_passed"])
        self.assertEqual(0.0, response_score)
        self.assertIn("sleep_summary", response_details)

        verify.apply_oracle_state(smarthome_conn, orders)
        oracle_response = verify.build_oracle_response("ORD000006", "ORD000007")
        state_scores = verify.score_state(smarthome_conn, orders)
        response_score, response_details = verify.score_response(oracle_response, health)
        reward, details = verify.compute_reward(state_scores, response_score, oracle_response)
        self.assertEqual(1.0, reward)
        self.assertEqual({}, response_details)
        self.assertTrue(state_scores["required_blockers_passed"], details)

    def test_future_workout_scoring_gives_half_credit_for_medium_intensity_changes(self):
        _, smarthome_conn = self._load_state()
        smarthome_conn.execute(
            "UPDATE calendar_event SET workout_type = 'cycling' WHERE id IN (11, 13, 17, 19, 23)"
        )
        smarthome_conn.execute(
            "UPDATE calendar_event SET workout_type = 'swimming' WHERE id = 15"
        )

        score, passed, detail = verify.score_future_workouts(smarthome_conn)

        self.assertEqual(0.05, score)
        self.assertFalse(passed)
        self.assertIn("partial", detail.lower())

    def test_future_workout_scoring_gives_full_credit_for_non_medium_recovery_changes(self):
        _, smarthome_conn = self._load_state()
        smarthome_conn.execute(
            "UPDATE calendar_event SET title = 'Recovery Yoga', workout_type = 'yoga' "
            "WHERE event_type = 'workout' "
            "AND start_time BETWEEN '2026-05-10T00:00:00Z' AND '2026-05-16T23:59:59Z'"
        )

        score, passed, detail = verify.score_future_workouts(smarthome_conn)

        self.assertEqual(0.10, score)
        self.assertTrue(passed, detail)
        self.assertIn("full credit", detail.lower())

    def test_sleep_analysis_response_scoring_prioritizes_7_day_sleep_metrics(self):
        health_conn, _ = self._load_state()
        health = verify.read_health_signal(health_conn)

        seven_day_sleep = """
        The 7-day sleep picture is the main issue: sleep quality averaged 77.1 with a 60 low
        and 82 high, sleep duration averaged 7.13 hours with the latest true sleep at 6.5,
        light sleep averaged 3.94 hours, deep sleep averaged 1.28 hours, and REM sleep
        averaged 1.91 hours.
        """
        long_window_sleep = """
        The 14-day sleep duration average was 7.12 hours and the 30-day sleep duration
        average was 7.22 hours. Sleep quality over 30 days averaged 76.37.
        """

        seven_components = verify.score_response_components(seven_day_sleep, health)
        long_components = verify.score_response_components(long_window_sleep, health)

        self.assertEqual(0.15, seven_components["scores"]["sleep_7day_analysis"])
        self.assertLessEqual(long_components["scores"]["sleep_14_30_analysis"], 0.03)
        self.assertGreater(
            seven_components["scores"]["sleep_7day_analysis"],
            long_components["scores"]["sleep_14_30_analysis"] * 4,
        )

    def test_workout_inference_is_required_and_reports_point_breakdown(self):
        _, smarthome_conn = self._load_state()
        response_without_workouts = """
        I corrected sleep hours to 6.5, adjusted readiness, moved coffee to 08:30,
        and changed the upcoming workouts to recovery yoga.
        """
        response_with_workouts = """
        For yesterday's workout inference: Yoga was 45 min low intensity and DONE,
        HIIT was 30 min high intensity and DONE, while Strength, Cycling, and Swimming
        were UNDONE and excluded.
        """

        missing_components = verify.score_response_components(response_without_workouts, {})
        present_components = verify.score_response_components(response_with_workouts, {})

        self.assertFalse(missing_components["required_workout_inference_passed"])
        self.assertTrue(present_components["required_workout_inference_passed"])
        self.assertEqual(0.08, present_components["scores"]["workout_inference"])

        state_scores = verify.score_state(smarthome_conn, verify.load_shop_orders(SHOP_ORDERS_PATH))
        reward, detail = verify.compute_reward(
            state_scores,
            missing_components["total"],
            response_without_workouts,
            required_response_passed=missing_components["required_workout_inference_passed"],
        )
        self.assertIn("required workout inference missing", detail)

        report = verify.format_workout_inference_report(present_components["workout_found"])
        self.assertIn("Yoga = 45 min (Low, DONE) -> 0.03 pts", report)
        self.assertIn("HIIT = 30 min (High, DONE) -> 0.03 pts", report)
        self.assertIn("Strength/Cycling/Swimming excluded (UNDONE) -> 0.02 pts", report)
        self.assertIn("Total: 0.08 pts. REQUIRED.", report)

    def test_exercise_trend_analysis_includes_medium_intensity(self):
        health_conn, _ = self._load_state()
        health = verify.read_health_signal(health_conn)
        response = """
        Exercise trend issues: Low Intensity 7-day min showed 8 min but actual was
        12.9 min. Medium Intensity 7-day average was 6.64 min. High Intensity
        7-day average showed 48 min but actual was 35 min. High Intensity
        14-day average showed 22 min but actual was 35 min.
        """

        components = verify.score_response_components(response, health)

        self.assertEqual(0.04, components["scores"]["exercise_trend_analysis"])
        self.assertTrue(components["exercise_found"]["medium_intensity_7_average"])

    def test_wearable_scoring_requires_sleep_hours_and_readiness_repair(self):
        _, smarthome_conn = self._load_state()

        smarthome_conn.execute(
            "UPDATE wearable_recovery_state SET sleep_hours = 6.5, sleep_score = 60, readiness = 45, resting_heart_rate = 72 WHERE id = 1"
        )
        score, passed, detail = verify.score_wearable_repair(smarthome_conn)
        self.assertEqual(0.04, score)
        self.assertFalse(passed)
        self.assertIn("readiness=45", detail)

        smarthome_conn.execute(
            "UPDATE wearable_recovery_state SET sleep_hours = 6.5, sleep_score = 60, readiness = 68, resting_heart_rate = 72 WHERE id = 1"
        )
        score, passed, detail = verify.score_wearable_repair(smarthome_conn)
        self.assertEqual(0.08, score)
        self.assertTrue(passed, detail)

    def test_shopping_scoring_accepts_sufficient_stock_for_ordered_supplements(self):
        _, smarthome_conn = self._load_state()
        orders = verify.load_shop_orders(SHOP_ORDERS_PATH)
        for order_id, product_id, title in [
            ("ORD000006", "prod_magnesium_60", "Magnesium 60 Tablets"),
            ("ORD000007", "prod_valerian_60", "Valerian Root 60 Capsules"),
        ]:
            orders.append({
                "order_id": order_id,
                "items": [{"id": product_id, "product_id": product_id, "title": title, "quantity": 1}],
            })

        smarthome_conn.execute("UPDATE grocery_product SET quantity = 1, unit = 'lb', stock_status = 'sufficient', reference = 'ORD000005' WHERE name = 'Salted Butter'")
        smarthome_conn.execute("UPDATE grocery_product SET quantity = 30, unit = 'capsules', stock_status = 'sufficient', reference = 'ORD000001' WHERE name = 'CoQ10'")
        smarthome_conn.execute("INSERT OR REPLACE INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES ('omega3', 'Omega-3', 60, 'softgels', 'sufficient', NULL, 'ORD000003')")
        smarthome_conn.execute("INSERT OR REPLACE INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES ('magnesium', 'Magnesium', 60, 'tablets', 'sufficient', NULL, 'ORD000006')")
        smarthome_conn.execute("INSERT OR REPLACE INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES ('valerian-root', 'Valerian Root', 60, 'capsules', 'sufficient', NULL, 'ORD000007')")

        score, passed, checks = verify.score_shopping_list(smarthome_conn, orders)
        self.assertEqual(0.25, score)
        self.assertTrue(passed, checks)

    def test_shopping_scoring_gives_half_valerian_credit_for_correct_sleep_tea_order(self):
        _, smarthome_conn = self._load_state()
        orders = verify.load_shop_orders(SHOP_ORDERS_PATH)
        for order_id, product_id, title in [
            ("ORD000006", "prod_magnesium_60", "Magnesium 60 Tablets"),
            ("ORD000007", "prod_valerian_sleep_tea_20", "Valerian Sleep Tea 20 Bags"),
        ]:
            orders.append({
                "order_id": order_id,
                "items": [{"id": product_id, "product_id": product_id, "title": title, "quantity": 1}],
            })

        smarthome_conn.execute("UPDATE grocery_product SET quantity = 1, unit = 'lb', stock_status = 'sufficient', reference = 'ORD000005' WHERE name = 'Salted Butter'")
        smarthome_conn.execute("UPDATE grocery_product SET quantity = 30, unit = 'capsules', stock_status = 'sufficient', reference = 'ORD000001' WHERE name = 'CoQ10'")
        smarthome_conn.execute("INSERT OR REPLACE INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES ('omega3', 'Omega-3', 60, 'softgels', 'sufficient', NULL, 'ORD000003')")
        smarthome_conn.execute("INSERT OR REPLACE INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES ('magnesium', 'Magnesium', 60, 'tablets', 'sufficient', NULL, 'ORD000006')")

        score, passed, checks = verify.score_shopping_list(smarthome_conn, orders)

        self.assertEqual(0.23, score)
        self.assertFalse(passed)
        self.assertEqual(0.5, checks["valerian_entry"])

    def test_final_response_loader_prefers_harbor_and_falls_back_to_oracle_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            harbor = tmp_path / "harbor.jsonl"
            fallback = tmp_path / "final_response.txt"
            fallback.write_text("fallback response")
            harbor.write_text(json.dumps({"type": "message", "message": {"role": "assistant", "content": [{"type": "text", "text": "harbor response"}]}}) + "\n")
            with mock.patch.object(verify, "HARBOR_LOG_CANDIDATES", [harbor]), mock.patch.object(verify, "FINAL_RESPONSE_FALLBACK", fallback):
                self.assertEqual("harbor response", verify.load_final_response())
            harbor.unlink()
            with mock.patch.object(verify, "HARBOR_LOG_CANDIDATES", [harbor]), mock.patch.object(verify, "FINAL_RESPONSE_FALLBACK", fallback):
                self.assertEqual("fallback response", verify.load_final_response())

    def test_wrapper_dockerfile_startup_and_solution_contracts(self):
        dockerfile = DOCKERFILE_PATH.read_text()
        self.assertIn("FROM liveclawbench-sleep-trend-recovery3-base:latest", dockerfile)
        self.assertIn("CMD", dockerfile)

        startup = STARTUP_PATH.read_text()
        self.assertIn("/workspace/health.db", startup)
        self.assertIn("/tmp/mosi_smart_home.sqlite", startup)
        self.assertIn("/tmp/mosi_shop_orders.json", startup)
        self.assertIn("/opt/mock/data/shop-orders.json", startup)

        wrapper = TEST_SH_PATH.read_text()
        self.assertIn("python3 /tests/verify.py", wrapper)
        self.assertIn("/logs/verifier", wrapper)

        solution = SOLUTION_PATH.read_text()
        self.assertIn("/logs/agent/final_response.txt", solution)
        self.assertIn("ORD000006", solution)
        self.assertIn("ORD000007", solution)


if __name__ == "__main__":
    unittest.main()
