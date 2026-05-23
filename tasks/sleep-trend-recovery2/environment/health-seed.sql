INSERT OR REPLACE INTO system_config (key, value) VALUES ('current_date', '2026-05-09');
INSERT OR REPLACE INTO system_config (key, value) VALUES ('current_time', '07:45');

INSERT OR IGNORE INTO mock_user (id, username, display_name) VALUES (1, 'default', 'Health User');

WITH base(user_id, date, steps, active_energy_kcal, sleep_hours, sleep_quality, light_sleep_hours, deep_sleep_hours, rem_sleep_hours, low_intensity_min, medium_intensity_min, high_intensity_min, total_activity_min, resting_heart_rate_bpm, avg_heart_rate_bpm, weight_kg, body_fat_percent, blood_oxygen_percent) AS (
  VALUES
    (1, '2026-04-10', 8200, 320, 7.6, 78, 4.62, 1.36, 1.62, 28.0, 18.0, 6.0, 52.0, 58, 76, 67.8, 19.0, 98.1),
    (1, '2026-04-11', 7900, 305, 7.3, 75, 4.45, 1.28, 1.57, 25.0, 17.0, 5.0, 47.0, 59, 77, 67.9, 19.1, 98.0),
    (1, '2026-04-12', 9100, 360, 7.8, 82, 4.72, 1.43, 1.65, 30.0, 20.0, 7.0, 57.0, 56, 75, 67.7, 18.9, 98.4),
    (1, '2026-04-13', 7600, 295, 7.2, 74, 4.39, 1.25, 1.56, 23.0, 16.0, 5.0, 44.0, 60, 78, 67.8, 19.2, 97.9),
    (1, '2026-04-14', 8800, 345, 7.7, 80, 4.66, 1.39, 1.65, 29.0, 18.0, 6.0, 53.0, 57, 76, 67.6, 18.8, 98.2),
    (1, '2026-04-15', 8400, 330, 7.5, 77, 4.58, 1.33, 1.59, 27.0, 17.0, 6.0, 50.0, 58, 77, 67.7, 19.0, 98.1),
    (1, '2026-04-16', 9300, 370, 7.9, 83, 4.78, 1.46, 1.66, 31.0, 20.0, 7.0, 58.0, 56, 75, 67.5, 18.8, 98.5),
    (1, '2026-04-17', 7800, 300, 7.4, 76, 4.52, 1.30, 1.58, 24.0, 16.0, 5.0, 45.0, 59, 78, 67.9, 19.1, 98.0),
    (1, '2026-04-18', 8600, 335, 7.6, 79, 4.61, 1.36, 1.63, 28.0, 18.0, 6.0, 52.0, 57, 76, 67.8, 18.9, 98.3),
    (1, '2026-04-19', 8100, 315, 7.3, 75, 4.46, 1.27, 1.57, 25.0, 17.0, 5.0, 47.0, 60, 78, 67.9, 19.1, 98.0),
    (1, '2026-04-20', 9000, 355, 7.8, 81, 4.73, 1.42, 1.65, 30.0, 19.0, 7.0, 56.0, 56, 75, 67.6, 18.8, 98.4),
    (1, '2026-04-21', 7700, 298, 7.2, 73, 4.41, 1.24, 1.55, 24.0, 16.0, 5.0, 45.0, 60, 79, 67.8, 19.2, 97.9),
    (1, '2026-04-22', 8900, 350, 7.7, 80, 4.67, 1.39, 1.64, 29.0, 18.0, 6.0, 53.0, 57, 76, 67.7, 18.9, 98.2),
    (1, '2026-04-23', 8500, 332, 7.5, 78, 4.57, 1.34, 1.59, 27.0, 17.0, 6.0, 50.0, 58, 77, 67.8, 19.0, 98.1),
    (1, '2026-04-24', 9400, 375, 8.0, 84, 4.82, 1.50, 1.68, 32.0, 21.0, 7.0, 60.0, 55, 75, 67.6, 18.7, 98.5),
    (1, '2026-04-25', 8000, 310, 7.4, 76, 4.50, 1.31, 1.59, 25.0, 17.0, 5.0, 47.0, 59, 78, 67.9, 19.1, 98.0),
    (1, '2026-04-26', 8700, 340, 7.6, 79, 4.62, 1.36, 1.62, 28.0, 18.0, 6.0, 52.0, 57, 76, 67.7, 18.9, 98.3),
    (1, '2026-04-27', 8300, 325, 7.5, 77, 4.58, 1.33, 1.59, 26.0, 17.0, 6.0, 49.0, 58, 77, 67.8, 19.0, 98.1),
    (1, '2026-04-28', 9200, 365, 7.9, 82, 4.77, 1.45, 1.68, 31.0, 20.0, 7.0, 58.0, 56, 75, 67.6, 18.8, 98.4),
    (1, '2026-04-29', 7950, 308, 7.3, 75, 4.46, 1.28, 1.56, 24.0, 16.0, 5.0, 45.0, 60, 78, 67.9, 19.1, 98.0),
    (1, '2026-04-30', 8850, 348, 7.7, 80, 4.68, 1.39, 1.63, 29.0, 18.0, 6.0, 53.0, 57, 76, 67.7, 18.9, 98.2),
    (1, '2026-05-01', 8450, 333, 7.5, 78, 4.56, 1.35, 1.59, 27.0, 17.0, 6.0, 50.0, 58, 77, 67.8, 19.0, 98.1),
    (1, '2026-05-02', 9100, 360, 7.8, 81, 4.74, 1.41, 1.65, 30.0, 19.0, 7.0, 56.0, 56, 75, 67.6, 18.8, 98.4),
    (1, '2026-05-03', 8900, 350, 7.8, 82, 4.70, 1.44, 1.66, 29.0, 18.0, 6.0, 53.0, 56, 75, 67.7, 18.9, 98.4),
    (1, '2026-05-04', 8400, 326, 7.4, 79, 4.49, 1.33, 1.58, 26.0, 17.0, 5.0, 48.0, 57, 76, 67.8, 19.0, 98.2),
    (1, '2026-05-05', 9050, 358, 7.7, 81, 4.63, 1.40, 1.67, 30.0, 18.0, 6.0, 54.0, 56, 75, 67.7, 18.9, 98.3),
    (1, '2026-05-06', 8150, 312, 7.3, 78, 4.46, 1.28, 1.56, 25.0, 16.0, 5.0, 46.0, 58, 77, 67.9, 19.1, 98.1),
    (1, '2026-05-07', 8700, 342, 7.6, 80, 4.58, 1.38, 1.64, 28.0, 18.0, 6.0, 52.0, 57, 76, 67.8, 18.9, 98.2),
    (1, '2026-05-08', 9300, 372, 8.1, 83, 4.83, 1.52, 1.75, 32.0, 20.0, 7.0, 59.0, 55, 74, 67.6, 18.8, 98.5),
    (1, '2026-05-09', 1250, 48, 5.4, 52, 3.85, 0.65, 0.90, 16.0, 7.0, 2.0, 25.0, 68, 86, 67.9, 19.7, 96.9)
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
SELECT user_id, 'steps', date, steps FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL SELECT user_id, 'active_energy_kcal', date, active_energy_kcal FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL SELECT user_id, 'sleep_hours', date, sleep_hours FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL SELECT user_id, 'sleep_quality', date, sleep_quality FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL SELECT user_id, 'light_sleep_hours', date, light_sleep_hours FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL SELECT user_id, 'deep_sleep_hours', date, deep_sleep_hours FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL SELECT user_id, 'rem_sleep_hours', date, rem_sleep_hours FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL SELECT user_id, 'low_intensity_min', date, low_intensity_min FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL SELECT user_id, 'medium_intensity_min', date, medium_intensity_min FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL SELECT user_id, 'high_intensity_min', date, high_intensity_min FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL SELECT user_id, 'total_activity_min', date, total_activity_min FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL SELECT user_id, 'resting_heart_rate_bpm', date, resting_heart_rate_bpm FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL SELECT user_id, 'avg_heart_rate_bpm', date, avg_heart_rate_bpm FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL SELECT user_id, 'weight_kg', date, weight_kg FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL SELECT user_id, 'body_fat_percent', date, body_fat_percent FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09'
UNION ALL SELECT user_id, 'blood_oxygen_percent', date, blood_oxygen_percent FROM health_daily_snapshot WHERE user_id = 1 AND date BETWEEN '2026-04-10' AND '2026-05-09';
