-- Seed data for smart-home-sleep-quality task
-- Focus: Cross-service health data sync, thermostat adjustment, and sleep aid ordering

-- Benchmark Clock (today = 2026-05-09)
INSERT OR IGNORE INTO benchmark_clock (id, clock_time)
VALUES (1, '2026-05-09T08:00:00Z');

-- Thermostat Settings (initial: 72°F, will be adjusted to 68°F)
INSERT OR IGNORE INTO thermostat_settings (id, mode, temperature, updated_at)
VALUES (1, 'comfort', 72.0, '2026-05-09T07:00:00Z');

-- Wearable Recovery State (initial: unsynced, all fields = 0)
-- Agent must sync from health-mock and calculate readiness
INSERT OR IGNORE INTO wearable_recovery_state (id, sleep_hours, sleep_score, readiness, resting_heart_rate)
VALUES (1, 0.0, 0.0, 0.0, 0.0);

-- Inventory Items
INSERT OR IGNORE INTO inventory_item (id, item_name, quantity, unit, location, expiry_date, category) VALUES
(1, 'Melatonin 5mg', 0.0, 'tablets', 'pantry', '2026-12-01', 'Supplements'),
(2, 'Greek Yogurt', 2.0, 'cups', 'fridge', '2026-05-12', 'Dairy'),
(3, 'Baby Spinach', 1.0, 'bag', 'fridge', '2026-05-11', 'Produce'),
(4, 'Eggs', 12.0, 'count', 'fridge', '2026-05-20', 'Protein'),
(5, 'Rolled Oats', 1.0, 'bag', 'pantry', '2026-11-01', 'Grains'),
(6, 'Chamomile Tea', 10.0, 'bags', 'pantry', '2027-01-15', 'Beverages'),
(7, 'Almond Butter', 1.0, 'jar', 'pantry', '2026-10-10', 'Spreads');

-- Grocery Products (existing entries with order references for pattern inference)
INSERT OR IGNORE INTO grocery_product (product_id, name, quantity, unit, stock_status, reference) VALUES
('PROD001', 'Organic Whole Milk', 1.0, 'gallon', 'sufficient', 'ORD000001'),
('PROD002', 'Salted Butter', 1.0, 'lb', 'sufficient', 'ORD000002'),
('PROD003', 'Fresh Orange Juice', 1.0, 'gallon', 'sufficient', 'ORD000003');

-- Calendar Events (sample events for today)
INSERT OR IGNORE INTO calendar_event (id, title, start_time, event_type, workout_type, status, updated_at) VALUES
(1, 'Morning Routine', '2026-05-09T07:00:00Z', 'routine', NULL, 'undone', '2026-05-08T20:00:00Z'),
(2, 'Team Meeting', '2026-05-09T10:00:00Z', 'meeting', NULL, 'undone', '2026-05-08T09:00:00Z');

-- Room Metrics
INSERT OR IGNORE INTO room_metrics (id, temperature, humidity, unit_temp, noise, light, air_quality)
VALUES (1, 72.0, 55.0, 'F', 30.0, 150.0, 85);

-- Room
INSERT OR IGNORE INTO room (id, name) VALUES (1, 'Bedroom');

-- Coffee Schedule
INSERT OR IGNORE INTO coffee_schedule (id, start_time, beans_grams, cancelled, updated_at)
VALUES (1, '07:00', 20, 0, '2026-05-09T06:00:00Z');

-- User Constraints
INSERT OR IGNORE INTO user_constraints (id, calorie_target, macro_targets, allergy_constraints, weekly_budget_limit)
VALUES (1, 2000.0, '{"protein": 150, "carbs": 250, "fat": 65}', '[]', 150.0);
