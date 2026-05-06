-- Seed data for grocery-reorder task
-- Focus: Inventory management and grocery ordering

-- Room
INSERT INTO room (id, name) VALUES (1, 'Kitchen');

-- Room Metrics
INSERT INTO room_metrics (id, temperature, humidity, unit_temp)
VALUES (1, 70.0, 50.0, 'F');

-- Thermostat Settings
INSERT INTO thermostat_settings (id, mode, temperature, updated_at)
VALUES (1, 'eco', 68.0, '2026-05-06T08:00:00Z');

-- Coffee Schedule
INSERT INTO coffee_schedule (id, start_time, updated_at)
VALUES (1, '06:30', '2026-05-06T08:00:00Z');

-- Benchmark Clock
INSERT INTO benchmark_clock (id, current_time)
VALUES (1, '2026-05-06T09:00:00Z');

-- Inventory (comprehensive for grocery task)
INSERT INTO inventory_item (item_name, quantity, unit, location, expiry_date, category) VALUES
('Milk', 0.5, 'gallons', 'fridge', '2026-05-08', 'dairy'),
('Eggs', 6.0, 'count', 'fridge', '2026-05-15', 'protein'),
('Butter', 0.25, 'lbs', 'fridge', '2026-05-20', 'dairy'),
('Cheese', 0.5, 'lbs', 'fridge', '2026-05-25', 'dairy'),
('Yogurt', 2.0, 'cups', 'fridge', '2026-05-10', 'dairy'),
('Apples', 4.0, 'count', 'fridge', '2026-05-12', 'produce'),
('Carrots', 1.0, 'lbs', 'fridge', '2026-05-18', 'produce'),
('Bread', 0.5, 'loaf', 'pantry', '2026-05-09', 'bakery'),
('Rice', 2.0, 'lbs', 'pantry', '2026-12-01', 'grains'),
('Pasta', 1.0, 'lbs', 'pantry', '2026-12-01', 'grains'),
('Olive Oil', 0.5, 'liters', 'pantry', '2027-01-01', 'condiments'),
('Cereal', 0.25, 'boxes', 'pantry', '2026-05-20', 'breakfast');

-- Grocery Products (comprehensive)
INSERT INTO grocery_product (product_id, name, price, stock_status) VALUES
('PROD001', 'Organic Whole Milk', 5.99, 'in_stock'),
('PROD002', 'Free Range Eggs (12ct)', 6.49, 'in_stock'),
('PROD003', 'Salted Butter', 4.99, 'in_stock'),
('PROD004', 'Sharp Cheddar Cheese', 7.99, 'in_stock'),
('PROD005', 'Greek Yogurt', 5.49, 'in_stock'),
('PROD006', 'Gala Apples (6ct)', 4.99, 'in_stock'),
('PROD007', 'Organic Carrots', 3.49, 'in_stock'),
('PROD008', 'Whole Wheat Bread', 4.29, 'low_stock'),
('PROD009', 'Jasmine Rice', 8.99, 'in_stock'),
('PROD010', 'Penne Pasta', 2.99, 'in_stock'),
('PROD011', 'Extra Virgin Olive Oil', 12.99, 'in_stock'),
('PROD012', 'Granola Cereal', 6.99, 'out_of_stock'),
('PROD013', 'Almond Milk', 4.49, 'in_stock'),
('PROD014', 'Orange Juice', 5.99, 'in_stock');

-- Substitution mappings
INSERT INTO substitution_mapping (original_item, substitute_item, substitution_ratio, category) VALUES
('Granola Cereal', 'Oatmeal', 1.0, 'breakfast'),
('Whole Wheat Bread', 'Sourdough Bread', 1.0, 'bakery');

-- Wearable/Recovery State
INSERT INTO wearable_recovery_state (id, sleep_hours, sleep_score, readiness, resting_heart_rate)
VALUES (1, 6.5, 72.0, 65.0, 68.0);

-- Calendar Events
INSERT INTO calendar_event (id, title, start_time, event_type, workout_type, updated_at) VALUES
(1, 'Grocery Shopping', '2026-05-06T10:00:00Z', 'errand', NULL, '2026-05-06T08:00:00Z');

-- User Constraints
INSERT INTO user_constraints (id, calorie_target, macro_targets, allergy_constraints, weekly_budget_limit)
VALUES (1, 2200.0, '{"protein": 165, "carbs": 275, "fat": 73}', '["nuts"]', 200.0);

-- Recipes
INSERT INTO recipe (id, name, meal_type, ingredients, calories_total, allergens) VALUES
(1, 'Scrambled Eggs with Toast', 'breakfast', '["eggs", "bread", "butter"]', 350.0, '["dairy"]'),
(2, 'Pasta Primavera', 'lunch', '["pasta", "tomato", "olive oil", "vegetables"]', 500.0, NULL),
(3, 'Rice Bowl with Vegetables', 'dinner', '["rice", "vegetables", "olive oil"]', 450.0, NULL);
