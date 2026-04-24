// covers multiple pure helpers: scaleMacros and isValidLocalDate, both sourced from this file
import type { Database } from "bun:sqlite";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface DailyLog {
  id: number;
  log_date: string;
  calorie_budget_kcal: number;
  total_calories_kcal: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  created_at: string;
  updated_at: string;
}

export interface FoodCatalog {
  id: number;
  name: string;
  serving_size_value: number;
  serving_size_unit: string;
  calories_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

export interface FoodEntry {
  id: number;
  daily_log_id: number;
  food_catalog_id: number | null;
  meal_slot: string;
  food_name: string;
  quantity_value: number;
  quantity_unit: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sort_order: number;
}

export interface MealPlan {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
  target_calories_kcal: number | null;
  notes: string | null;
}

export interface MealPlanDay {
  id: number;
  meal_plan_id: number;
  plan_date: string;
}

export interface MealPlanItem {
  id: number;
  meal_plan_day_id: number;
  meal_slot: string;
  dish_name: string;
  notes: string | null;
  sort_order: number;
}

export interface IngredientItem {
  id: number;
  meal_plan_id: number;
  name: string;
  quantity_value: number;
  quantity_unit: string;
  notes: string | null;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface EffectiveBudget {
  budget: number;
  source: "plan" | "daily_log" | "default";
  planId?: number;
  planTitle?: string;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function scaleMacros(catalog: FoodCatalog, quantityValue: number, quantityUnit: string): Macros {
  const factor = quantityUnit === "份"
    ? quantityValue
    : quantityValue / (catalog.serving_size_value || 1);
  return {
    calories: (catalog.calories_kcal ?? 0) * factor,
    protein:  (catalog.protein_g     ?? 0) * factor,
    carbs:    (catalog.carbs_g        ?? 0) * factor,
    fat:      (catalog.fat_g          ?? 0) * factor,
  };
}

export function isValidLocalDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// ---------------------------------------------------------------------------
// daily_log helpers
// ---------------------------------------------------------------------------

export function ensureDailyLog(db: Database, date: string): DailyLog {
  db.prepare("INSERT OR IGNORE INTO daily_log (log_date) VALUES (?)").run(date);
  return db.query("SELECT * FROM daily_log WHERE log_date = ?").get(date) as DailyLog;
}

export function listEntriesByDay(db: Database, dailyLogId: number): FoodEntry[] {
  return db.query(
    "SELECT * FROM food_entry WHERE daily_log_id = ? ORDER BY meal_slot, sort_order, id"
  ).all(dailyLogId) as FoodEntry[];
}

export interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function computeDailyTotals(db: Database, dailyLogId: number): DailyTotals {
  const row = db.query(`
    SELECT
      COALESCE(SUM(calories_kcal), 0) AS calories,
      COALESCE(SUM(protein_g),     0) AS protein,
      COALESCE(SUM(carbs_g),       0) AS carbs,
      COALESCE(SUM(fat_g),         0) AS fat
    FROM food_entry WHERE daily_log_id = ?
  `).get(dailyLogId) as DailyTotals;
  return row;
}

export function resolveEffectiveBudget(db: Database, date: string): EffectiveBudget {
  const plan = db.query(`
    SELECT id, title, target_calories_kcal
    FROM meal_plan
    WHERE start_date <= ? AND end_date >= ? AND target_calories_kcal IS NOT NULL
    ORDER BY start_date ASC, id ASC
    LIMIT 1
  `).get(date, date) as { id: number; title: string; target_calories_kcal: number } | null;

  if (plan) {
    return { budget: plan.target_calories_kcal, source: "plan", planId: plan.id, planTitle: plan.title };
  }

  const log = db.query("SELECT calorie_budget_kcal FROM daily_log WHERE log_date = ?").get(date) as { calorie_budget_kcal: number } | null;
  if (log) {
    return { budget: log.calorie_budget_kcal, source: "daily_log" };
  }
  return { budget: 1500, source: "default" };
}

// ---------------------------------------------------------------------------
// food_catalog helpers
// ---------------------------------------------------------------------------

export function searchFoodCatalog(db: Database, q: string, limit = 20): FoodCatalog[] {
  return db.query(
    "SELECT * FROM food_catalog WHERE name LIKE ? COLLATE NOCASE LIMIT ?"
  ).all(`%${q}%`, limit) as FoodCatalog[];
}

export function getFoodById(db: Database, id: number): FoodCatalog | null {
  return db.query("SELECT * FROM food_catalog WHERE id = ?").get(id) as FoodCatalog | null;
}

// ---------------------------------------------------------------------------
// food_entry helpers
// ---------------------------------------------------------------------------

export interface FoodEntryInput {
  dailyLogId: number;
  foodCatalogId: number | null;
  mealSlot: string;
  foodName: string;
  quantityValue: number;
  quantityUnit: string;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export function insertFoodEntry(db: Database, input: FoodEntryInput): number {
  const result = db.transaction(() => {
    const maxRow = db.query(
      "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM food_entry WHERE daily_log_id = ? AND meal_slot = ?"
    ).get(input.dailyLogId, input.mealSlot) as { max_order: number };
    const sortOrder = maxRow.max_order + 1;

    const ins = db.prepare(`
      INSERT INTO food_entry (daily_log_id, food_catalog_id, meal_slot, food_name, quantity_value, quantity_unit, calories_kcal, protein_g, carbs_g, fat_g, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    ins.run(input.dailyLogId, input.foodCatalogId, input.mealSlot, input.foodName, input.quantityValue, input.quantityUnit, input.caloriesKcal, input.proteinG, input.carbsG, input.fatG, sortOrder);
    return (db.query("SELECT last_insert_rowid() AS id").get() as { id: number }).id;
  })();
  return result;
}

export function getFoodEntry(db: Database, id: number): FoodEntry | null {
  return db.query("SELECT * FROM food_entry WHERE id = ?").get(id) as FoodEntry | null;
}

export interface FoodEntryUpdateInput {
  foodName: string;
  quantityValue: number;
  quantityUnit: string;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export function updateFoodEntry(db: Database, id: number, input: FoodEntryUpdateInput): void {
  db.prepare(`
    UPDATE food_entry
    SET food_name = ?, quantity_value = ?, quantity_unit = ?, calories_kcal = ?, protein_g = ?, carbs_g = ?, fat_g = ?,
        updated_at = strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')
    WHERE id = ?
  `).run(input.foodName, input.quantityValue, input.quantityUnit, input.caloriesKcal, input.proteinG, input.carbsG, input.fatG, id);
}

export function deleteFoodEntry(db: Database, id: number): void {
  db.prepare("DELETE FROM food_entry WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// meal_plan helpers
// ---------------------------------------------------------------------------

export function listPlans(db: Database): MealPlan[] {
  return db.query("SELECT * FROM meal_plan ORDER BY start_date DESC, id DESC").all() as MealPlan[];
}

export interface PlanDetail {
  plan: MealPlan;
  days: MealPlanDay[];
  itemsByDayBySlot: Record<number, Record<string, MealPlanItem[]>>;
  ingredients: IngredientItem[];
}

export function getPlanDetail(db: Database, id: number): PlanDetail | null {
  const plan = db.query("SELECT * FROM meal_plan WHERE id = ?").get(id) as MealPlan | null;
  if (!plan) return null;

  const days = db.query("SELECT * FROM meal_plan_day WHERE meal_plan_id = ? ORDER BY plan_date").all(id) as MealPlanDay[];
  const items = db.query(`
    SELECT mi.* FROM meal_plan_item mi
    JOIN meal_plan_day md ON mi.meal_plan_day_id = md.id
    WHERE md.meal_plan_id = ?
    ORDER BY md.plan_date, mi.meal_slot, mi.sort_order
  `).all(id) as MealPlanItem[];

  const itemsByDayBySlot: Record<number, Record<string, MealPlanItem[]>> = {};
  for (const item of items) {
    if (!itemsByDayBySlot[item.meal_plan_day_id]) itemsByDayBySlot[item.meal_plan_day_id] = {};
    if (!itemsByDayBySlot[item.meal_plan_day_id][item.meal_slot]) itemsByDayBySlot[item.meal_plan_day_id][item.meal_slot] = [];
    itemsByDayBySlot[item.meal_plan_day_id][item.meal_slot].push(item);
  }

  const ingredients = db.query("SELECT * FROM ingredient_item WHERE meal_plan_id = ? ORDER BY id").all(id) as IngredientItem[];

  return { plan, days, itemsByDayBySlot, ingredients };
}

export interface CreatePlanInput {
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  targetCaloriesKcal: number | null;
  notes: string | null;
}

function eachDateInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export function createPlan(db: Database, input: CreatePlanInput): number {
  return db.transaction(() => {
    const ins = db.prepare(`
      INSERT INTO meal_plan (title, start_date, end_date, status, target_calories_kcal, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    ins.run(input.title, input.startDate, input.endDate, input.status, input.targetCaloriesKcal, input.notes);
    const planId = (db.query("SELECT last_insert_rowid() AS id").get() as { id: number }).id;

    const insDay = db.prepare("INSERT OR IGNORE INTO meal_plan_day (meal_plan_id, plan_date) VALUES (?, ?)");
    for (const date of eachDateInRange(input.startDate, input.endDate)) {
      insDay.run(planId, date);
    }
    return planId;
  })();
}

export function updatePlan(db: Database, id: number, input: CreatePlanInput): void {
  db.transaction(() => {
    db.prepare(`
      UPDATE meal_plan
      SET title = ?, start_date = ?, end_date = ?, status = ?, target_calories_kcal = ?, notes = ?,
          updated_at = strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')
      WHERE id = ?
    `).run(input.title, input.startDate, input.endDate, input.status, input.targetCaloriesKcal, input.notes, id);

    // Remove days outside new range (items cascade via FK)
    db.prepare("DELETE FROM meal_plan_day WHERE meal_plan_id = ? AND (plan_date < ? OR plan_date > ?)").run(id, input.startDate, input.endDate);

    // Add new days
    const insDay = db.prepare("INSERT OR IGNORE INTO meal_plan_day (meal_plan_id, plan_date) VALUES (?, ?)");
    for (const date of eachDateInRange(input.startDate, input.endDate)) {
      insDay.run(id, date);
    }
  })();
}

export function deletePlan(db: Database, id: number): void {
  db.prepare("DELETE FROM meal_plan WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// meal_plan_item helpers
// ---------------------------------------------------------------------------

export function getDayByPlanAndDate(db: Database, planId: number, date: string): MealPlanDay | null {
  return db.query("SELECT * FROM meal_plan_day WHERE meal_plan_id = ? AND plan_date = ?").get(planId, date) as MealPlanDay | null;
}

export function getMealPlanItem(db: Database, id: number): MealPlanItem | null {
  return db.query("SELECT * FROM meal_plan_item WHERE id = ?").get(id) as MealPlanItem | null;
}

export interface MealPlanItemInput {
  mealPlanDayId: number;
  mealSlot: string;
  dishName: string;
  notes: string | null;
}

export function insertMealPlanItem(db: Database, input: MealPlanItemInput): number {
  return db.transaction(() => {
    const maxRow = db.query(
      "SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM meal_plan_item WHERE meal_plan_day_id = ? AND meal_slot = ?"
    ).get(input.mealPlanDayId, input.mealSlot) as { max_order: number };
    const sortOrder = maxRow.max_order + 1;

    db.prepare(`
      INSERT INTO meal_plan_item (meal_plan_day_id, meal_slot, dish_name, notes, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(input.mealPlanDayId, input.mealSlot, input.dishName, input.notes, sortOrder);
    return (db.query("SELECT last_insert_rowid() AS id").get() as { id: number }).id;
  })();
}

export function updateMealPlanItem(db: Database, id: number, input: Omit<MealPlanItemInput, "mealPlanDayId">): void {
  db.prepare(`
    UPDATE meal_plan_item
    SET meal_slot = ?, dish_name = ?, notes = ?,
        updated_at = strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')
    WHERE id = ?
  `).run(input.mealSlot, input.dishName, input.notes, id);
}

export function deleteMealPlanItem(db: Database, id: number): void {
  db.prepare("DELETE FROM meal_plan_item WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// ingredient_item helpers
// ---------------------------------------------------------------------------

export function getIngredientItem(db: Database, id: number): IngredientItem | null {
  return db.query("SELECT * FROM ingredient_item WHERE id = ?").get(id) as IngredientItem | null;
}

export interface IngredientItemInput {
  mealPlanId: number;
  name: string;
  quantityValue: number;
  quantityUnit: string;
  notes: string | null;
}

export function insertIngredientItem(db: Database, input: IngredientItemInput): number {
  db.prepare(`
    INSERT INTO ingredient_item (meal_plan_id, name, quantity_value, quantity_unit, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(input.mealPlanId, input.name, input.quantityValue, input.quantityUnit, input.notes);
  return (db.query("SELECT last_insert_rowid() AS id").get() as { id: number }).id;
}

export interface IngredientItemUpdateInput {
  name: string;
  quantityValue: number;
  quantityUnit: string;
  notes: string | null;
}

export function updateIngredientItem(db: Database, id: number, input: IngredientItemUpdateInput): void {
  db.prepare(`
    UPDATE ingredient_item
    SET name = ?, quantity_value = ?, quantity_unit = ?, notes = ?,
        updated_at = strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime')
    WHERE id = ?
  `).run(input.name, input.quantityValue, input.quantityUnit, input.notes, id);
}

export function deleteIngredientItem(db: Database, id: number): void {
  db.prepare("DELETE FROM ingredient_item WHERE id = ?").run(id);
}
