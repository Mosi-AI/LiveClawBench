-- Seed data for smarthome-test task
-- Focus: Morning routine automation scenario

-- Room
INSERT INTO room (id, name) VALUES (1, 'Living Room');

-- Room Metrics (morning conditions)
INSERT INTO room_metrics (id, temperature, humidity, unit_temp, noise, light, air_quality)
VALUES (1, 68.5, 52.0, 'F', 25.0, 120.0, 88);

-- Thermostat Settings (current state - eco mode, lower temp)
INSERT INTO thermostat_settings (id, mode, temperature, updated_at)
VALUES (1, 'eco', 70.0, '2026-05-09T06:00:00Z');

-- Coffee Schedule
INSERT INTO coffee_schedule (id, start_time, updated_at)
VALUES (1, '07:00', '2026-05-09T06:00:00Z');

-- Benchmark Clock (morning time)
INSERT INTO benchmark_clock (id, clock_time)
VALUES (1, '2026-05-09T07:30:00Z');

-- Inventory (some items low)
INSERT INTO inventory_item (item_name, quantity, unit, location, expiry_date, category) VALUES
('Milk', 0.5, 'gallons', 'fridge', '2026-05-11', 'dairy'),
('Bread', 1.0, 'loaf', 'pantry', '2026-05-12', 'bakery'),
('Eggs', 6.0, 'pieces', 'fridge', '2026-05-15', 'dairy'),
('Butter', 0.25, 'lbs', 'fridge', '2026-05-20', 'dairy'),
('Orange Juice', 1.0, 'gallons', 'fridge', '2026-05-14', 'beverage'),
('Cereal', 1.0, 'box', 'pantry', '2026-06-01', 'breakfast'),
('Chicken Breast', 2.0, 'lbs', 'fridge', '2026-05-10', 'meat'),
('Rice', 5.0, 'lbs', 'pantry', '2026-08-01', 'grains'),
('Pasta', 2.0, 'lbs', 'pantry', '2026-09-01', 'grains'),
('Tomatoes', 4.0, 'pieces', 'fridge', '2026-05-12', 'vegetables');

-- Grocery Products
INSERT INTO grocery_product (product_id, name, price, stock_status) VALUES
('PROD001', 'Organic Whole Milk', 5.99, 'in_stock'),
('PROD002', 'Sourdough Bread', 4.49, 'in_stock'),
('PROD003', 'Free Range Eggs (12 pack)', 6.99, 'in_stock'),
('PROD004', 'Salted Butter', 4.29, 'in_stock'),
('PROD005', 'Fresh Salmon Fillet', 12.99, 'in_stock'),
('PROD006', 'Mixed Salad Greens', 3.99, 'in_stock'),
('PROD007', 'Greek Yogurt', 5.49, 'in_stock'),
('PROD008', 'Granola', 4.99, 'in_stock');

-- Wearable/Recovery State (good sleep last night)
INSERT INTO wearable_recovery_state (id, sleep_hours, sleep_score, readiness, resting_heart_rate)
VALUES (1, 7.5, 82.0, 75.0, 58.0);

-- Calendar Events (today's schedule)
INSERT INTO calendar_event (id, title, start_time, event_type, workout_type, updated_at) VALUES
(1, 'Morning Workout', '2026-05-09T08:00:00Z', 'workout', 'yoga', '2026-05-08T20:00:00Z'),
(2, 'Team Standup', '2026-05-09T10:00:00Z', 'meeting', NULL, '2026-05-08T09:00:00Z'),
(3, 'Lunch with Client', '2026-05-09T12:30:00Z', 'meeting', NULL, '2026-05-07T14:00:00Z'),
(4, 'Project Review', '2026-05-09T15:00:00Z', 'meeting', NULL, '2026-05-06T10:00:00Z');

-- User Constraints (dietary preferences)
INSERT INTO user_constraints (id, calorie_target, macro_targets, allergy_constraints, weekly_budget_limit)
VALUES (1, 2000.0, '{"protein": 150, "carbs": 250, "fat": 65}', '["shellfish"]', 150.0);

-- Recipes (available for meal planning)
INSERT INTO recipe (id, name, meal_type, ingredients, calories_total, allergens) VALUES
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
