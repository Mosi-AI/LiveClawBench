-- Health seed data for smarthome-sleep-quality task
-- 30 days of health data from 2026-04-10 to 2026-05-09
-- All dashboard-visible metrics are populated from a single snapshot source of truth.

-- Set system_config.current_date to align with smarthome benchmark_clock
INSERT OR REPLACE INTO system_config (key, value) VALUES ('current_date', '2026-05-09');
INSERT OR REPLACE INTO system_config (key, value) VALUES ('current_time', '08:00');

-- Ensure mock_user exists
INSERT OR IGNORE INTO mock_user (id, username, display_name) VALUES (1, 'default', 'Health User');

-- Build complete daily snapshots from the task-controlled baseline metrics.
-- Derived fields use deterministic formulas so dashboard cards and metric-detail pages
-- always agree for 2026-04-10 through 2026-05-09.
WITH base(user_id, date, steps, active_energy_kcal, sleep_hours, sleep_quality, resting_heart_rate_bpm, total_activity_min) AS (
  VALUES
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
    (1, '2026-05-09', 4500, 150, 6.5, 60, 72, 30)
),
derived AS (
  SELECT
    user_id,
    date,
    steps,
    active_energy_kcal,
    sleep_hours,
    sleep_quality,
    ROUND(sleep_hours * (0.17 + (sleep_quality - 60) * 0.002), 2) AS deep_sleep_hours,
    ROUND(sleep_hours * (0.20 + (sleep_quality - 60) * 0.0012), 2) AS rem_sleep_hours,
    ROUND(total_activity_min * (0.30 + MIN(total_activity_min, 60) / 300.0), 1) AS medium_intensity_min,
    ROUND(total_activity_min * (0.12 + MIN(total_activity_min, 60) / 600.0), 1) AS high_intensity_min,
    total_activity_min,
    resting_heart_rate_bpm,
    CAST(ROUND(resting_heart_rate_bpm + 9 + total_activity_min / 8.0 + (sleep_quality - 70) / 25.0) AS INTEGER) AS avg_heart_rate_bpm,
    ROUND(
      67.8
      + ((CAST(substr(date, 9, 2) AS INTEGER) % 5) - 2) * 0.2
      + CASE WHEN date >= '2026-05-01' THEN -0.1 ELSE 0 END,
      1
    ) AS weight_kg,
    ROUND(
      19.4
      - (sleep_quality - 75) / 20.0
      + CASE WHEN date >= '2026-05-01' THEN -0.1 ELSE 0 END,
      1
    ) AS body_fat_percent,
    ROUND(MIN(99.0, 97.0 + sleep_quality / 100.0 + sleep_hours / 20.0), 1) AS blood_oxygen_percent
  FROM base
)
INSERT OR REPLACE INTO health_daily_snapshot (
  user_id,
  date,
  steps,
  active_energy_kcal,
  sleep_hours,
  sleep_quality,
  light_sleep_hours,
  deep_sleep_hours,
  rem_sleep_hours,
  low_intensity_min,
  medium_intensity_min,
  high_intensity_min,
  total_activity_min,
  resting_heart_rate_bpm,
  avg_heart_rate_bpm,
  weight_kg,
  body_fat_percent,
  blood_oxygen_percent
)
SELECT
  user_id,
  date,
  steps,
  active_energy_kcal,
  sleep_hours,
  sleep_quality,
  ROUND(sleep_hours - deep_sleep_hours - rem_sleep_hours, 2) AS light_sleep_hours,
  deep_sleep_hours,
  rem_sleep_hours,
  ROUND(total_activity_min - medium_intensity_min - high_intensity_min, 1) AS low_intensity_min,
  medium_intensity_min,
  high_intensity_min,
  total_activity_min,
  resting_heart_rate_bpm,
  avg_heart_rate_bpm,
  weight_kg,
  body_fat_percent,
  blood_oxygen_percent
FROM derived;

INSERT OR REPLACE INTO health_metric_series (user_id, metric_type, date, value)
SELECT user_id, 'steps', date, steps
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL
SELECT user_id, 'active_energy_kcal', date, active_energy_kcal
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL
SELECT user_id, 'sleep_hours', date, sleep_hours
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL
SELECT user_id, 'sleep_quality', date, sleep_quality
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL
SELECT user_id, 'light_sleep_hours', date, light_sleep_hours
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL
SELECT user_id, 'deep_sleep_hours', date, deep_sleep_hours
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL
SELECT user_id, 'rem_sleep_hours', date, rem_sleep_hours
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL
SELECT user_id, 'low_intensity_min', date, low_intensity_min
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL
SELECT user_id, 'medium_intensity_min', date, medium_intensity_min
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL
SELECT user_id, 'high_intensity_min', date, high_intensity_min
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL
SELECT user_id, 'total_activity_min', date, total_activity_min
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL
SELECT user_id, 'resting_heart_rate_bpm', date, resting_heart_rate_bpm
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL
SELECT user_id, 'avg_heart_rate_bpm', date, avg_heart_rate_bpm
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL
SELECT user_id, 'weight_kg', date, weight_kg
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL
SELECT user_id, 'body_fat_percent', date, body_fat_percent
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL
SELECT user_id, 'blood_oxygen_percent', date, blood_oxygen_percent
FROM health_daily_snapshot
WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09';
