-- Seed data for grocery-budget-plan task
-- Focus: Meal planning with budget and nutrition constraints

-- Room
INSERT INTO room (id, name) VALUES (1, 'Kitchen');

-- Room Metrics
INSERT INTO room_metrics (id, temperature, humidity, unit_temp)
VALUES (1, 71.0, 48.0, 'F');

-- Thermostat Settings
INSERT INTO thermostat_settings (id, mode, temperature, updated_at)
VALUES (1, 'comfort', 70.0, '2026-05-06T08:00:00Z');

-- Coffee Schedule
INSERT INTO coffee_schedule (id, start_time, updated_at)
VALUES (1, '07:30', '2026-05-06T08:00:00Z');

-- Benchmark Clock
INSERT INTO benchmark_clock (id, current_time)
VALUES (1, '2026-05-06T10:00:00Z');

-- Inventory (comprehensive for meal planning)
INSERT INTO inventory_item (item_name, quantity, unit, location, expiry_date, category) VALUES
('Chicken Breast', 2.0, 'lbs', 'fridge', '2026-05-08', 'protein'),
('Salmon Fillet', 1.0, 'lbs', 'fridge', '2026-05-07', 'protein'),
('Ground Beef', 1.5, 'lbs', 'fridge', '2026-05-09', 'protein'),
('Eggs', 18.0, 'count', 'fridge', '2026-05-20', 'protein'),
('Milk', 1.0, 'gallons', 'fridge', '2026-05-13', 'dairy'),
('Greek Yogurt', 4.0, 'cups', 'fridge', '2026-05-11', 'dairy'),
('Cheese', 0.75, 'lbs', 'fridge', '2026-05-25', 'dairy'),
('Spinach', 1.0, 'bags', 'fridge', '2026-05-10', 'produce'),
('Broccoli', 2.0, 'heads', 'fridge', '2026-05-12', 'produce'),
('Carrots', 1.5, 'lbs', 'fridge', '2026-05-18', 'produce'),
('Tomatoes', 6.0, 'count', 'fridge', '2026-05-09', 'produce'),
('Bell Peppers', 4.0, 'count', 'fridge', '2026-05-11', 'produce'),
('Rice', 5.0, 'lbs', 'pantry', '2026-12-01', 'grains'),
('Pasta', 2.0, 'lbs', 'pantry', '2026-12-01', 'grains'),
('Quinoa', 1.0, 'lbs', 'pantry', '2026-12-01', 'grains'),
('Olive Oil', 1.0, 'liters', 'pantry', '2027-01-01', 'condiments'),
('Bread', 1.0, 'loaf', 'pantry', '2026-05-10', 'bakery'),
('Oats', 2.0, 'lbs', 'pantry', '2026-08-01', 'breakfast');

-- Grocery Products (comprehensive for meal planning)
INSERT INTO grocery_product (product_id, name, price, stock_status) VALUES
('PROD001', 'Organic Chicken Breast', 9.99, 'in_stock'),
('PROD002', 'Wild Caught Salmon', 14.99, 'in_stock'),
('PROD003', 'Grass Fed Ground Beef', 11.99, 'in_stock'),
('PROD004', 'Free Range Eggs (18ct)', 8.99, 'in_stock'),
('PROD005', 'Organic Whole Milk', 6.49, 'in_stock'),
('PROD006', 'Plain Greek Yogurt', 6.99, 'in_stock'),
('PROD007', 'Aged Cheddar Cheese', 9.99, 'in_stock'),
('PROD008', 'Baby Spinach', 4.49, 'in_stock'),
('PROD009', 'Fresh Broccoli', 2.99, 'in_stock'),
('PROD010', 'Organic Carrots', 3.99, 'in_stock'),
('PROD011', 'Vine Tomatoes', 4.99, 'in_stock'),
('PROD012', 'Mixed Bell Peppers', 5.99, 'in_stock'),
('PROD013', 'Jasmine Rice', 10.99, 'in_stock'),
('PROD014', 'Italian Pasta', 3.99, 'in_stock'),
('PROD015', 'Organic Quinoa', 7.99, 'in_stock'),
('PROD016', 'Extra Virgin Olive Oil', 14.99, 'in_stock'),
('PROD017', 'Sourdough Bread', 6.99, 'in_stock'),
('PROD018', 'Rolled Oats', 5.99, 'in_stock'),
('PROD019', 'Avocados (3ct)', 5.99, 'low_stock'),
('PROD020', 'Bananas', 2.49, 'in_stock');

