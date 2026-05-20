-- Seed data for morning-comfort-setup task
-- Focus: A2 contaminated state - humidity sensor malfunction caused thermostat corruption
-- B1 implicit goals: diagnose causal link, infer coffee timing, cross-reference inventory

-- Room
INSERT OR IGNORE INTO room (id, name) VALUES (1, 'Living Room');

-- Room Metrics (A2 contaminated state - sensor malfunction)
-- humidity=999% is physically impossible, indicates sensor malfunction
-- temperature=86°F is elevated, supporting "something feels off" instruction
INSERT OR IGNORE INTO room_metrics (id, temperature, humidity, unit_temp, noise, light, air_quality)
VALUES (1, 86.0, 999.0, 'F', 25.0, 120.0, 88);

-- Thermostat Settings (A2 contaminated state - both fields corrupted by sensor malfunction)
-- humidity=999% caused thermostat to auto-trigger protection: mode=off AND temperature=95°F
-- Agent must fix BOTH fields (mode='comfort' AND temperature in 72-77 range)
INSERT OR IGNORE INTO thermostat_settings (id, mode, temperature, updated_at)
VALUES (1, 'off', 95.0, '2026-05-09T06:00:00Z');

-- Coffee Schedule (B1 implicit goal - timing inference required)
-- start_time='08:00' is too late for 7am departure
-- Agent must read brew_duration (30 min) from UI and infer start_time <= 06:30
INSERT OR IGNORE INTO coffee_schedule (id, start_time, beans_grams, cancelled, updated_at)
VALUES (1, '08:00', 20, 0, '2026-05-09T06:00:00Z');

-- Benchmark Clock (morning time)
INSERT OR IGNORE INTO benchmark_clock (id, clock_time)
VALUES (1, '2026-05-09T07:30:00Z');

-- Inventory (B1 implicit goal - cross-reference inference required)
-- Fridge: Blue Mountain Coffee Beans - all expired before benchmark date
-- Pantry: Kenya AA - quantity=12g (insufficient for 20g brew), name does NOT include "coffee"
--         Agent must cross-reference Coffee Machine page to confirm it is a coffee bean in use
INSERT OR IGNORE INTO inventory_item (item_name, quantity, unit, location, expiry_date, category) VALUES
-- Fridge items (coffee beans - all expired)
('Blue Mountain Coffee Beans', 100.0, 'grams', 'fridge', '2026-05-01', 'coffee'),  -- expired 8 days ago
('Blue Mountain Coffee Beans', 150.0, 'grams', 'fridge', '2026-05-05', 'coffee'),  -- expired 4 days ago
-- Pantry items
('Kenya AA', 12.0, 'grams', 'pantry', '2026-12-01', 'coffee'),  -- insufficient quantity, name doesn't include "coffee"
-- Distractor items
('Milk', 0.5, 'gallons', 'fridge', '2026-05-15', 'dairy'),
('Bread', 1.0, 'loaf', 'pantry', '2026-05-20', 'bakery'),
('Eggs', 6.0, 'pieces', 'fridge', '2026-05-18', 'dairy'),
('Butter', 0.25, 'lbs', 'fridge', '2026-05-25', 'dairy'),
('Rice', 5.0, 'lbs', 'pantry', '2026-08-01', 'grains'),
('Pasta', 2.0, 'lbs', 'pantry', '2026-09-01', 'grains');

-- Grocery Products (requirement list format: quantity + unit)
-- 2-3 distractor entries (existing items that must not be modified)
INSERT OR IGNORE INTO grocery_product (product_id, name, quantity, unit, stock_status) VALUES
('PROD001', 'Organic Whole Milk', 1.0, 'gallon', 'sufficient'),
('PROD002', 'Sourdough Bread', 1.0, 'loaf', 'sufficient'),
('PROD003', 'Eggs', 12.0, 'pieces', 'sufficient');

-- Wearable/Recovery State (good sleep last night)
INSERT OR IGNORE INTO wearable_recovery_state (id, sleep_hours, sleep_score, readiness, resting_heart_rate)
VALUES (1, 7.5, 82.0, 75.0, 58.0);

-- Calendar Events (today's schedule - no workout to avoid overlap with smarthome-test)
INSERT OR IGNORE INTO calendar_event (id, title, start_time, event_type, workout_type, updated_at) VALUES
(1, 'Team Standup', '2026-05-09T10:00:00Z', 'meeting', NULL, '2026-05-08T09:00:00Z'),
(2, 'Lunch with Client', '2026-05-09T12:30:00Z', 'meeting', NULL, '2026-05-07T14:00:00Z'),
(3, 'Project Review', '2026-05-09T15:00:00Z', 'meeting', NULL, '2026-05-06T10:00:00Z');

-- User Constraints (dietary preferences)
INSERT OR IGNORE INTO user_constraints (id, calorie_target, macro_targets, allergy_constraints, weekly_budget_limit)
VALUES (1, 2000.0, '{"protein": 150, "carbs": 250, "fat": 65}', '["shellfish"]', 150.0);

-- Recipes (available for meal planning)
INSERT OR IGNORE INTO recipe (id, name, meal_type, ingredients, calories_total, allergens) VALUES
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
