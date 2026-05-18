import type { FC } from "hono/jsx";
import { localDateStr, todayLocal } from "../date";
import type { DailyTotals, EffectiveBudget, FoodCatalog, FoodEntry } from "../queries";
import { Layout } from "./Layout";

export const DayNav: FC<{ date: string }> = ({ date }) => {
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

export const SummaryPanel: FC<SummaryPanelProps> = ({ totals, budget }) => {
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

export const MealSlotCard: FC<MealSlotCardProps> = ({ slot, entries, date }) => {
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

export const SearchResultRow: FC<SearchResultRowProps> = ({ food, date, slot }) => (
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

export const EntryForm: FC<EntryFormProps> = ({ date, slot, food, entry, searchResults, query, error, prefill }) => {
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
