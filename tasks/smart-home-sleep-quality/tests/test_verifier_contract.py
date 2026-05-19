import importlib.util
import json
import os
import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock


TASK_DIR = Path(__file__).resolve().parent.parent
VERIFY_PATH = TASK_DIR / "tests" / "verify.py"
TEST_SH_PATH = TASK_DIR / "tests" / "test.sh"
SEED_PATH = TASK_DIR / "environment" / "health-seed.sql"


spec = importlib.util.spec_from_file_location("smart_home_verify", VERIFY_PATH)
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class SmartHomeSleepQualityVerifierTests(unittest.TestCase):
    def test_health_seed_executes_to_complete_snapshot_and_metric_series(self):
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
        conn.executescript(SEED_PATH.read_text())

        rows = conn.execute(
            """
            SELECT date, light_sleep_hours, deep_sleep_hours, rem_sleep_hours,
                   low_intensity_min, medium_intensity_min, high_intensity_min,
                   avg_heart_rate_bpm, weight_kg, body_fat_percent, blood_oxygen_percent
            FROM health_daily_snapshot
            WHERE user_id = 1
            ORDER BY date
            """
        ).fetchall()

        self.assertEqual(30, len(rows))
        for row in rows:
            self.assertNotIn(None, row, msg=f"incomplete snapshot row: {row}")

        metric_types = [
            "steps", "active_energy_kcal", "sleep_hours", "sleep_quality",
            "light_sleep_hours", "deep_sleep_hours", "rem_sleep_hours",
            "low_intensity_min", "medium_intensity_min", "high_intensity_min", "total_activity_min",
            "resting_heart_rate_bpm", "avg_heart_rate_bpm", "weight_kg",
            "body_fat_percent", "blood_oxygen_percent",
        ]
        for metric_type in metric_types:
            count = conn.execute(
                "SELECT COUNT(*) FROM health_metric_series WHERE user_id = 1 AND metric_type = ?",
                (metric_type,),
            ).fetchone()[0]
            self.assertEqual(30, count, msg=f"{metric_type} has {count} rows")

    def test_startup_clears_default_health_metric_tables_before_seed_import(self):
        text = (TASK_DIR / "environment" / "startup.sh").read_text()
        self.assertIn("DELETE FROM health_metric_series", text)
        self.assertIn("DELETE FROM health_daily_snapshot", text)

    def test_d6_does_not_fallback_to_response_file_when_harbor_exists(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            harbor = Path(tmpdir) / "harbor.jsonl"
            harbor.write_text(json.dumps({
                "type": "message",
                "message": {"role": "assistant", "content": [{"type": "text", "text": "intermediate reply only"}]},
            }) + "\n")

            fake_response = Path(tmpdir) / "response.txt"
            fake_response.write_text(
                "I checked 2026-05-09 sleep quality 60 readiness 53 thermostat 68F melatonin order ORD000004"
            )

            real_read_text = Path.read_text

            def fake_exists(self):
                s = str(self)
                if s in {
                    "/workspace/.openclaw/agents/main/sessions/harbor.jsonl",
                    "/root/.openclaw/agents/main/sessions/harbor.jsonl",
                    "/logs/agent/openclaw-state/agents/main/sessions/harbor.jsonl",
                }:
                    return True
                if s == "/workspace/output/response.txt":
                    return True
                return real_path_class(s).exists()

            def fake_read_text(self, *args, **kwargs):
                if str(self) == "/workspace/output/response.txt":
                    return real_read_text(fake_response, *args, **kwargs)
                return real_read_text(self, *args, **kwargs)

            with mock.patch.object(verify, "get_last_assistant_message", return_value=None), \
                 mock.patch.object(verify.Path, "exists", fake_exists), \
                 mock.patch.object(verify.Path, "read_text", fake_read_text):
                passed, details = verify.check_dimension_6()

            self.assertFalse(passed)
            self.assertIn("No agent response found", details)

    def test_health_seed_populates_metric_series_for_sleep_quality_window(self):
        seed_sql = SEED_PATH.read_text()
        self.assertIn("INSERT OR REPLACE INTO health_metric_series", seed_sql)
        self.assertIn("'sleep_quality'", seed_sql)
        self.assertIn("'2026-04-10'", seed_sql)
        self.assertIn("'2026-05-09'", seed_sql)

    def test_verify_comment_documents_readiness_53_not_38(self):
        text = VERIFY_PATH.read_text()
        self.assertNotIn("readiness = 38", text)
        self.assertIn("readiness = 53", text)

    def test_test_sh_writes_reward_files_contract(self):
        text = TEST_SH_PATH.read_text()
        self.assertIn("/logs/verifier/reward.txt", text)
        self.assertIn("/logs/verifier/reward.json", text)

    def test_verify_enforces_health_source_window(self):
        text = VERIFY_PATH.read_text()
        self.assertIn("health_metric_series", text)
        self.assertIn("2026-04-10", text)
        self.assertIn("2026-05-09", text)

    def test_verify_detects_direct_db_or_json_tampering_patterns(self):
        with tempfile.NamedTemporaryFile("w", delete=False) as f:
            f.write(json.dumps({
                "type": "message",
                "message": {
                    "role": "assistant",
                    "content": [{
                        "type": "toolCall",
                        "name": "exec",
                        "arguments": {"command": "sqlite3 /tmp/mosi_smart_home.sqlite \"update thermostat_settings set temperature=68\""},
                    }],
                },
            }) + "\n")
            log_path = f.name

        try:
            def fake_exists(self):
                s = str(self)
                return s in {
                    log_path,
                    "/workspace/.openclaw/agents/main/sessions/harbor.jsonl",
                }

            real_open = open

            def fake_open(path, *args, **kwargs):
                if str(path) == "/workspace/.openclaw/agents/main/sessions/harbor.jsonl":
                    return real_open(log_path, *args, **kwargs)
                return real_open(path, *args, **kwargs)

            with mock.patch.object(verify.Path, "exists", fake_exists), \
                 mock.patch.object(verify, "open", fake_open):
                violation, details = verify.detect_direct_api_calls()
            self.assertTrue(violation)
            self.assertIn("detected", details.lower())
        finally:
            os.unlink(log_path)


if __name__ == "__main__":
    unittest.main()
