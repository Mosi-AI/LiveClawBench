-- Seed data for smart-home-thermostat task
-- Focus: Thermostat control and room metrics

-- Room
INSERT INTO room (id, name) VALUES (1, 'Living Room');

-- Room Metrics
INSERT INTO room_metrics (id, temperature, humidity, unit_temp, noise, light, air_quality)
VALUES (1, 72.5, 45.0, 'F', 35.0, 450.0, 85);

-- Thermostat Settings (singleton)
INSERT INTO thermostat_settings (id, mode, temperature, updated_at)
VALUES (1, 'comfort', 72.0, '2026-05-06T08:00:00Z');

-- Coffee Schedule (singleton)
INSERT INTO coffee_schedule (id, start_time, updated_at)
VALUES (1, '07:00', '2026-05-06T08:00:00Z');

-- Benchmark Clock for deterministic time
INSERT INTO benchmark_clock (id, current_time)
VALUES (1, '2026-05-06T08:30:00Z');

-- Inventory (minimal for thermostat task)
INSERT INTO inventory_item (item_name, quantity, unit, location, expiry_date, category) VALUES
('Milk', 2.0, 'gallons', 'fridge', '2026-05-13', 'dairy'),
('Bread', 1.0, 'loaf', 'pantry', '2026-05-10', 'bakery');

-- Grocery Products (minimal)
INSERT INTO grocery_product (product_id, name, price, stock_status) VALUES
('PROD001', 'Organic Milk', 4.99, 'in_stock'),
('PROD002', 'Whole Wheat Bread', 3.49, 'in_stock');

-- Wearable/Recovery State
INSERT INTO wearable_recovery_state (id, sleep_hours, sleep_score, readiness, resting_heart_rate)
VALUES (1, 7.5, 85.0, 78.0, 62.0);

-- Calendar Events
INSERT INTO calendar_event (id, title, start_time, event_type, workout_type, updated_at) VALUES
(1, 'Morning Workout', '2026-05-06T07:00:00Z', 'workout', 'yoga', '2026-05-06T08:00:00Z'),
(2, 'Team Meeting', '2026-05-06T10:00:00Z', 'meeting', NULL, '2026-05-06T08:00:00Z');

-- User Constraints
INSERT INTO user_constraints (id, calorie_target, macro_targets, allergy_constraints, weekly_budget_limit)
VALUES (1, 2000.0, '{"protein": 150, "carbs": 250, "fat": 65}', '[]', 150.0);

-- Recipes
INSERT INTO recipe (id, name, meal_type, ingredients, calories_total, allergens) VALUES
(1, 'Oatmeal with Berries', 'breakfast', '["oats", "milk", "berries", "honey"]', 350.0, '["dairy"]'),
(2, 'Grilled Chicken Salad', 'lunch', '["chicken", "lettuce", "tomato", "olive oil"]', 450.0, NULL),
(3, 'Salmon with Vegetables', 'dinner', '["salmon", "broccoli", "carrots", "lemon"]', 550.0, '["fish"]');
