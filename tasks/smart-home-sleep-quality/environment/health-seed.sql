-- Health seed data for smart-home-sleep-quality task
-- 30 days of health data from 2026-04-10 to 2026-05-09
-- Outlier on 2026-05-09: sleep_quality=60, resting_heart_rate_bpm=72

-- Set system_config.current_date to align with smarthome benchmark_clock
INSERT OR REPLACE INTO system_config (key, value) VALUES ('current_date', '2026-05-09');
INSERT OR REPLACE INTO system_config (key, value) VALUES ('current_time', '08:00');

-- Ensure mock_user exists
INSERT OR IGNORE INTO mock_user (id, username, display_name) VALUES (1, 'default', 'Health User');

-- 30 days of health data (baseline healthy data for days 1-29, outlier on day 30)
-- Baseline: sleep_quality 65-85, resting_heart_rate 54-62, activity 30-90 min
-- Outlier (2026-05-09): sleep_quality=60, resting_heart_rate_bpm=72, total_activity_min=30, sleep_hours=6.5

INSERT OR REPLACE INTO health_daily_snapshot (user_id, date, steps, active_energy_kcal, sleep_hours, sleep_quality, resting_heart_rate_bpm, total_activity_min) VALUES
-- Days 1-10 (2026-04-10 to 2026-04-19): healthy baseline
(1, '2026-04-10', 8500, 320, 7.5, 78, 56, 45),
(1, '2026-04-11', 9200, 350, 7.8, 82, 54, 52),
(1, '2026-04-12', 7800, 280, 7.2, 75, 58, 38),
(1, '2026-04-13', 10500, 420, 8.0, 85, 55, 60),
(1, '2026-04-14', 6800, 250, 7.0, 72, 60, 32),
(1, '2026-04-15', 9000, 340, 7.6, 80, 56, 48),
(1, '2026-04-16', 8200, 310, 7.4, 77, 57, 42),
(1, '2026-04-17', 9500, 380, 7.9, 83, 54, 55),
(1, '2026-04-18', 7500, 270, 7.1, 74, 59, 36),
(1, '2026-04-19', 8800, 330, 7.5, 79, 56, 46),

-- Days 11-20 (2026-04-20 to 2026-04-29): healthy baseline
(1, '2026-04-20', 9100, 360, 7.7, 81, 55, 50),
(1, '2026-04-21', 8400, 320, 7.3, 76, 58, 40),
(1, '2026-04-22', 9800, 390, 7.8, 84, 54, 58),
(1, '2026-04-23', 7200, 260, 7.0, 73, 60, 34),
(1, '2026-04-24', 8600, 330, 7.5, 78, 57, 44),
(1, '2026-04-25', 9300, 370, 7.6, 80, 56, 52),
(1, '2026-04-26', 8000, 300, 7.2, 75, 59, 38),
(1, '2026-04-27', 9700, 385, 7.9, 83, 55, 56),
(1, '2026-04-28', 7600, 280, 7.1, 74, 60, 36),
(1, '2026-04-29', 8900, 340, 7.4, 77, 58, 46),

-- Days 21-29 (2026-04-30 to 2026-05-08): healthy baseline
(1, '2026-04-30', 9200, 350, 7.6, 80, 56, 50),
(1, '2026-05-01', 8500, 320, 7.3, 76, 58, 42),
(1, '2026-05-02', 9900, 400, 7.8, 84, 54, 60),
(1, '2026-05-03', 7400, 270, 7.0, 73, 60, 35),
(1, '2026-05-04', 8700, 330, 7.5, 78, 57, 45),
(1, '2026-05-05', 9400, 370, 7.7, 81, 55, 53),
(1, '2026-05-06', 8100, 310, 7.2, 75, 59, 40),
(1, '2026-05-07', 9600, 380, 7.9, 82, 56, 55),
(1, '2026-05-08', 7800, 290, 7.1, 74, 60, 38),

-- Day 30 (2026-05-09): OUTLIER - poor sleep and recovery
-- sleep_quality=60 (< 70 threshold), resting_heart_rate_bpm=72 (higher than normal)
-- total_activity_min=30 (low), sleep_hours=6.5 (less than 7)
-- Expected readiness calculation (per UI tooltip formula):
--   normalized_rhr = (72 - 40) / 60 * 100 = 53.33
--   activity_factor = min(30 / 60 * 100, 100) = 50
--   readiness = 60 * 0.4 + (100 - 53.33) * 0.3 + 50 * 0.3 = 24 + 14 + 15 = 53
(1, '2026-05-09', 4500, 150, 6.5, 60, 72, 30);