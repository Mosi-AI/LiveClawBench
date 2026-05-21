import { z } from "zod";
import { ErrorResponseSchema } from "mock-lib";

// Common schemas
export const IdParamSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()),
});

export const DateParamSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, expected YYYY-MM-DD"),
});

export const EntryIdParamSchema = z.object({
  entryId: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()),
});

export const PlanIdParamSchema = z.object({
  planId: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()),
});

export const ItemIdParamSchema = z.object({
  itemId: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()),
});

export const IngIdParamSchema = z.object({
  ingId: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().int().positive()),
});

// Slot enum
export const MealSlotSchema = z.enum(["breakfast", "lunch", "dinner", "snacks"]);
export const PlanMealSlotSchema = z.enum(["breakfast", "lunch", "dinner"]);
export const PlanStatusSchema = z.enum(["draft", "active", "archived"]);

// Food Catalog schemas
export const FoodCatalogSchema = z.object({
  id: z.number(),
  food_name: z.string(),
  serving_size_value: z.number(),
  serving_size_unit: z.string(),
  calories_kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
});

export const SearchFoodQuerySchema = z.object({
  q: z.string().min(1).max(200),
});

// Log Entry schemas
export const FoodEntrySchema = z.object({
  id: z.number(),
  daily_log_id: z.number(),
  food_catalog_id: z.number().nullable(),
  meal_slot: MealSlotSchema,
  food_name: z.string(),
  quantity_value: z.number(),
  quantity_unit: z.string(),
  calories_kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  created_at: z.string(),
});

export const CreateFoodEntryBodySchema = z.object({
  slot: MealSlotSchema,
  food_catalog_id: z.coerce.number().int().positive().nullable().optional(),
  food_name: z.string().min(1).max(200),
  quantity_value: z.coerce.number().nonnegative(),
  quantity_unit: z.string(),
  calories_kcal: z.coerce.number().nonnegative().default(0),
  protein_g: z.coerce.number().nonnegative().default(0),
  carbs_g: z.coerce.number().nonnegative().default(0),
  fat_g: z.coerce.number().nonnegative().default(0),
});

export const UpdateFoodEntryBodySchema = z.object({
  food_name: z.string().min(1).max(200),
  quantity_value: z.coerce.number().nonnegative(),
  quantity_unit: z.string(),
  calories_kcal: z.coerce.number().nonnegative().default(0),
  protein_g: z.coerce.number().nonnegative().default(0),
  carbs_g: z.coerce.number().nonnegative().default(0),
  fat_g: z.coerce.number().nonnegative().default(0),
});

// Meal Plan schemas
export const MealPlanSchema = z.object({
  id: z.number(),
  title: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  status: PlanStatusSchema,
  target_calories_kcal: z.number().nullable(),
  notes: z.string().nullable(),
});

export const CreateMealPlanBodySchema = z.object({
  title: z.string().min(1).max(200),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: PlanStatusSchema.default("draft"),
  target_calories_kcal: z.coerce.number().nonnegative().nullable().optional(),
  notes: z.string().optional().nullable(),
}).refine((data) => data.start_date <= data.end_date, {
  message: "Start date must be before or equal to end date",
  path: ["start_date"],
});

export const UpdateMealPlanBodySchema = CreateMealPlanBodySchema;

export const MealPlanDaySchema = z.object({
  id: z.number(),
  meal_plan_id: z.number(),
  plan_date: z.string(),
});

export const MealPlanItemSchema = z.object({
  id: z.number(),
  meal_plan_day_id: z.number(),
  meal_slot: PlanMealSlotSchema,
  dish_name: z.string(),
  notes: z.string().nullable(),
});

export const CreatePlanItemBodySchema = z.object({
  plan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal_slot: PlanMealSlotSchema,
  dish_name: z.string().min(1).max(200),
  notes: z.string().optional().nullable(),
});

export const UpdatePlanItemBodySchema = z.object({
  meal_slot: PlanMealSlotSchema,
  dish_name: z.string().min(1).max(200),
  notes: z.string().optional().nullable(),
});

// Ingredient schemas
export const IngredientItemSchema = z.object({
  id: z.number(),
  meal_plan_id: z.number(),
  name: z.string(),
  quantity_value: z.number(),
  quantity_unit: z.string(),
  notes: z.string().nullable(),
});

export const CreateIngredientBodySchema = z.object({
  name: z.string().min(1).max(200),
  quantity_value: z.coerce.number().nonnegative(),
  quantity_unit: z.enum(["g", "kg", "ml", "l", "cup", "tbsp", "tsp", "oz", "lb", "piece", "slice", "serving"]),
  notes: z.string().optional().nullable(),
});

export const UpdateIngredientBodySchema = CreateIngredientBodySchema;

// Daily Log schema
export const DailyLogSchema = z.object({
  id: z.number(),
  log_date: z.string(),
});

// Response wrapper schemas
export function OkSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    message: z.string().optional(),
    data: dataSchema,
  });
}

export const ErrSchema = ErrorResponseSchema;
