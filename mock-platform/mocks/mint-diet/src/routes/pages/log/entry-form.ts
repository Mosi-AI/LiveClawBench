import type { Database } from "bun:sqlite";
import {
  getFoodById,
  scaleMacros,
  type FoodEntry,
  type FoodEntryInput,
  type FoodEntryUpdateInput,
  type MealSlot,
} from "../../../queries";
import { CATALOG_MISSING_ERROR } from "../../../constants";
import { isCatalogQuantityUnit, parseManualMacros } from "../../log-shared";
import { parseNonNegFloat, parsePositiveInt } from "../../helpers";

type FormBody = Record<string, unknown>;

type ParsedEntryForm = {
  foodName: string;
  quantityValue: number;
  quantityUnit: string;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

type ParseResult<T> = { values: T } | { error: string };

export function parseNewEntryForm(
  db: Database,
  body: FormBody,
): ParseResult<ParsedEntryForm & { foodCatalogId: number | null }> {
  const foodCatalogIdRaw = body.food_catalog_id
    ? String(body.food_catalog_id)
    : null;
  const foodCatalogId = foodCatalogIdRaw
    ? parsePositiveInt(foodCatalogIdRaw)
    : null;

  if (foodCatalogIdRaw && !foodCatalogId) {
    return { error: "Invalid selected food" };
  }

  const parsed = parseEntryNutrition(db, body, foodCatalogId);
  if ("error" in parsed) return parsed;

  return { values: { ...parsed.values, foodCatalogId } };
}

export function parseExistingEntryForm(
  db: Database,
  body: FormBody,
  entry: FoodEntry,
): ParseResult<ParsedEntryForm> {
  return parseEntryNutrition(db, body, entry.food_catalog_id);
}

export function toEntryInput(
  values: ParsedEntryForm & { foodCatalogId: number | null },
  dailyLogId: number,
  mealSlot: MealSlot,
): FoodEntryInput {
  return {
    dailyLogId,
    foodCatalogId: values.foodCatalogId,
    mealSlot,
    foodName: values.foodName,
    quantityValue: values.quantityValue,
    quantityUnit: values.quantityUnit,
    caloriesKcal: values.caloriesKcal,
    proteinG: values.proteinG,
    carbsG: values.carbsG,
    fatG: values.fatG,
  };
}

export function toEntryUpdateInput(values: ParsedEntryForm): FoodEntryUpdateInput {
  return {
    foodName: values.foodName,
    quantityValue: values.quantityValue,
    quantityUnit: values.quantityUnit,
    caloriesKcal: values.caloriesKcal,
    proteinG: values.proteinG,
    carbsG: values.carbsG,
    fatG: values.fatG,
  };
}

function parseEntryNutrition(
  db: Database,
  body: FormBody,
  foodCatalogId: number | null,
): ParseResult<ParsedEntryForm> {
  const foodName = String(body.food_name ?? "").trim();
  const quantityValue = parseNonNegFloat(String(body.quantity_value ?? ""));
  const quantityUnit = String(body.quantity_unit ?? "");

  if (!foodName) return { error: "Food name is required" };
  if (foodName.length > 200) {
    return { error: "Food name must be 200 characters or fewer" };
  }
  if (quantityValue === null || quantityValue < 0) {
    return { error: "Invalid quantity" };
  }

  if (foodCatalogId) {
    const catalog = getFoodById(db, foodCatalogId);
    if (!catalog) return { error: CATALOG_MISSING_ERROR };
    if (!isCatalogQuantityUnit(catalog, quantityUnit)) {
      return { error: "Invalid quantity unit for selected food" };
    }

    try {
      const macros = scaleMacros(catalog, quantityValue, quantityUnit);
      if (macros.calories > 100000) {
        return { error: "Calories value too large (max 100000)" };
      }
      return {
        values: {
          foodName,
          quantityValue,
          quantityUnit,
          caloriesKcal: macros.calories,
          proteinG: macros.protein,
          carbsG: macros.carbs,
          fatG: macros.fat,
        },
      };
    } catch (err) {
      console.error("Failed to scale catalog macros", err);
      return { error: "Selected food has invalid catalog nutrition data" };
    }
  }

  const macros = parseManualMacros(body);
  if ("error" in macros) return { error: macros.error };
  if (macros.values.caloriesKcal > 100000) {
    return { error: "Calories value too large (max 100000)" };
  }

  return {
    values: {
      foodName,
      quantityValue,
      quantityUnit,
      caloriesKcal: macros.values.caloriesKcal,
      proteinG: macros.values.proteinG,
      carbsG: macros.values.carbsG,
      fatG: macros.values.fatG,
    },
  };
}
