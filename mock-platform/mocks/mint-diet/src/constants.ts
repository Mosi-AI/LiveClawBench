import type { MealSlot, PlanMealSlot, PlanStatus } from "./queries";

export const LOG_SLOTS = ["breakfast", "lunch", "dinner", "snacks"] as const satisfies readonly MealSlot[];
export const PLAN_SLOTS = ["breakfast", "lunch", "dinner"] as const satisfies readonly PlanMealSlot[];
export const INGREDIENT_UNITS = ["g", "ml", "包", "个"] as const;
export const PLAN_STATUSES = ["draft", "active", "archived"] as const satisfies readonly PlanStatus[];
export const CATALOG_MISSING_ERROR = "Selected food no longer exists in the catalog. Please search again.";
