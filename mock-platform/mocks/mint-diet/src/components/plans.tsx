import type { FC } from "hono/jsx";
import { INGREDIENT_UNITS, PLAN_SLOTS } from "../constants";
import type { IngredientItem, MealPlan, MealPlanDay, MealPlanItem } from "../queries";
import { Layout } from "./Layout";

export const PlanCard: FC<{ plan: MealPlan }> = ({ plan }) => (
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

export const PlanForm: FC<PlanFormProps> = ({ plan, error, prefill }) => {
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

export const PlanDayGrid: FC<PlanDayGridProps> = ({ plan, days, itemsByDayBySlot }) => (
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

export const IngredientTable: FC<IngredientTableProps> = ({ plan, ingredients, error, prefill }) => (
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
                      <button type="submit" formaction={`/plans/${plan.id}/ingredients/${ing.id}/delete`} class="btn btn-danger btn-sm">Del</button>
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

interface PlanDetailPageProps {
  plan: MealPlan;
  days: MealPlanDay[];
  itemsByDayBySlot: Record<number, Record<string, MealPlanItem[]>>;
  ingredients: IngredientItem[];
  tab: string;
  ingredientError?: string;
  ingredientPrefill?: Record<string, string>;
}

export const PlanDetailPage: FC<PlanDetailPageProps> = ({
  plan,
  days,
  itemsByDayBySlot,
  ingredients,
  tab,
  ingredientError,
  ingredientPrefill,
}) => (
  <Layout title={plan.title}>
    <h1>{plan.title}</h1>
    <p class="entry-meta">{plan.start_date} → {plan.end_date} · {plan.status}</p>
    <div style="display:flex;gap:0.5rem;margin:0.75rem 0">
      <a href={`/plans/${plan.id}?tab=days`} class={`btn ${tab === "days" ? "btn-primary" : "btn-secondary"} btn-sm`}>Days</a>
      <a href={`/plans/${plan.id}?tab=ingredients`} class={`btn ${tab === "ingredients" ? "btn-primary" : "btn-secondary"} btn-sm`}>Ingredients</a>
      <a href={`/plans/${plan.id}/edit`} class="btn btn-secondary btn-sm">Edit Plan</a>
    </div>
    {tab === "days" ? (
      <PlanDayGrid plan={plan} days={days} itemsByDayBySlot={itemsByDayBySlot} />
    ) : (
      <IngredientTable plan={plan} ingredients={ingredients} error={ingredientError} prefill={ingredientPrefill} />
    )}
  </Layout>
);

interface SlotEditorPageProps {
  plan: MealPlan;
  day: MealPlanDay;
  slot: string;
  items: MealPlanItem[];
  error?: string;
  prefill?: Record<string, string>;
}

export const SlotEditorPage: FC<SlotEditorPageProps> = ({ plan, day, slot, items, error, prefill }) => (
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
            <button type="submit" formaction={`/plans/${plan.id}/items/${item.id}/delete`} class="btn btn-danger btn-sm">Del</button>
          </div>
        </form>
      </div>
    ))}
  </Layout>
);
