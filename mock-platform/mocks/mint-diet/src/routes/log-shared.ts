import type { FoodCatalog } from "../queries";

export interface ManualMacroValues {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const MANUAL_MACRO_FIELDS = [
  ["calories_kcal", "calories", "caloriesKcal"],
  ["protein_g", "protein", "proteinG"],
  ["carbs_g", "carbs", "carbsG"],
  ["fat_g", "fat", "fatG"],
] as const;

export function isCatalogQuantityUnit(
  catalog: { serving_size_unit: string },
  quantityUnit: string
): boolean {
  return (
    quantityUnit === catalog.serving_size_unit || quantityUnit === "份"
  );
}

export function parseManualMacros(
  body: Record<string, unknown>
): { values: ManualMacroValues } | { error: string } {
  const values: ManualMacroValues = {
    caloriesKcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
  };

  for (const [bodyKey, label, valueKey] of MANUAL_MACRO_FIELDS) {
    const raw = String(body[bodyKey] ?? "").trim();
    if (!raw) continue;

    const value = parseNonNegFloat(raw);
    if (value === null) return { error: `Invalid ${label} value` };
    (values as Record<string, number>)[valueKey] = value;
  }

  return { values };
}

function parseNonNegFloat(s: string | undefined): number | null {
  if (s === undefined || s === "") return null;
  const n = Number(s);
  if (!isNaN(n) && isFinite(n) && n >= 0) return n;
  return null;
}
