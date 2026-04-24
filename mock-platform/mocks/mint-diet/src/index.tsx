import { createMockApp, startServer } from "mock-lib";
import type { AppEnv } from "mock-lib";
import { Hono } from "hono";
import type { FC } from "hono/jsx";
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { createTables } from "./schema";
import { seedFoodCatalog } from "./seeds";
import {
  ensureDailyLog, listEntriesByDay, computeDailyTotals, resolveEffectiveBudget,
  searchFoodCatalog, getFoodById, scaleMacros, insertFoodEntry, getFoodEntry,
  updateFoodEntry, deleteFoodEntry, listPlans, getPlanDetail, createPlan, updatePlan,
  deletePlan, getDayByPlanAndDate, getMealPlanItem, getMealPlanItemForPlan,
  insertMealPlanItem, updateMealPlanItem, deleteMealPlanItem,
  getIngredientItem, getIngredientItemForPlan, insertIngredientItem, updateIngredientItem,
  deleteIngredientItem, isValidLocalDate, getMealPlanDayById,
} from "./queries";
import type {
  DailyLog, FoodCatalog, FoodEntry, MealPlan, MealPlanDay, MealPlanItem,
  IngredientItem, EffectiveBudget, DailyTotals,
} from "./queries";

// ---------------------------------------------------------------------------
// DB singleton
// ---------------------------------------------------------------------------

let db: Database;

function getDatabase(): Database {
  return db;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const LOG_SLOTS = ["breakfast", "lunch", "dinner", "snacks"] as const;
const PLAN_SLOTS = ["breakfast", "lunch", "dinner"] as const;
const INGREDIENT_UNITS = ["g", "ml", "包", "个"] as const;

function parsePositiveInt(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s, 10);
  if (!isNaN(n) && n > 0 && String(n) === s) return n;
  return null;
}

