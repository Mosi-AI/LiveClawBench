INSERT OR REPLACE INTO benchmark_clock (id, clock_time)
VALUES (1, '2026-05-09T07:45:00Z');

INSERT OR REPLACE INTO thermostat_settings (id, mode, temperature, updated_at)
VALUES (1, 'comfort', 72.0, '2026-05-09T06:30:00Z');

INSERT OR REPLACE INTO coffee_schedule (schedule_date, start_time, beans_grams, cancelled, updated_at) VALUES
('2026-05-03', '07:00', 20, 0, '2026-05-03T06:00:00Z'),
('2026-05-04', '07:00', 20, 0, '2026-05-04T06:00:00Z'),
('2026-05-05', '07:00', 20, 0, '2026-05-05T06:00:00Z'),
('2026-05-06', '07:00', 20, 0, '2026-05-06T06:00:00Z'),
('2026-05-07', '07:00', 20, 0, '2026-05-07T06:00:00Z'),
('2026-05-08', '07:00', 20, 0, '2026-05-08T06:00:00Z'),
('2026-05-09', '07:00', 20, 0, '2026-05-09T06:00:00Z'),
('2026-05-10', '07:00', 20, 0, '2026-05-09T06:00:00Z');

INSERT OR REPLACE INTO calendar_event (id, title, start_time, event_type, workout_type, status, updated_at) VALUES
(1, 'Online Daily Sync', '2026-05-09T09:00:00Z', 'work', NULL, 'undone', '2026-05-08T20:00:00Z'),
(2, 'Today Recovery Walk', '2026-05-09T18:30:00Z', 'workout', 'walking', 'undone', '2026-05-08T20:00:00Z'),
(3, 'HIIT Workout', '2026-05-10T12:00:00Z', 'workout', 'hiit', 'undone', '2026-05-08T20:00:00Z'),
(4, 'Team Meeting', '2026-05-10T14:00:00Z', 'meeting', NULL, 'undone', '2026-05-08T20:00:00Z'),
(5, 'Online Daily Sync', '2026-05-10T09:00:00Z', 'work', NULL, 'undone', '2026-05-08T20:00:00Z'),
(6, 'Sprint Intervals', '2026-05-10T17:30:00Z', 'workout', 'hiit', 'undone', '2026-05-08T20:00:00Z'),
(7, 'Boxing Conditioning', '2026-05-10T19:00:00Z', 'workout', 'strength', 'undone', '2026-05-08T20:00:00Z');

INSERT OR REPLACE INTO wearable_recovery_state (id, sleep_hours, sleep_score, readiness, resting_heart_rate)
VALUES (1, 0, 0, 0, 0);

INSERT OR REPLACE INTO inventory_item (id, item_name, quantity, unit, location, expiry_date, category, updated_at) VALUES
(1, 'Ethiopian Yirgacheffe Coffee Beans', 220.0, 'grams', 'pantry', '2026-09-30', 'coffee', '2026-05-08T18:20:00Z'),
(2, 'Decaf Colombian Coffee Beans', 80.0, 'grams', 'pantry', '2026-08-15', 'coffee', '2026-05-07T19:10:00Z'),
(3, 'Chamomile Tea', 18.0, 'bags', 'pantry', '2027-01-15', 'beverage', '2026-05-01T12:00:00Z'),
(4, 'Electrolyte Tablets', 6.0, 'tablets', 'pantry', '2026-08-01', 'recovery', '2026-05-06T21:30:00Z'),
(5, 'Rolled Oats', 1.0, 'bag', 'pantry', '2026-11-01', 'breakfast', '2026-04-28T10:15:00Z'),
(6, 'Greek Yogurt', 2.0, 'cups', 'fridge', '2026-05-12', 'protein', '2026-05-08T17:40:00Z'),
(7, 'Eggs', 10.0, 'count', 'fridge', '2026-05-20', 'protein', '2026-05-03T09:30:00Z'),
(8, 'Baby Spinach', 1.0, 'bag', 'fridge', '2026-05-11', 'produce', '2026-05-08T17:45:00Z'),
(9, 'Bananas', 4.0, 'count', 'pantry', '2026-05-13', 'produce', '2026-05-08T17:50:00Z'),
(10, 'Tart Cherry Juice', 1.0, 'bottle', 'fridge', '2026-05-18', 'recovery', '2026-05-07T20:00:00Z'),
(11, 'Lavender Linen Spray', 1.0, 'bottle', 'pantry', '2027-03-01', 'comfort', '2026-04-25T16:00:00Z'),
(12, 'Whole Grain Bread', 0.5, 'loaf', 'pantry', '2026-05-10', 'breakfast', '2026-05-08T07:20:00Z');

INSERT OR REPLACE INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES
('PROD101', 'Ethiopian Yirgacheffe Coffee Beans', 250.0, 'grams', 'sufficient', NULL, 'ORD-COF-118'),
('PROD102', 'Chamomile Tea', 20.0, 'bags', 'sufficient', NULL, 'ORD-TEA-042'),
('PROD103', 'Greek Yogurt', 4.0, 'cups', 'sufficient', NULL, 'ORD-DAI-207'),
('PROD104', 'Tart Cherry Juice', 1.0, 'bottle', 'sufficient', NULL, 'ORD-REC-031');

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
