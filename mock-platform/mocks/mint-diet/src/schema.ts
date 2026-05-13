import type { Database } from "bun:sqlite";

export function createTables(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS food_catalog (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL,
      serving_size_value REAL  NOT NULL,
      serving_size_unit  TEXT  NOT NULL,
      calories_kcal    REAL,
      protein_g        REAL,
      carbs_g          REAL,
      fat_g            REAL,
      created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
      updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS daily_log (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      log_date             TEXT    NOT NULL UNIQUE,
      calorie_budget_kcal  REAL    NOT NULL DEFAULT 1500,
      total_calories_kcal  REAL    NOT NULL DEFAULT 0,
      total_protein_g      REAL    NOT NULL DEFAULT 0,
      total_carbs_g        REAL    NOT NULL DEFAULT 0,
      total_fat_g          REAL    NOT NULL DEFAULT 0,
      created_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
      updated_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS food_entry (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      daily_log_id    INTEGER NOT NULL REFERENCES daily_log(id) ON DELETE CASCADE,
      food_catalog_id INTEGER REFERENCES food_catalog(id) ON DELETE SET NULL,
      meal_slot       TEXT    NOT NULL CHECK (meal_slot IN ('breakfast','lunch','dinner','snacks')),
      food_name       TEXT    NOT NULL,
      quantity_value  REAL    NOT NULL,
      quantity_unit   TEXT    NOT NULL,
      calories_kcal   REAL    NOT NULL DEFAULT 0,
      protein_g       REAL    NOT NULL DEFAULT 0,
      carbs_g         REAL    NOT NULL DEFAULT 0,
      fat_g           REAL    NOT NULL DEFAULT 0,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
      updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS meal_plan (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      title               TEXT    NOT NULL,
      start_date          TEXT    NOT NULL,
      end_date            TEXT    NOT NULL,
      status              TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
      target_calories_kcal REAL,
      notes               TEXT,
      created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
      updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS meal_plan_day (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_plan_id  INTEGER NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,
      plan_date     TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
      updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
      UNIQUE (meal_plan_id, plan_date)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS meal_plan_item (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_plan_day_id INTEGER NOT NULL REFERENCES meal_plan_day(id) ON DELETE CASCADE,
      meal_slot       TEXT    NOT NULL CHECK (meal_slot IN ('breakfast','lunch','dinner')),
      dish_name       TEXT    NOT NULL,
      notes           TEXT,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
      updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ingredient_item (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_plan_id  INTEGER NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,
      name          TEXT    NOT NULL,
      quantity_value REAL   NOT NULL DEFAULT 0,
      quantity_unit  TEXT   NOT NULL DEFAULT 'g',
      notes         TEXT,
      created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')),
      updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
    )
  `);

  // Indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_food_entry_slot ON food_entry(daily_log_id, meal_slot, sort_order)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_food_catalog_name ON food_catalog(name COLLATE NOCASE)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_meal_plan_dates ON meal_plan(start_date, end_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ingredient_plan ON ingredient_item(meal_plan_id)`);

  // Triggers: maintain daily_log.total_* on food_entry mutations
  db.run(`
    CREATE TRIGGER IF NOT EXISTS trg_entry_after_insert
    AFTER INSERT ON food_entry BEGIN
      UPDATE daily_log
      SET total_calories_kcal = (SELECT COALESCE(SUM(calories_kcal), 0) FROM food_entry WHERE daily_log_id = NEW.daily_log_id),
          total_protein_g     = (SELECT COALESCE(SUM(protein_g),     0) FROM food_entry WHERE daily_log_id = NEW.daily_log_id),
          total_carbs_g       = (SELECT COALESCE(SUM(carbs_g),       0) FROM food_entry WHERE daily_log_id = NEW.daily_log_id),
          total_fat_g         = (SELECT COALESCE(SUM(fat_g),         0) FROM food_entry WHERE daily_log_id = NEW.daily_log_id),
          updated_at          = strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')
      WHERE id = NEW.daily_log_id;
    END
  `);

  db.run(`
    CREATE TRIGGER IF NOT EXISTS trg_entry_after_update
    AFTER UPDATE ON food_entry BEGIN
      UPDATE daily_log
      SET total_calories_kcal = (SELECT COALESCE(SUM(calories_kcal), 0) FROM food_entry WHERE daily_log_id = NEW.daily_log_id),
          total_protein_g     = (SELECT COALESCE(SUM(protein_g),     0) FROM food_entry WHERE daily_log_id = NEW.daily_log_id),
          total_carbs_g       = (SELECT COALESCE(SUM(carbs_g),       0) FROM food_entry WHERE daily_log_id = NEW.daily_log_id),
          total_fat_g         = (SELECT COALESCE(SUM(fat_g),         0) FROM food_entry WHERE daily_log_id = NEW.daily_log_id),
          updated_at          = strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')
      WHERE id = NEW.daily_log_id;
    END
  `);

  db.run(`
    CREATE TRIGGER IF NOT EXISTS trg_entry_after_delete
    AFTER DELETE ON food_entry BEGIN
      UPDATE daily_log
      SET total_calories_kcal = (SELECT COALESCE(SUM(calories_kcal), 0) FROM food_entry WHERE daily_log_id = OLD.daily_log_id),
          total_protein_g     = (SELECT COALESCE(SUM(protein_g),     0) FROM food_entry WHERE daily_log_id = OLD.daily_log_id),
          total_carbs_g       = (SELECT COALESCE(SUM(carbs_g),       0) FROM food_entry WHERE daily_log_id = OLD.daily_log_id),
          total_fat_g         = (SELECT COALESCE(SUM(fat_g),         0) FROM food_entry WHERE daily_log_id = OLD.daily_log_id),
          updated_at          = strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')
      WHERE id = OLD.daily_log_id;
    END
  `);
}
