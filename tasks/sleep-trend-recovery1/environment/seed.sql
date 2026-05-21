INSERT OR REPLACE INTO benchmark_clock (id, clock_time)
VALUES (1, '2026-05-09T07:45:00Z');

INSERT OR REPLACE INTO thermostat_settings (id, mode, temperature, updated_at)
VALUES (1, 'eco', 72.0, '2026-05-09T06:30:00Z');

INSERT OR REPLACE INTO calendar_event (id, title, start_time, event_type, workout_type, status, updated_at) VALUES
(1, 'Morning Routine', '2026-05-09T08:00:00Z', 'routine', NULL, 'undone', '2026-05-08T20:00:00Z'),
(2, 'HIIT Workout', '2026-05-09T09:00:00Z', 'workout', 'hiit', 'undone', '2026-05-08T20:00:00Z'),
(3, 'Team Standup', '2026-05-09T11:00:00Z', 'meeting', NULL, 'undone', '2026-05-08T20:00:00Z'),
(4, 'Project Review', '2026-05-09T14:00:00Z', 'meeting', NULL, 'undone', '2026-05-08T20:00:00Z'),
(5, 'Evening Walk', '2026-05-09T18:30:00Z', 'workout', 'walking', 'undone', '2026-05-08T20:00:00Z');

INSERT OR REPLACE INTO coffee_schedule (schedule_date, start_time, beans_grams, cancelled, updated_at) VALUES
('2026-05-09', '07:00', 20, 0, '2026-05-09T06:00:00Z'),
('2026-05-10', '07:00', 20, 0, '2026-05-09T06:00:00Z');

-- Wearable Recovery State synced to the benchmark-day health outlier.
-- readiness formula from UI tooltip:
--   normalized_rhr = (110 - 40) / 60 * 100 = 116.67
--   activity_factor = min(29 / 60 * 100, 100) = 48.33
--   readiness = 62 * 0.4 + (100 - 116.67) * 0.3 + 48.33 * 0.3 = 34.3 -> 34
INSERT OR REPLACE INTO wearable_recovery_state (id, sleep_hours, sleep_score, readiness, resting_heart_rate)
VALUES (1, 6.5, 62.0, 34.0, 110.0);

-- User Constraints and recipes so Meal Plan renders without service errors.
INSERT OR REPLACE INTO user_constraints (id, calorie_target, macro_targets, allergy_constraints, weekly_budget_limit)
VALUES (1, 2000.0, '{"protein": 150, "carbs": 250, "fat": 65}', '["shellfish"]', 150.0);

INSERT OR REPLACE INTO recipe (id, name, meal_type, ingredients, calories_total, allergens) VALUES
(1, 'Overnight Oats with Berries', 'breakfast', '["oats", "milk", "berries", "honey"]', 380.0, '["dairy"]'),
(2, 'Avocado Toast', 'breakfast', '["bread", "avocado", "eggs", "salt"]', 420.0, '["eggs"]'),
(3, 'Greek Yogurt Parfait', 'breakfast', '["yogurt", "granola", "berries", "honey"]', 350.0, '["dairy"]'),
(4, 'Grilled Chicken Salad', 'lunch', '["chicken", "lettuce", "tomato", "olive oil"]', 450.0, NULL),
(5, 'Turkey Sandwich', 'lunch', '["bread", "turkey", "cheese", "lettuce", "tomato"]', 520.0, '["dairy"]'),
(6, 'Quinoa Buddha Bowl', 'lunch', '["quinoa", "chickpeas", "avocado", "greens", "tahini"]', 480.0, NULL),
(7, 'Baked Salmon with Vegetables', 'dinner', '["salmon", "broccoli", "carrots", "lemon", "olive oil"]', 580.0, '["fish"]'),
(8, 'Chicken Stir Fry', 'dinner', '["chicken", "rice", "vegetables", "soy sauce"]', 550.0, NULL),
(9, 'Pasta Primavera', 'dinner', '["pasta", "tomatoes", "zucchini", "bell peppers", "parmesan"]', 520.0, '["dairy"]'),
(10, 'Beef Tacos', 'dinner', '["ground beef", "tortillas", "lettuce", "cheese", "salsa"]', 620.0, '["dairy"]');

INSERT OR REPLACE INTO room_metrics (id, temperature, humidity, unit_temp, noise, light, air_quality)
VALUES (1, 72.0, 48.0, 'F', 32.0, 120.0, 88);

INSERT OR REPLACE INTO room (id, name)
VALUES (1, 'Bedroom');
