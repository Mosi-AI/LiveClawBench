INSERT OR REPLACE INTO system_config (key, value) VALUES ('current_date', '2026-05-09');
INSERT OR REPLACE INTO system_config (key, value) VALUES ('current_time', '07:45');

INSERT OR IGNORE INTO mock_user (id, username, display_name) VALUES (1, 'default', 'Health User');

WITH base(user_id, date, steps, active_energy_kcal, sleep_hours, sleep_quality, light_sleep_hours, deep_sleep_hours, rem_sleep_hours, low_intensity_min, medium_intensity_min, high_intensity_min, total_activity_min, resting_heart_rate_bpm, avg_heart_rate_bpm, weight_kg, body_fat_percent, blood_oxygen_percent) AS (
  VALUES
    (1, '2026-05-03', 8300, 310, 7.4, 78, 4.68, 1.24, 1.48, 24.0, 16.0, 5.0, 45.0, 58, 76, 67.8, 19.0, 98.2),
    (1, '2026-05-04', 9100, 355, 7.6, 82, 4.79, 1.29, 1.52, 26.0, 18.0, 6.0, 50.0, 56, 77, 67.7, 18.9, 98.4),
    (1, '2026-05-05', 8700, 330, 7.3, 76, 4.61, 1.23, 1.46, 23.0, 17.0, 5.0, 45.0, 59, 78, 67.9, 19.2, 98.0),
    (1, '2026-05-06', 9400, 370, 7.8, 84, 4.91, 1.33, 1.56, 28.0, 19.0, 7.0, 54.0, 55, 76, 67.6, 18.8, 98.5),
    (1, '2026-05-07', 7900, 295, 7.1, 74, 4.49, 1.19, 1.42, 22.0, 14.0, 4.0, 40.0, 60, 79, 67.8, 19.1, 97.9),
    (1, '2026-05-08', 8600, 325, 7.5, 80, 4.73, 1.27, 1.50, 25.0, 16.0, 5.0, 46.0, 57, 77, 67.7, 18.9, 98.2),
    (1, '2026-05-09', 4200, 145, 6.5, 62, 4.09, 1.11, 1.30, 18.0, 8.0, 3.0, 29.0, 110, 122, 67.9, 19.8, 96.8)
)
INSERT OR REPLACE INTO health_daily_snapshot (
  user_id, date, steps, active_energy_kcal, sleep_hours, sleep_quality,
  light_sleep_hours, deep_sleep_hours, rem_sleep_hours, low_intensity_min,
  medium_intensity_min, high_intensity_min, total_activity_min,
  resting_heart_rate_bpm, avg_heart_rate_bpm, weight_kg,
  body_fat_percent, blood_oxygen_percent
)
SELECT * FROM base;

INSERT OR REPLACE INTO health_metric_series (user_id, metric_type, date, value)
SELECT user_id, 'steps', date, steps FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
UNION ALL SELECT user_id, 'active_energy_kcal', date, active_energy_kcal FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
UNION ALL SELECT user_id, 'sleep_hours', date, sleep_hours FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
UNION ALL SELECT user_id, 'sleep_quality', date, sleep_quality FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
UNION ALL SELECT user_id, 'light_sleep_hours', date, light_sleep_hours FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
UNION ALL SELECT user_id, 'deep_sleep_hours', date, deep_sleep_hours FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
UNION ALL SELECT user_id, 'rem_sleep_hours', date, rem_sleep_hours FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
UNION ALL SELECT user_id, 'low_intensity_min', date, low_intensity_min FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
UNION ALL SELECT user_id, 'medium_intensity_min', date, medium_intensity_min FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
UNION ALL SELECT user_id, 'high_intensity_min', date, high_intensity_min FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
UNION ALL SELECT user_id, 'total_activity_min', date, total_activity_min FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
UNION ALL SELECT user_id, 'resting_heart_rate_bpm', date, resting_heart_rate_bpm FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
UNION ALL SELECT user_id, 'avg_heart_rate_bpm', date, avg_heart_rate_bpm FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
UNION ALL SELECT user_id, 'weight_kg', date, weight_kg FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
UNION ALL SELECT user_id, 'body_fat_percent', date, body_fat_percent FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09'
UNION ALL SELECT user_id, 'blood_oxygen_percent', date, blood_oxygen_percent FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-05-03' AND '2026-05-09';
