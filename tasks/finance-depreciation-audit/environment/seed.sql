-- Asset records with incorrect depreciation values.
-- Runs AFTER default seed, which inserts 5 assets (ids 1-5).
-- We clear defaults and inject our contaminated set of 7 assets.

DELETE FROM asset_record;
DELETE FROM sqlite_sequence WHERE name = 'asset_record';

-- Asset 1: CORRECT - Server Rack A, straight_line, (50000-5000)/5 = 9000
INSERT INTO asset_record (asset_name, cost_basis, residual_value, useful_life_years, depreciation_method, annual_depreciation)
VALUES ('Server Rack A', 50000.0, 5000.0, 5, 'straight_line', 9000.0);

-- Asset 2: WRONG - Laptop Fleet, straight_line, (80000-8000)/4 = 18000, but recorded as 25000
INSERT INTO asset_record (asset_name, cost_basis, residual_value, useful_life_years, depreciation_method, annual_depreciation)
VALUES ('Laptop Fleet', 80000.0, 8000.0, 4, 'straight_line', 25000.0);

-- Asset 3: CORRECT - Office Furniture, straight_line, (30000-3000)/10 = 2700
INSERT INTO asset_record (asset_name, cost_basis, residual_value, useful_life_years, depreciation_method, annual_depreciation)
VALUES ('Office Furniture', 30000.0, 3000.0, 10, 'straight_line', 2700.0);

-- Asset 4: WRONG - Company Vehicle, declining_balance, rate = 2/6 = 33.3%, 60000*0.333 = 20000, but recorded as 10000
INSERT INTO asset_record (asset_name, cost_basis, residual_value, useful_life_years, depreciation_method, annual_depreciation)
VALUES ('Company Vehicle', 60000.0, 10000.0, 6, 'declining_balance', 10000.0);

-- Asset 5: CORRECT - Network Equipment, straight_line, (25000-2500)/5 = 4500
INSERT INTO asset_record (asset_name, cost_basis, residual_value, useful_life_years, depreciation_method, annual_depreciation)
VALUES ('Network Equipment', 25000.0, 2500.0, 5, 'straight_line', 4500.0);

-- Asset 6: WRONG - Backup Generator, straight_line, (40000-4000)/8 = 4500, but recorded as 8000
INSERT INTO asset_record (asset_name, cost_basis, residual_value, useful_life_years, depreciation_method, annual_depreciation)
VALUES ('Backup Generator', 40000.0, 4000.0, 8, 'straight_line', 8000.0);

-- Asset 7: CORRECT - Conference Room AV, straight_line, (15000-1500)/5 = 2700
INSERT INTO asset_record (asset_name, cost_basis, residual_value, useful_life_years, depreciation_method, annual_depreciation)
VALUES ('Conference Room AV', 15000.0, 1500.0, 5, 'straight_line', 2700.0);
