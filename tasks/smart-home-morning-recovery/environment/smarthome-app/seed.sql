-- Seed data for smart-home-morning-recovery task
-- Focus: Wearable/recovery data and morning routine optimization

-- Room
INSERT INTO room (id, name) VALUES (1, 'Bedroom');

-- Room Metrics
INSERT INTO room_metrics (id, temperature, humidity, unit_temp, noise, light, air_quality)
VALUES (1, 68.0, 55.0, 'F', 25.0, 100.0, 90);

-- Thermostat Settings
INSERT INTO thermostat_settings (id, mode, temperature, updated_at)
VALUES (1, 'eco', 68.0, '2026-05-06T06:00:00Z');

-- Coffee Schedule
INSERT INTO coffee_schedule (id, start_time, updated_at)
VALUES (1, '06:30', '2026-05-06T06:00:00Z');

-- Benchmark Clock
INSERT INTO benchmark_clock (id, current_time)
VALUES (1, '2026-05-06T06:45:00Z');

-- Inventory
INSERT INTO inventory_item (item_name, quantity, unit, location, expiry_date, category) VALUES
('Coffee Beans', 1.0, 'lbs', 'pantry', '2026-06-01', 'beverages'),
('Milk', 1.0, 'gallons', 'fridge', '2026-05-13', 'dairy'),
('Orange Juice', 0.5, 'gallons', 'fridge', '2026-05-10', 'beverages'),
('Eggs', 12.0, 'count', 'fridge', '2026-05-20', 'protein'),
('Bread', 1.0, 'loaf', 'pantry', '2026-05-12', 'bakery');

-- Grocery Products
INSERT INTO grocery_product (product_id, name, price, stock_status) VALUES
('PROD001', 'Premium Coffee Beans', 14.99, 'in_stock'),
('PROD002', 'Organic Milk', 5.99, 'in_stock'),
('PROD003', 'Fresh Orange Juice', 6.99, 'in_stock'),
('PROD004', 'Free Range Eggs', 7.49, 'in_stock'),
('PROD005', 'Artisan Bread', 5.99, 'in_stock');

-- Wearable/Recovery State (key focus for this task)
INSERT INTO wearable_recovery_state (id, sleep_hours, sleep_score, readiness, resting_heart_rate)
VALUES (1, 5.5, 58.0, 45.0, 72.0);

-- Calendar Events (morning workout)
INSERT INTO calendar_event (id, title, start_time, event_type, workout_type, updated_at) VALUES
(1, 'Morning HIIT Workout', '2026-05-06T07:00:00Z', 'workout', 'hiit', '2026-05-06T06:00:00Z'),
(2, 'Breakfast', '2026-05-06T08:00:00Z', 'meal', NULL, '2026-05-06T06:00:00Z'),
(3, 'Work Start', '2026-05-06T09:00:00Z', 'work', NULL, '2026-05-06T06:00:00Z');

-- User Constraints
INSERT INTO user_constraints (id, calorie_target, macro_targets, allergy_constraints, weekly_budget_limit)
VALUES (1, 1800.0, '{"protein": 135, "carbs": 225, "fat": 60}', '[]', 100.0);

-- Recipes (breakfast focused)
INSERT INTO recipe (id, name, meal_type, ingredients, calories_total, allergens) VALUES
(1, 'Energizing Smoothie', 'breakfast', '["banana", "spinach", "protein powder", "almond milk"]', 300.0, '["nuts"]'),
(2, 'Avocado Toast', 'breakfast', '["bread", "avocado", "eggs", "salt"]', 400.0, NULL),
(3, 'Overnight Oats', 'breakfast', '["oats", "milk", "berries", "honey"]', 350.0, '["dairy"]'),
(4, 'Light Salad', 'lunch', '["lettuce", "tomato", "cucumber", "olive oil"]', 200.0, NULL),
(5, 'Grilled Fish', 'dinner', '["fish", "lemon", "herbs", "vegetables"]', 400.0, '["fish"]');