function parseNonNegFloat(s: string | undefined): number | null {
  if (s === undefined || s === "") return null;
  const n = Number(s);
  if (!isNaN(n) && isFinite(n) && n >= 0) return n;
  return null;
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #222; }
nav { background: #4caf50; color: #fff; padding: 0.75rem 1rem; display: flex; gap: 1rem; align-items: center; }
nav a { color: #fff; text-decoration: none; font-weight: 600; }
nav a:hover { text-decoration: underline; }
.container { max-width: 900px; margin: 1rem auto; padding: 0 1rem; }
.card { background: #fff; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.1); padding: 1rem; margin-bottom: 1rem; }
.slot-card { margin-bottom: 1rem; }
.slot-title { font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; color: #333; border-bottom: 1px solid #eee; padding-bottom: 0.25rem; }
.entry-row { display: flex; justify-content: space-between; align-items: center; padding: 0.3rem 0; border-bottom: 1px solid #f0f0f0; }
.entry-row:last-child { border-bottom: none; }
.entry-name { font-weight: 500; }
.entry-meta { font-size: 0.8rem; color: #666; }
.btn { display: inline-block; padding: 0.4rem 0.9rem; border-radius: 4px; border: none; cursor: pointer; font-size: 0.9rem; text-decoration: none; }
.btn-primary { background: #4caf50; color: #fff; }
.btn-secondary { background: #eee; color: #333; }
.btn-danger { background: #f44336; color: #fff; }
.btn-sm { padding: 0.2rem 0.5rem; font-size: 0.8rem; }
.summary-panel { background: #e8f5e9; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
.summary-row { display: flex; justify-content: space-between; }
.summary-label { color: #555; }
.summary-value { font-weight: 700; }
.macro-bar { height: 8px; border-radius: 4px; background: #c8e6c9; margin: 0.2rem 0; }
.macro-bar-fill { height: 100%; border-radius: 4px; background: #4caf50; }
.daynav { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem; }
.daynav a { color: #4caf50; text-decoration: none; font-size: 0.9rem; }
.daynav .date-label { font-weight: 700; font-size: 1rem; }
form.inline { display: inline; }
.form-group { margin-bottom: 0.75rem; }
label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.2rem; color: #444; }
input, select, textarea { width: 100%; padding: 0.4rem 0.6rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.95rem; }
.error { color: #c62828; font-size: 0.85rem; margin-top: 0.2rem; }
.search-result { padding: 0.4rem 0; border-bottom: 1px solid #eee; }
.search-result a { color: #2e7d32; text-decoration: none; }
.search-result a:hover { text-decoration: underline; }
.plan-grid { display: grid; gap: 0.5rem; }
.plan-day { background: #fafafa; border: 1px solid #e0e0e0; border-radius: 6px; padding: 0.75rem; }
.plan-day-date { font-weight: 700; margin-bottom: 0.4rem; }
.tabs { display: flex; gap: 0; border-bottom: 2px solid #4caf50; margin-bottom: 1rem; }
.tab { padding: 0.5rem 1rem; cursor: pointer; background: none; border: none; font-size: 0.95rem; color: #666; }
.tab.active { background: #4caf50; color: #fff; border-radius: 4px 4px 0 0; }
.ingredient-row { display: flex; gap: 0.5rem; align-items: center; padding: 0.3rem 0; border-bottom: 1px solid #eee; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #eee; font-size: 0.9rem; }
th { background: #f5f5f5; font-weight: 700; }
.note { font-size: 0.8rem; color: #888; margin-top: 0.25rem; }
h1 { font-size: 1.4rem; margin-bottom: 0.75rem; }
h2 { font-size: 1.1rem; margin-bottom: 0.5rem; }
.edit-form-row { background: #f9fbe7; border: 1px solid #dce775; border-radius: 4px; padding: 0.5rem; margin-bottom: 0.5rem; }
.edit-form-row .form-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
`;

// ---------------------------------------------------------------------------
// TSX Components
// ---------------------------------------------------------------------------

const Layout: FC<{ title: string; children: unknown }> = ({ title, children }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} — Mint Diet</title>
      <style>{CSS}</style>
    </head>
    <body>
      <nav>
        <a href="/log">Diet Log</a>
        <a href="/plans">Meal Plans</a>
      </nav>
      <div class="container">{children}</div>
    </body>
  </html>
);

const DayNav: FC<{ date: string }> = ({ date }) => {
  const d = new Date(date + "T00:00:00");
  const prevDate = new Date(d); prevDate.setDate(d.getDate() - 1);
  const nextDate = new Date(d); nextDate.setDate(d.getDate() + 1);
  const prevStr = localDateStr(prevDate);
  const nextStr = localDateStr(nextDate);
  return (
    <div class="daynav">
      <a href={`/log/${prevStr}`}>← Prev</a>
      <span class="date-label">{date}</span>
      <a href={`/log/${nextStr}`}>Next →</a>
      <a href={`/log/${todayLocal()}`} class="btn btn-secondary btn-sm">Today</a>
    </div>
  );
};

interface SummaryPanelProps {
  totals: DailyTotals;
  budget: EffectiveBudget;
}

const SummaryPanel: FC<SummaryPanelProps> = ({ totals, budget }) => {
  const remaining = budget.budget - totals.calories;
  const pct = Math.min(100, budget.budget > 0 ? Math.round((totals.calories / budget.budget) * 100) : 0);
  return (
    <div class="summary-panel">
      <div class="summary-row">
        <span class="summary-label">Budget</span>
        <span class="summary-value">{Math.round(budget.budget)} kcal</span>
      </div>
      {budget.source === "plan" && <p class="note">Budget from plan <em>{budget.planTitle}</em></p>}
      <div class="summary-row">
        <span class="summary-label">Consumed</span>
        <span class="summary-value">{Math.round(totals.calories)} kcal</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Remaining</span>
        <span class="summary-value">{Math.round(remaining)} kcal</span>
      </div>
      <div class="macro-bar"><div class="macro-bar-fill" style={`width:${pct}%`}></div></div>
      <div class="summary-row" style="margin-top:0.5rem">
        <span class="entry-meta">P: {totals.protein.toFixed(1)}g</span>
        <span class="entry-meta">C: {totals.carbs.toFixed(1)}g</span>
        <span class="entry-meta">F: {totals.fat.toFixed(1)}g</span>
      </div>
    </div>
  );
};

interface MealSlotCardProps {
  slot: string;
  entries: FoodEntry[];
  date: string;
}

const MealSlotCard: FC<MealSlotCardProps> = ({ slot, entries, date }) => {
  const label = slot.charAt(0).toUpperCase() + slot.slice(1);
  return (
    <div class="card slot-card">
      <div class="slot-title">{label}</div>
      {entries.map(e => (
        <div class="entry-row" key={e.id}>
          <div>
            <span class="entry-name">{e.food_name}</span>
            <span class="entry-meta"> · {e.quantity_value}{e.quantity_unit} · {Math.round(e.calories_kcal)}kcal</span>
          </div>
          <div style="display:flex;gap:0.4rem">
            <a href={`/log/entry/${e.id}/edit`} class="btn btn-secondary btn-sm">Edit</a>
            <form class="inline" method="post" action={`/log/entries/${e.id}/delete`}>
              <button type="submit" class="btn btn-danger btn-sm">Del</button>
            </form>
          </div>
        </div>
      ))}
      <a href={`/log/${date}/add/${slot}`} class="btn btn-primary btn-sm" style="margin-top:0.5rem">+ Add</a>
    </div>
  );
};

interface SearchResultRowProps {
  food: FoodCatalog;
  date: string;
  slot: string;
}

const SearchResultRow: FC<SearchResultRowProps> = ({ food, date, slot }) => (
  <div class="search-result">
    <a href={`/log/${date}/add/${slot}?food=${food.id}`}>
      {food.name} ({food.serving_size_value}{food.serving_size_unit}, {food.calories_kcal ?? 0}kcal)
    </a>
  </div>
);

interface EntryFormProps {
  date: string;
  slot: string;
  food?: FoodCatalog | null;
  entry?: FoodEntry | null;
  searchResults?: FoodCatalog[];
  query?: string;
  error?: string;
  prefill?: {
    food_name: string;
    quantity_value: string;
    quantity_unit: string;
    calories_kcal: string;
    protein_g: string;
    carbs_g: string;
    fat_g: string;
  };
}

const EntryForm: FC<EntryFormProps> = ({ date, slot, food, entry, searchResults, query, error, prefill }) => {
  const isEdit = !!entry;
  const actionUrl = isEdit ? `/log/entries/${entry!.id}` : `/log/${date}/entries`;
  const isManual = !food && !entry?.food_catalog_id;

  const units = food
    ? [food.serving_size_unit, "份"]
    : entry?.food_catalog_id
    ? [entry.quantity_unit, "份"]
    : ["g", "ml", "份", "个"];

  return (
    <Layout title={isEdit ? "Edit Entry" : "Add Entry"}>
      <h1>{isEdit ? "Edit Food Entry" : `Add to ${slot.charAt(0).toUpperCase() + slot.slice(1)}`}</h1>
      {!isEdit && (
        <form method="get" action={`/log/${date}/add/${slot}`} style="margin-bottom:1rem">
          <div style="display:flex;gap:0.5rem">
            <input name="q" value={query ?? ""} placeholder="Search food catalog..." style="flex:1" />
            <button type="submit" class="btn btn-secondary">Search</button>
          </div>
        </form>
      )}
      {!isEdit && searchResults && searchResults.length > 0 && (
        <div class="card">
          {searchResults.map(f => <SearchResultRow key={f.id} food={f} date={date} slot={slot} />)}
        </div>
      )}
      {!isEdit && searchResults && searchResults.length === 0 && query && (
        <p class="note">No results — add manually below.</p>
      )}
      {error && <p class="error">{error}</p>}
      <div class="card">
        <form method="post" action={actionUrl}>
          {!isEdit && <input type="hidden" name="slot" value={slot} />}
          {food && <input type="hidden" name="food_catalog_id" value={food.id} />}
          {entry?.food_catalog_id && <input type="hidden" name="food_catalog_id" value={entry.food_catalog_id} />}
          <div class="form-group">
            <label>Food name</label>
            <input name="food_name" value={prefill?.food_name ?? food?.name ?? entry?.food_name ?? ""} required />
          </div>
          <div class="form-group">
            <label>Quantity</label>
            <input type="number" step="0.1" name="quantity_value"
              value={prefill?.quantity_value ?? String(food?.serving_size_value ?? entry?.quantity_value ?? "")} required />
          </div>
          <div class="form-group">
            <label>Unit</label>
            <select name="quantity_unit">
              {units.map(u => (
                <option value={u} selected={u === (prefill?.quantity_unit ?? entry?.quantity_unit ?? food?.serving_size_unit)}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          {(isManual || (entry && !entry.food_catalog_id)) && (
            <>
              <div class="form-group">
                <label>Calories (kcal)</label>
                <input type="number" step="0.1" name="calories_kcal" value={prefill?.calories_kcal ?? String(entry?.calories_kcal ?? "0")} />
              </div>
              <div class="form-group">
                <label>Protein (g)</label>
                <input type="number" step="0.1" name="protein_g" value={prefill?.protein_g ?? String(entry?.protein_g ?? "0")} />
              </div>
              <div class="form-group">
                <label>Carbs (g)</label>
                <input type="number" step="0.1" name="carbs_g" value={prefill?.carbs_g ?? String(entry?.carbs_g ?? "0")} />
              </div>
              <div class="form-group">
                <label>Fat (g)</label>
                <input type="number" step="0.1" name="fat_g" value={prefill?.fat_g ?? String(entry?.fat_g ?? "0")} />
              </div>
            </>
          )}
          <div style="display:flex;gap:0.5rem">
            <button type="submit" class="btn btn-primary">{isEdit ? "Save" : "Add Entry"}</button>
            <a href={`/log/${date}`} class="btn btn-secondary">Cancel</a>
          </div>
        </form>
      </div>
    </Layout>
  );
};

const PlanCard: FC<{ plan: MealPlan }> = ({ plan }) => (
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <strong><a href={`/plans/${plan.id}`} style="color:#2e7d32;text-decoration:none">{plan.title}</a></strong>
        <span class="entry-meta"> · {plan.start_date} → {plan.end_date} · {plan.status}</span>
        {plan.target_calories_kcal && <span class="entry-meta"> · {plan.target_calories_kcal}kcal target</span>}
      </div>
      <form class="inline" method="post" action={`/plans/${plan.id}/delete`}>
        <button type="submit" class="btn btn-danger btn-sm">Delete</button>
      </form>
    </div>
  </div>
);

interface PlanFormProps {
  plan?: MealPlan;
  error?: string;
  prefill?: Record<string, string>;
}

const PlanForm: FC<PlanFormProps> = ({ plan, error, prefill }) => {
  const isEdit = !!plan;
  const actionUrl = isEdit ? `/plans/${plan!.id}` : "/plans";
  return (
    <Layout title={isEdit ? "Edit Plan" : "New Plan"}>
      <h1>{isEdit ? "Edit Plan" : "New Meal Plan"}</h1>
      {error && <p class="error">{error}</p>}
      <div class="card">
        <form method="post" action={actionUrl}>
          <div class="form-group">
            <label>Title</label>
            <input name="title" value={prefill?.title ?? plan?.title ?? ""} required />
          </div>
          <div class="form-group">
            <label>Start date</label>
            <input type="date" name="start_date" value={prefill?.start_date ?? plan?.start_date ?? ""} required />
          </div>
          <div class="form-group">
            <label>End date</label>
            <input type="date" name="end_date" value={prefill?.end_date ?? plan?.end_date ?? ""} required />
          </div>
          <div class="form-group">
            <label>Status</label>
            <select name="status">
              {["draft", "active", "archived"].map(s => (
                <option value={s} selected={s === (prefill?.status ?? plan?.status ?? "draft")}>{s}</option>
              ))}
            </select>
          </div>
          <div class="form-group">
            <label>Calorie target (kcal, optional)</label>
            <input type="number" step="1" name="target_calories_kcal"
              value={prefill?.target_calories_kcal ?? (plan?.target_calories_kcal != null ? String(plan.target_calories_kcal) : "")} />
          </div>
          <div class="form-group">
            <label>Notes (optional)</label>
            <textarea name="notes">{prefill?.notes ?? plan?.notes ?? ""}</textarea>
          </div>
          <div style="display:flex;gap:0.5rem">
            <button type="submit" class="btn btn-primary">{isEdit ? "Save" : "Create Plan"}</button>
            <a href="/plans" class="btn btn-secondary">Cancel</a>
          </div>
        </form>
      </div>
    </Layout>
  );
};

interface PlanDayGridProps {
  plan: MealPlan;
  days: MealPlanDay[];
  itemsByDayBySlot: Record<number, Record<string, MealPlanItem[]>>;
}

const PlanDayGrid: FC<PlanDayGridProps> = ({ plan, days, itemsByDayBySlot }) => (
  <div class="plan-grid">
    {days.map(day => (
      <div class="plan-day" key={day.id}>
        <div class="plan-day-date">{day.plan_date}</div>
        {PLAN_SLOTS.map(slot => {
          const items = itemsByDayBySlot[day.id]?.[slot] ?? [];
          return (
            <div key={slot} style="margin-bottom:0.4rem">
              <span class="entry-meta" style="font-weight:600">{slot.charAt(0).toUpperCase() + slot.slice(1)}: </span>
              {items.map(it => <span class="entry-meta" key={it.id}>{it.dish_name}; </span>)}
              <a href={`/plans/${plan.id}/days/${day.plan_date}/slots/${slot}/edit`} class="btn btn-secondary btn-sm">Edit</a>
            </div>
          );
        })}
      </div>
    ))}
  </div>
);

interface IngredientTableProps {
  plan: MealPlan;
  ingredients: IngredientItem[];
  error?: string;
  prefill?: Record<string, string>;
}

const IngredientTable: FC<IngredientTableProps> = ({ plan, ingredients, error, prefill }) => (
  <div>
    <h2>Add Ingredient</h2>
    {error && <p class="error">{error}</p>}
    <div class="card">
      <form method="post" action={`/plans/${plan.id}/ingredients`}>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <input name="name" placeholder="Name" required style="flex:2;min-width:120px" value={prefill?.name ?? ""} />
          <input type="number" step="0.1" name="quantity_value" placeholder="Qty" style="flex:1;min-width:60px" value={prefill?.quantity_value ?? ""} />
          <select name="quantity_unit" style="flex:1;min-width:60px">
            {INGREDIENT_UNITS.map(u => <option value={u} selected={u === (prefill?.quantity_unit ?? "g")}>{u}</option>)}
          </select>
          <button type="submit" class="btn btn-primary">Add</button>
        </div>
      </form>
    </div>
    {ingredients.length === 0 && <p class="note" style="margin-top:0.5rem">No ingredients added yet.</p>}
    {ingredients.length > 0 && (
      <table>
        <thead><tr><th>Name</th><th>Qty</th><th>Unit</th><th></th></tr></thead>
        <tbody>
          {ingredients.map(ing => (
            <tr key={ing.id}>
              <td colspan={4}>
                <div class="edit-form-row">
                  <form method="post" action={`/plans/${plan.id}/ingredients/${ing.id}`}>
                    <div class="form-row">
                      <input name="name" value={ing.name} required style="flex:2;min-width:100px" />
                      <input type="number" step="0.1" name="quantity_value" value={String(ing.quantity_value)} style="flex:1;min-width:60px" />
                      <select name="quantity_unit" style="flex:1;min-width:60px">
                        {INGREDIENT_UNITS.map(u => <option value={u} selected={u === ing.quantity_unit}>{u}</option>)}
                      </select>
                      <button type="submit" class="btn btn-primary btn-sm">Save</button>
                      <form class="inline" method="post" action={`/plans/${plan.id}/ingredients/${ing.id}/delete`}>
                        <button type="submit" class="btn btn-danger btn-sm">Del</button>
                      </form>
                    </div>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

interface SlotEditorPageProps {
  plan: MealPlan;
  day: MealPlanDay;
  slot: string;
  items: MealPlanItem[];
  error?: string;
  prefill?: Record<string, string>;
}

const SlotEditorPage: FC<SlotEditorPageProps> = ({ plan, day, slot, items, error, prefill }) => (
  <Layout title={`Edit ${slot} — ${day.plan_date}`}>
    <h1>Edit {slot.charAt(0).toUpperCase() + slot.slice(1)} — {day.plan_date}</h1>
    <a href={`/plans/${plan.id}`} class="btn btn-secondary btn-sm" style="margin-bottom:1rem;display:inline-block">← Back to plan</a>
    {error && <p class="error">{error}</p>}
    <div class="card">
      <form method="post" action={`/plans/${plan.id}/items`}>
        <input type="hidden" name="plan_date" value={day.plan_date} />
        <input type="hidden" name="meal_slot" value={slot} />
        <div style="display:flex;gap:0.5rem">
          <input name="dish_name" placeholder="Dish name" required style="flex:1" value={prefill?.dish_name ?? ""} />
          <input name="notes" placeholder="Notes (optional)" style="flex:1" value={prefill?.notes ?? ""} />
          <button type="submit" class="btn btn-primary">Add</button>
        </div>
      </form>
    </div>
    {items.map(item => (
      <div class="edit-form-row" key={item.id}>
        <form method="post" action={`/plans/${plan.id}/items/${item.id}`}>
          <input type="hidden" name="meal_slot" value={item.meal_slot} />
          <div class="form-row">
            <input name="dish_name" value={item.dish_name} required style="flex:2;min-width:100px" />
            <input name="notes" value={item.notes ?? ""} placeholder="Notes" style="flex:1;min-width:80px" />
            <button type="submit" class="btn btn-primary btn-sm">Save</button>
            <form class="inline" method="post" action={`/plans/${plan.id}/items/${item.id}/delete`}>
              <button type="submit" class="btn btn-danger btn-sm">Del</button>
            </form>
          </div>
        </form>
      </div>
    ))}
  </Layout>
);

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const mockApp = createMockApp({
  name: "mint-diet",
  port: 5003,
  routes: (app: Hono<AppEnv>) => {
    // Sentinel
    app.get("/__mock_sentinel__/mint-diet", (c) =>
      c.json({ mock: "mint-diet", sentinel: true })
    );

    // Root redirects
    app.get("/", (c) => c.redirect("/log", 302));
    app.get("/log", (c) => c.redirect(`/log/${todayLocal()}`, 302));

    // ---------------------------------------------------------------------------
    // Day view
    // ---------------------------------------------------------------------------
    app.get("/log/:date", async (c) => {
      const { date } = c.req.param();
      if (!isValidLocalDate(date)) return c.html(<Layout title="Bad Request"><p>Invalid date: {date}</p></Layout>, 400);

      const d = getDatabase();
      const log: DailyLog = ensureDailyLog(d, date);
      const entries = listEntriesByDay(d, log.id);
      const totals = computeDailyTotals(d, log.id);
      const budget = resolveEffectiveBudget(d, date);

      const bySlot: Record<string, typeof entries> = { breakfast: [], lunch: [], dinner: [], snacks: [] };
      for (const e of entries) bySlot[e.meal_slot].push(e);

      return c.html(
        <Layout title={date}>
          <DayNav date={date} />
          <SummaryPanel totals={totals} budget={budget} />
          {LOG_SLOTS.map(slot => (
            <MealSlotCard key={slot} slot={slot} entries={bySlot[slot]} date={date} />
          ))}
        </Layout>
      );
    });

    // ---------------------------------------------------------------------------
    // Add entry
    // ---------------------------------------------------------------------------
    app.get("/log/:date/add/:slot", async (c) => {
      const { date, slot } = c.req.param();
      if (!isValidLocalDate(date)) return c.html(<Layout title="Bad Request"><p>Invalid date</p></Layout>, 400);
      if (!(LOG_SLOTS as readonly string[]).includes(slot)) return c.html(<Layout title="Bad Request"><p>Invalid slot</p></Layout>, 400);

      const q = c.req.query("q");
      const foodId = c.req.query("food");
      const d = getDatabase();

      let food: FoodCatalog | null = null;
      let searchResults: FoodCatalog[] | undefined;

      if (foodId) {
        const id = parsePositiveInt(foodId);
        if (id) food = getFoodById(d, id);
      } else if (q !== undefined) {
        searchResults = searchFoodCatalog(d, q);
      }

      return c.html(<EntryForm date={date} slot={slot} food={food} searchResults={searchResults} query={q} />);
    });

    app.post("/log/:date/entries", async (c) => {
      const { date } = c.req.param();
      if (!isValidLocalDate(date)) return c.html(<Layout title="Bad Request"><p>Invalid date</p></Layout>, 400);

      const body = await c.req.parseBody();
      const mealSlot = String(body.slot ?? "");
      if (!(LOG_SLOTS as readonly string[]).includes(mealSlot)) {
        return c.html(<Layout title="Bad Request"><p>Invalid slot</p></Layout>, 400);
      }

      const foodCatalogIdRaw = body.food_catalog_id ? String(body.food_catalog_id) : null;
      const foodCatalogId = foodCatalogIdRaw ? parsePositiveInt(foodCatalogIdRaw) : null;
      const foodName = String(body.food_name ?? "").trim();
      const quantityValue = parseNonNegFloat(String(body.quantity_value ?? ""));
      const quantityUnit = String(body.quantity_unit ?? "");

      const makePrefill = () => ({
        food_name: String(body.food_name ?? ""),
        quantity_value: String(body.quantity_value ?? ""),
        quantity_unit: quantityUnit,
        calories_kcal: String(body.calories_kcal ?? "0"),
        protein_g: String(body.protein_g ?? "0"),
        carbs_g: String(body.carbs_g ?? "0"),
        fat_g: String(body.fat_g ?? "0"),
      });

      if (!foodName) return c.html(
        <EntryForm date={date} slot={mealSlot} error="Food name is required" prefill={makePrefill()} />, 422
      );
      if (foodName.length > 200) return c.html(
        <EntryForm date={date} slot={mealSlot} error="Food name must be 200 characters or fewer" prefill={makePrefill()} />, 422
      );
      if (quantityValue === null || quantityValue < 0) return c.html(
        <EntryForm date={date} slot={mealSlot} error="Invalid quantity" prefill={makePrefill()} />, 422
      );

      let caloriesKcal = 0, proteinG = 0, carbsG = 0, fatG = 0;

      if (foodCatalogId) {
        const d = getDatabase();
        const catalog = getFoodById(d, foodCatalogId);
        if (catalog) {
          const macros = scaleMacros(catalog, quantityValue, quantityUnit);
          caloriesKcal = macros.calories;
          proteinG = macros.protein;
          carbsG = macros.carbs;
          fatG = macros.fat;
        }
      } else {
        caloriesKcal = parseNonNegFloat(String(body.calories_kcal ?? "")) ?? 0;
        proteinG = parseNonNegFloat(String(body.protein_g ?? "")) ?? 0;
        carbsG = parseNonNegFloat(String(body.carbs_g ?? "")) ?? 0;
        fatG = parseNonNegFloat(String(body.fat_g ?? "")) ?? 0;
      }

      if (caloriesKcal > 100000) return c.html(
        <EntryForm date={date} slot={mealSlot} error="Calories value too large (max 100000)" prefill={makePrefill()} />, 422
      );

      const d = getDatabase();
      const log = ensureDailyLog(d, date);
      insertFoodEntry(d, { dailyLogId: log.id, foodCatalogId, mealSlot, foodName, quantityValue, quantityUnit, caloriesKcal, proteinG, carbsG, fatG });
      return c.redirect(`/log/${date}`, 303);
    });

    // ---------------------------------------------------------------------------
    // Edit entry
    // ---------------------------------------------------------------------------
    app.get("/log/entry/:entryId/edit", async (c) => {
      const entryId = parsePositiveInt(c.req.param("entryId"));
      if (!entryId) return c.html(<Layout title="Bad Request"><p>Invalid entry ID</p></Layout>, 400);

      const d = getDatabase();
      const entry = getFoodEntry(d, entryId);
      if (!entry) return c.html(<Layout title="Not Found"><p>Entry not found</p></Layout>, 404);

      const log = d.query("SELECT log_date FROM daily_log WHERE id = ?").get(entry.daily_log_id) as { log_date: string } | null;
      const date = log?.log_date ?? todayLocal();

      let food: FoodCatalog | null = null;
      if (entry.food_catalog_id) food = getFoodById(d, entry.food_catalog_id);

      return c.html(<EntryForm date={date} slot={entry.meal_slot} food={food} entry={entry} />);
    });

    app.post("/log/entries/:entryId", async (c) => {
      const entryId = parsePositiveInt(c.req.param("entryId"));
      if (!entryId) return c.html(<Layout title="Bad Request"><p>Invalid entry ID</p></Layout>, 400);

      const d = getDatabase();
      const entry = getFoodEntry(d, entryId);
      if (!entry) return c.html(<Layout title="Not Found"><p>Entry not found</p></Layout>, 404);

      const log = d.query("SELECT log_date FROM daily_log WHERE id = ?").get(entry.daily_log_id) as { log_date: string } | null;
      const date = log?.log_date ?? todayLocal();

      let food: FoodCatalog | null = null;
      if (entry.food_catalog_id) food = getFoodById(d, entry.food_catalog_id);

      const body = await c.req.parseBody();
      const foodName = String(body.food_name ?? "").trim();
      const quantityValue = parseNonNegFloat(String(body.quantity_value ?? ""));
      const quantityUnit = String(body.quantity_unit ?? "");

      const makePrefill = () => ({
        food_name: String(body.food_name ?? ""),
        quantity_value: String(body.quantity_value ?? ""),
        quantity_unit: quantityUnit,
        calories_kcal: String(body.calories_kcal ?? "0"),
        protein_g: String(body.protein_g ?? "0"),
        carbs_g: String(body.carbs_g ?? "0"),
        fat_g: String(body.fat_g ?? "0"),
      });

      if (!foodName) return c.html(
        <EntryForm date={date} slot={entry.meal_slot} food={food} entry={entry} error="Food name is required" prefill={makePrefill()} />, 422
      );
      if (foodName.length > 200) return c.html(
        <EntryForm date={date} slot={entry.meal_slot} food={food} entry={entry} error="Food name must be 200 characters or fewer" prefill={makePrefill()} />, 422
      );
      if (quantityValue === null || quantityValue < 0) return c.html(
        <EntryForm date={date} slot={entry.meal_slot} food={food} entry={entry} error="Invalid quantity" prefill={makePrefill()} />, 422
      );

      let caloriesKcal = entry.calories_kcal, proteinG = entry.protein_g, carbsG = entry.carbs_g, fatG = entry.fat_g;

      if (entry.food_catalog_id) {
        const catalog = getFoodById(d, entry.food_catalog_id);
        if (catalog) {
          const macros = scaleMacros(catalog, quantityValue, quantityUnit);
          caloriesKcal = macros.calories;
          proteinG = macros.protein;
          carbsG = macros.carbs;
          fatG = macros.fat;
        }
      } else {
        caloriesKcal = parseNonNegFloat(String(body.calories_kcal ?? "")) ?? 0;
        proteinG = parseNonNegFloat(String(body.protein_g ?? "")) ?? 0;
        carbsG = parseNonNegFloat(String(body.carbs_g ?? "")) ?? 0;
        fatG = parseNonNegFloat(String(body.fat_g ?? "")) ?? 0;
      }

      if (caloriesKcal > 100000) return c.html(
        <EntryForm date={date} slot={entry.meal_slot} food={food} entry={entry} error="Calories value too large (max 100000)" prefill={makePrefill()} />, 422
      );

      updateFoodEntry(d, entryId, { foodName, quantityValue, quantityUnit, caloriesKcal, proteinG, carbsG, fatG });
      return c.redirect(`/log/${date}`, 303);
    });

    app.post("/log/entries/:entryId/delete", async (c) => {
      const entryId = parsePositiveInt(c.req.param("entryId"));
      if (!entryId) return c.html(<Layout title="Bad Request"><p>Invalid entry ID</p></Layout>, 400);

      const d = getDatabase();
      const entry = getFoodEntry(d, entryId);
      if (!entry) return c.html(<Layout title="Not Found"><p>Entry not found</p></Layout>, 404);

      const log = d.query("SELECT log_date FROM daily_log WHERE id = ?").get(entry.daily_log_id) as { log_date: string } | null;
      const date = log?.log_date ?? todayLocal();

      deleteFoodEntry(d, entryId);
      return c.redirect(`/log/${date}`, 303);
    });

    // ---------------------------------------------------------------------------
    // Plans
    // ---------------------------------------------------------------------------
    app.get("/plans", async (c) => {
      const d = getDatabase();
      const plans = listPlans(d);
      return c.html(
        <Layout title="Meal Plans">
          <h1>Meal Plans</h1>
          <a href="/plans/new" class="btn btn-primary" style="margin-bottom:1rem;display:inline-block">+ New Plan</a>
          {plans.length === 0 && <p class="note">No plans yet.</p>}
          {plans.map(plan => <PlanCard key={plan.id} plan={plan} />)}
        </Layout>
      );
    });

    app.get("/plans/new", (c) => c.html(<PlanForm />));

    app.post("/plans", async (c) => {
      const body = await c.req.parseBody();
      const title = String(body.title ?? "").trim();
      const startDate = String(body.start_date ?? "");
      const endDate = String(body.end_date ?? "");
      const status = String(body.status ?? "draft");
      const targetRaw = String(body.target_calories_kcal ?? "").trim();
      const notes = String(body.notes ?? "").trim() || null;

      const makePrefill = () => ({ title, start_date: startDate, end_date: endDate, status, target_calories_kcal: targetRaw, notes: notes ?? "" });

      if (!title) return c.html(<PlanForm error="Title is required" prefill={makePrefill()} />, 422);
      if (title.length > 200) return c.html(<PlanForm error="Title must be 200 characters or fewer" prefill={makePrefill()} />, 422);
      if (!isValidLocalDate(startDate) || !isValidLocalDate(endDate)) return c.html(<PlanForm error="Invalid date format" prefill={makePrefill()} />, 422);
      if (startDate > endDate) return c.html(<PlanForm error="Start date must be before end date" prefill={makePrefill()} />, 422);

      const start = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T00:00:00");
      const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      if (days > 365) return c.html(<PlanForm error="Plan span must be 365 days or fewer" prefill={makePrefill()} />, 422);

      if (!(["draft", "active", "archived"] as string[]).includes(status)) return c.html(<PlanForm error="Invalid status" prefill={makePrefill()} />, 422);

      const targetCaloriesKcal = targetRaw ? parseNonNegFloat(targetRaw) : null;
      if (targetRaw && targetCaloriesKcal === null) return c.html(<PlanForm error="Invalid calorie target" prefill={makePrefill()} />, 422);

      const d = getDatabase();
      const planId = createPlan(d, { title, startDate, endDate, status, targetCaloriesKcal, notes });
      return c.redirect(`/plans/${planId}`, 303);
    });

    app.get("/plans/:planId", async (c) => {
      const planId = parsePositiveInt(c.req.param("planId"));
      if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);

      const d = getDatabase();
      const detail = getPlanDetail(d, planId);
      if (!detail) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

      const tab = c.req.query("tab") ?? "days";
      const { plan, days, itemsByDayBySlot, ingredients } = detail;

      return c.html(
        <Layout title={plan.title}>
          <h1>{plan.title}</h1>
          <p class="entry-meta">{plan.start_date} → {plan.end_date} · {plan.status}</p>
          <div style="display:flex;gap:0.5rem;margin:0.75rem 0">
            <a href={`/plans/${planId}?tab=days`} class={`btn ${tab === "days" ? "btn-primary" : "btn-secondary"} btn-sm`}>Days</a>
            <a href={`/plans/${planId}?tab=ingredients`} class={`btn ${tab === "ingredients" ? "btn-primary" : "btn-secondary"} btn-sm`}>Ingredients</a>
            <a href={`/plans/${planId}/edit`} class="btn btn-secondary btn-sm">Edit Plan</a>
          </div>
          {tab === "days" ? (
            <PlanDayGrid plan={plan} days={days} itemsByDayBySlot={itemsByDayBySlot} />
          ) : (
            <IngredientTable plan={plan} ingredients={ingredients} />
          )}
        </Layout>
      );
    });

    app.get("/plans/:planId/edit", async (c) => {
      const planId = parsePositiveInt(c.req.param("planId"));
      if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);

      const d = getDatabase();
      const detail = getPlanDetail(d, planId);
      if (!detail) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

      return c.html(<PlanForm plan={detail.plan} />);
    });

    app.post("/plans/:planId", async (c) => {
      const planId = parsePositiveInt(c.req.param("planId"));
      if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);

      const d = getDatabase();
      const existing = getPlanDetail(d, planId);
      if (!existing) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

      const body = await c.req.parseBody();
      const title = String(body.title ?? "").trim();
      const startDate = String(body.start_date ?? "");
      const endDate = String(body.end_date ?? "");
      const status = String(body.status ?? "draft");
      const targetRaw = String(body.target_calories_kcal ?? "").trim();
      const notes = String(body.notes ?? "").trim() || null;

      const makePrefill = () => ({ title, start_date: startDate, end_date: endDate, status, target_calories_kcal: targetRaw, notes: notes ?? "" });

      if (!title) return c.html(<PlanForm plan={existing.plan} error="Title is required" prefill={makePrefill()} />, 422);
      if (title.length > 200) return c.html(<PlanForm plan={existing.plan} error="Title must be 200 characters or fewer" prefill={makePrefill()} />, 422);
      if (!isValidLocalDate(startDate) || !isValidLocalDate(endDate)) return c.html(<PlanForm plan={existing.plan} error="Invalid date format" prefill={makePrefill()} />, 422);
      if (startDate > endDate) return c.html(<PlanForm plan={existing.plan} error="Start date must be before end date" prefill={makePrefill()} />, 422);

      const start = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T00:00:00");
      const daySpan = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
      if (daySpan > 365) return c.html(<PlanForm plan={existing.plan} error="Plan span must be 365 days or fewer" prefill={makePrefill()} />, 422);
      if (!(["draft", "active", "archived"] as string[]).includes(status)) return c.html(<PlanForm plan={existing.plan} error="Invalid status" prefill={makePrefill()} />, 422);

      const targetCaloriesKcal = targetRaw ? parseNonNegFloat(targetRaw) : null;
      if (targetRaw && targetCaloriesKcal === null) return c.html(<PlanForm plan={existing.plan} error="Invalid calorie target" prefill={makePrefill()} />, 422);

      updatePlan(d, planId, { title, startDate, endDate, status, targetCaloriesKcal, notes });
      return c.redirect(`/plans/${planId}`, 303);
    });

    app.post("/plans/:planId/delete", async (c) => {
      const planId = parsePositiveInt(c.req.param("planId"));
      if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);

      const d = getDatabase();
      const existing = d.query("SELECT id FROM meal_plan WHERE id = ?").get(planId);
      if (!existing) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

      deletePlan(d, planId);
      return c.redirect("/plans", 303);
    });

    // ---------------------------------------------------------------------------
    // Plan day/slot editor
    // ---------------------------------------------------------------------------
    app.get("/plans/:planId/days/:date/slots/:slot/edit", async (c) => {
      const planId = parsePositiveInt(c.req.param("planId"));
      if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);
      const { date, slot } = c.req.param();
      if (!isValidLocalDate(date)) return c.html(<Layout title="Bad Request"><p>Invalid date</p></Layout>, 400);
      if (!(PLAN_SLOTS as readonly string[]).includes(slot)) return c.html(<Layout title="Bad Request"><p>Invalid slot</p></Layout>, 400);

      const d = getDatabase();
      const detail = getPlanDetail(d, planId);
      if (!detail) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

      const day = getDayByPlanAndDate(d, planId, date);
      if (!day) return c.html(<Layout title="Not Found"><p>Day not found in plan</p></Layout>, 404);

      const items = detail.itemsByDayBySlot[day.id]?.[slot] ?? [];
      return c.html(<SlotEditorPage plan={detail.plan} day={day} slot={slot} items={items} />);
    });

    app.post("/plans/:planId/items", async (c) => {
      const planId = parsePositiveInt(c.req.param("planId"));
      if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);

      const body = await c.req.parseBody();
      const planDate = String(body.plan_date ?? "");
      const mealSlot = String(body.meal_slot ?? "");
      const dishName = String(body.dish_name ?? "").trim();
      const notes = String(body.notes ?? "").trim() || null;

      if (!isValidLocalDate(planDate)) return c.html(<Layout title="Bad Request"><p>Invalid date</p></Layout>, 400);
      if (!(PLAN_SLOTS as readonly string[]).includes(mealSlot)) return c.html(<Layout title="Bad Request"><p>Invalid slot</p></Layout>, 400);

      const d = getDatabase();
      const detail = getPlanDetail(d, planId);
      if (!detail) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

      const day = getDayByPlanAndDate(d, planId, planDate);
      if (!day) return c.html(<Layout title="Not Found"><p>Day not found in plan</p></Layout>, 404);

      if (!dishName) {
        const items = detail.itemsByDayBySlot[day.id]?.[mealSlot] ?? [];
        return c.html(
          <SlotEditorPage plan={detail.plan} day={day} slot={mealSlot} items={items}
            error="Dish name is required"
            prefill={{ dish_name: String(body.dish_name ?? ""), notes: String(body.notes ?? "") }} />,
          422
        );
      }
      if (dishName.length > 200) {
        const items = detail.itemsByDayBySlot[day.id]?.[mealSlot] ?? [];
        return c.html(
          <SlotEditorPage plan={detail.plan} day={day} slot={mealSlot} items={items}
            error="Dish name must be 200 characters or fewer"
            prefill={{ dish_name: String(body.dish_name ?? ""), notes: String(body.notes ?? "") }} />,
          422
        );
      }

      insertMealPlanItem(d, { mealPlanDayId: day.id, mealSlot, dishName, notes });
      return c.redirect(`/plans/${planId}/days/${planDate}/slots/${mealSlot}/edit`, 303);
    });

    app.post("/plans/:planId/items/:itemId", async (c) => {
      const planId = parsePositiveInt(c.req.param("planId"));
      const itemId = parsePositiveInt(c.req.param("itemId"));
      if (!planId || !itemId) return c.html(<Layout title="Bad Request"><p>Invalid ID</p></Layout>, 400);

      const d = getDatabase();
      const item = getMealPlanItemForPlan(d, planId, itemId);
      if (!item) return c.html(<Layout title="Not Found"><p>Item not found</p></Layout>, 404);

      const body = await c.req.parseBody();
      const mealSlot = String(body.meal_slot ?? item.meal_slot);
      const dishName = String(body.dish_name ?? "").trim();
      const notes = String(body.notes ?? "").trim() || null;

      if (!(PLAN_SLOTS as readonly string[]).includes(mealSlot)) return c.html(<Layout title="Bad Request"><p>Invalid slot</p></Layout>, 400);

      // Determine the day/date for redirect and error re-render
      const day = getMealPlanDayById(d, item.meal_plan_day_id);
      const planDate = day?.plan_date ?? "";

      const makePrefill = () => ({ dish_name: String(body.dish_name ?? ""), notes: String(body.notes ?? "") });
      if (!dishName) {
        const detail = getPlanDetail(d, planId);
        const items = day ? (detail?.itemsByDayBySlot[day.id]?.[mealSlot] ?? []) : [];
        return c.html(
          <SlotEditorPage
            plan={detail?.plan ?? { id: planId, title: "", start_date: "", end_date: "", status: "draft", target_calories_kcal: null, notes: null }}
            day={day ?? { id: item.meal_plan_day_id, meal_plan_id: planId, plan_date: planDate }}
            slot={mealSlot}
            items={items}
            error="Dish name is required"
            prefill={makePrefill()} />,
          422
        );
      }
      if (dishName.length > 200) {
        const detail = getPlanDetail(d, planId);
        const items = day ? (detail?.itemsByDayBySlot[day.id]?.[mealSlot] ?? []) : [];
        return c.html(
          <SlotEditorPage
            plan={detail?.plan ?? { id: planId, title: "", start_date: "", end_date: "", status: "draft", target_calories_kcal: null, notes: null }}
            day={day ?? { id: item.meal_plan_day_id, meal_plan_id: planId, plan_date: planDate }}
            slot={mealSlot}
            items={items}
            error="Dish name must be 200 characters or fewer"
            prefill={makePrefill()} />,
          422
        );
      }

      updateMealPlanItem(d, itemId, { mealSlot, dishName, notes });
      return c.redirect(`/plans/${planId}/days/${planDate}/slots/${mealSlot}/edit`, 303);
    });

    app.post("/plans/:planId/items/:itemId/delete", async (c) => {
      const planId = parsePositiveInt(c.req.param("planId"));
      const itemId = parsePositiveInt(c.req.param("itemId"));
      if (!planId || !itemId) return c.html(<Layout title="Bad Request"><p>Invalid ID</p></Layout>, 400);

      const d = getDatabase();
      const item = getMealPlanItemForPlan(d, planId, itemId);
      if (!item) return c.html(<Layout title="Not Found"><p>Item not found</p></Layout>, 404);

      const day = getMealPlanDayById(d, item.meal_plan_day_id);
      const planDate = day?.plan_date ?? "";

      deleteMealPlanItem(d, itemId);
      return c.redirect(`/plans/${planId}/days/${planDate}/slots/${item.meal_slot}/edit`, 303);
    });

    // ---------------------------------------------------------------------------
    // Ingredients
    // ---------------------------------------------------------------------------
    app.post("/plans/:planId/ingredients", async (c) => {
      const planId = parsePositiveInt(c.req.param("planId"));
      if (!planId) return c.html(<Layout title="Bad Request"><p>Invalid plan ID</p></Layout>, 400);

      const body = await c.req.parseBody();
      const name = String(body.name ?? "").trim();
      const quantityValueRaw = parseNonNegFloat(String(body.quantity_value ?? ""));
      const quantityUnit = String(body.quantity_unit ?? "g");
      const notes = String(body.notes ?? "").trim() || null;

      const d = getDatabase();
      const existing = getPlanDetail(d, planId);
      if (!existing) return c.html(<Layout title="Not Found"><p>Plan not found</p></Layout>, 404);

      const makePrefillIng = () => ({ name: String(body.name ?? ""), quantity_value: String(body.quantity_value ?? ""), quantity_unit: quantityUnit });

      const renderIngError = (error: string) => c.html(
        <Layout title={existing.plan.title}>
          <h1>{existing.plan.title}</h1>
          <p class="entry-meta">{existing.plan.start_date} → {existing.plan.end_date} · {existing.plan.status}</p>
          <div style="display:flex;gap:0.5rem;margin:0.75rem 0">
            <a href={`/plans/${planId}?tab=days`} class="btn btn-secondary btn-sm">Days</a>
            <a href={`/plans/${planId}?tab=ingredients`} class="btn btn-primary btn-sm">Ingredients</a>
            <a href={`/plans/${planId}/edit`} class="btn btn-secondary btn-sm">Edit Plan</a>
          </div>
          <IngredientTable plan={existing.plan} ingredients={existing.ingredients}
            error={error} prefill={makePrefillIng()} />
        </Layout>,
        422
      );

      if (!name) return renderIngError("Ingredient name is required");
      if (name.length > 200) return renderIngError("Ingredient name must be 200 characters or fewer");
      if (quantityValueRaw === null || quantityValueRaw < 0) return renderIngError("Invalid quantity value");
      if (!(INGREDIENT_UNITS as readonly string[]).includes(quantityUnit)) return renderIngError("Invalid unit");

      const quantityValue = quantityValueRaw;
      insertIngredientItem(d, { mealPlanId: planId, name, quantityValue, quantityUnit, notes });
      return c.redirect(`/plans/${planId}?tab=ingredients`, 303);
    });

    app.post("/plans/:planId/ingredients/:ingId", async (c) => {
      const planId = parsePositiveInt(c.req.param("planId"));
      const ingId = parsePositiveInt(c.req.param("ingId"));
      if (!planId || !ingId) return c.html(<Layout title="Bad Request"><p>Invalid ID</p></Layout>, 400);

      const d = getDatabase();
      const ing = getIngredientItemForPlan(d, planId, ingId);
      if (!ing) return c.html(<Layout title="Not Found"><p>Ingredient not found</p></Layout>, 404);

      const body = await c.req.parseBody();
      const name = String(body.name ?? "").trim();
      const quantityValueRaw = parseNonNegFloat(String(body.quantity_value ?? ""));
      const quantityUnit = String(body.quantity_unit ?? "g");
      const notes = String(body.notes ?? "").trim() || null;

      const detail = getPlanDetail(d, planId);
      const makePrefillUpd = () => ({ name: String(body.name ?? ""), quantity_value: String(body.quantity_value ?? ""), quantity_unit: quantityUnit });

      const renderUpdError = (error: string) => c.html(
        <Layout title={detail?.plan.title ?? "Plan"}>
          <h1>{detail?.plan.title ?? "Plan"}</h1>
          <p class="entry-meta">{detail?.plan.start_date} → {detail?.plan.end_date} · {detail?.plan.status}</p>
          <div style="display:flex;gap:0.5rem;margin:0.75rem 0">
            <a href={`/plans/${planId}?tab=days`} class="btn btn-secondary btn-sm">Days</a>
            <a href={`/plans/${planId}?tab=ingredients`} class="btn btn-primary btn-sm">Ingredients</a>
            <a href={`/plans/${planId}/edit`} class="btn btn-secondary btn-sm">Edit Plan</a>
          </div>
          <IngredientTable plan={detail!.plan} ingredients={detail?.ingredients ?? []}
            error={error} prefill={makePrefillUpd()} />
        </Layout>,
        422
      );

      if (!name) return renderUpdError("Ingredient name is required");
      if (name.length > 200) return renderUpdError("Ingredient name must be 200 characters or fewer");
      if (quantityValueRaw === null || quantityValueRaw < 0) return renderUpdError("Invalid quantity value");
      if (!(INGREDIENT_UNITS as readonly string[]).includes(quantityUnit)) return renderUpdError("Invalid unit");

      const quantityValue = quantityValueRaw;
      updateIngredientItem(d, ingId, { name, quantityValue, quantityUnit, notes });
      return c.redirect(`/plans/${planId}?tab=ingredients`, 303);
    });

    app.post("/plans/:planId/ingredients/:ingId/delete", async (c) => {
      const planId = parsePositiveInt(c.req.param("planId"));
      const ingId = parsePositiveInt(c.req.param("ingId"));
      if (!planId || !ingId) return c.html(<Layout title="Bad Request"><p>Invalid ID</p></Layout>, 400);

      const d = getDatabase();
      const ing = getIngredientItemForPlan(d, planId, ingId);
      if (!ing) return c.html(<Layout title="Not Found"><p>Ingredient not found</p></Layout>, 404);

      deleteIngredientItem(d, ingId);
      return c.redirect(`/plans/${planId}?tab=ingredients`, 303);
    });

    // ---------------------------------------------------------------------------
    // Admin reset
    // ---------------------------------------------------------------------------
    app.post("/admin/reset", async (c) => {
      if (!process.env.MOCK_ADMIN || process.env.MOCK_ADMIN !== "1") {
        return c.html(<Layout title="Not Found"><p>Not found</p></Layout>, 404);
      }

      const d = getDatabase();
      d.transaction(() => {
        d.run("DELETE FROM ingredient_item");
        d.run("DELETE FROM meal_plan_item");
        d.run("DELETE FROM meal_plan_day");
        d.run("DELETE FROM food_entry");
        d.run("DELETE FROM meal_plan");
        d.run("DELETE FROM daily_log");
      })();
      d.run("PRAGMA wal_checkpoint(FULL)");

      return c.redirect("/", 303);
    });
  },
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

const dataDir = process.env.MOCK_DATA_DIR ?? "/var/lib/mock-data/mint-diet";
const dbPath = `${dataDir}/mint-diet.sqlite`;

startServer(mockApp, {
  seed: () => {
    mkdirSync(dataDir, { recursive: true });
    db = new Database(dbPath, { create: true });
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA foreign_keys = ON");
    createTables(db);
    seedFoodCatalog(db);
  },
});