-- Wearable/Recovery State
INSERT INTO wearable_recovery_state (id, sleep_hours, sleep_score, readiness, resting_heart_rate)
VALUES (1, 7.0, 80.0, 75.0, 65.0);

-- Calendar Events
INSERT INTO calendar_event (id, title, start_time, event_type, workout_type, updated_at) VALUES
(1, 'Weekly Meal Prep', '2026-05-06T14:00:00Z', 'errand', NULL, '2026-05-06T08:00:00Z'),
(2, 'Evening Yoga', '2026-05-06T18:00:00Z', 'workout', 'yoga', '2026-05-06T08:00:00Z');

-- User Constraints (key focus for this task)
INSERT INTO user_constraints (id, calorie_target, macro_targets, allergy_constraints, weekly_budget_limit)
VALUES (1, 2000.0, '{"protein": 150, "carbs": 250, "fat": 67}', '["shellfish", "peanuts"]', 175.0);

-- Recipes (comprehensive for meal planning)
INSERT INTO recipe (id, name, meal_type, ingredients, calories_total, allergens) VALUES
(1, 'Overnight Oats with Berries', 'breakfast', '["oats", "milk", "berries", "honey"]', 380.0, '["dairy"]'),
(2, 'Greek Yogurt Parfait', 'breakfast', '["yogurt", "granola", "berries", "honey"]', 350.0, '["dairy"]'),
(3, 'Avocado Toast with Egg', 'breakfast', '["bread", "avocado", "eggs", "salt"]', 420.0, NULL),
(4, 'Scrambled Eggs with Spinach', 'breakfast', '["eggs", "spinach", "cheese", "olive oil"]', 320.0, '["dairy"]'),
(5, 'Grilled Chicken Salad', 'lunch', '["chicken", "spinach", "tomatoes", "olive oil"]', 450.0, NULL),
(6, 'Quinoa Buddha Bowl', 'lunch', '["quinoa", "broccoli", "carrots", "chickpeas"]', 480.0, NULL),
(7, 'Pasta Primavera', 'lunch', '["pasta", "tomatoes", "peppers", "olive oil"]', 520.0, NULL),
(8, 'Chicken Rice Bowl', 'lunch', '["chicken", "rice", "broccoli", "soy sauce"]', 550.0, NULL),
(9, 'Baked Salmon with Vegetables', 'dinner', '["salmon", "broccoli", "carrots", "lemon"]', 580.0, '["fish"]'),
(10, 'Beef Stir Fry', 'dinner', '["beef", "broccoli", "peppers", "rice"]', 620.0, NULL),
(11, 'Stuffed Bell Peppers', 'dinner', '["peppers", "beef", "rice", "tomatoes"]', 480.0, NULL),
(12, 'Grilled Chicken with Quinoa', 'dinner', '["chicken", "quinoa", "spinach", "olive oil"]', 520.0, NULL),
(13, 'Vegetable Pasta', 'dinner', '["pasta", "tomatoes", "spinach", "cheese"]', 450.0, '["dairy"]'),
(14, 'Egg Fried Rice', 'dinner', '["rice", "eggs", "carrots", "peas"]', 420.0, NULL);

-- Recipe Nutrition (sample entries for key recipes)
INSERT INTO recipe_nutrition (meal_id, ingredient_name, quantity, unit, calories, protein_g, carbs_g, fat_g) VALUES
(1, 'oats', 0.5, 'cups', 150, 5, 27, 3),
(1, 'milk', 1.0, 'cups', 100, 8, 12, 5),
(1, 'berries', 0.5, 'cups', 40, 1, 10, 0),
(5, 'chicken', 4.0, 'oz', 170, 35, 0, 4),
(5, 'spinach', 2.0, 'cups', 15, 2, 2, 0),
(9, 'salmon', 6.0, 'oz', 350, 40, 0, 20),
(9, 'broccoli', 1.0, 'cups', 55, 4, 11, 1);
