-- Seed data for grocery-reorder task
-- Focus: Cross-service inventory check and ordering with unit conversion

-- Room
INSERT OR IGNORE INTO room (id, name) VALUES (1, 'Living Room');

-- Room Metrics
INSERT OR IGNORE INTO room_metrics (id, temperature, humidity, unit_temp, noise, light, air_quality)
VALUES (1, 68.5, 52.0, 'F', 25.0, 120.0, 88);

-- Thermostat Settings
INSERT OR IGNORE INTO thermostat_settings (id, mode, temperature, updated_at)
VALUES (1, 'eco', 70.0, '2026-05-12T07:00:00Z');

-- Coffee Schedule
INSERT OR IGNORE INTO coffee_schedule (id, start_time, beans_grams, cancelled, updated_at)
VALUES (1, '07:00', 20, 0, '2026-05-12T06:00:00Z');

-- Benchmark Clock
INSERT OR IGNORE INTO benchmark_clock (id, clock_time)
VALUES (1, '2026-05-12T08:00:00Z');

-- Wearable Recovery State
INSERT OR IGNORE INTO wearable_recovery_state (id, sleep_hours, sleep_score, readiness, resting_heart_rate)
VALUES (1, 7.5, 82.0, 75.0, 58.0);

-- Calendar Events
INSERT OR IGNORE INTO calendar_event (id, title, start_time, event_type, workout_type, updated_at) VALUES
(1, 'Morning Workout', '2026-05-12T08:00:00Z', 'workout', 'yoga', '2026-05-11T20:00:00Z'),
(2, 'Team Standup', '2026-05-12T10:00:00Z', 'meeting', NULL, '2026-05-11T09:00:00Z');

-- User Constraints
INSERT OR IGNORE INTO user_constraints (id, calorie_target, macro_targets, allergy_constraints, weekly_budget_limit)
VALUES (1, 2000.0, '{"protein": 150, "carbs": 250, "fat": 65}', '[]', 150.0);

-- Inventory Items (eggs split across fridge and pantry)
INSERT OR IGNORE INTO inventory_item (item_name, quantity, unit, location, expiry_date, category) VALUES
('Eggs', 11.0, 'pieces', 'fridge', '2026-05-20', 'dairy'),
('Eggs', 7.0, 'pieces', 'pantry', '2026-05-22', 'dairy'),
('Milk', 0.5, 'gallons', 'fridge', '2026-05-15', 'dairy'),
('Bread', 1.0, 'loaf', 'pantry', '2026-05-18', 'bakery'),
('Butter', 0.25, 'lbs', 'fridge', '2026-05-25', 'dairy'),
('Blue Mountain Coffee Beans', 500.0, 'grams', 'pantry', '2026-12-01', 'coffee');  -- coffee beans stock

-- Grocery Products (Shopping List with existing order references)
INSERT OR IGNORE INTO grocery_product (product_id, name, quantity, unit, stock_status, reference) VALUES
('PROD001', 'Organic Whole Milk', 1.0, 'gallon', 'sufficient', 'ORD000001'),
('PROD002', 'Salted Butter', 1.0, 'lb', 'sufficient', 'ORD000002');
