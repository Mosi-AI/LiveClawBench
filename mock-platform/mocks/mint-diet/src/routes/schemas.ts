import { z } from "zod";
import { INGREDIENT_UNITS, LOG_SLOTS, PLAN_SLOTS, PLAN_STATUSES } from "../constants";
import { isValidLocalDate } from "../queries";

const formString = z.string().optional().default("");

export const RedirectResponse = {
  description: "Redirect",
} as const;

export const HtmlResponse = {
  description: "HTML response",
} as const;

export function formRequest<T extends z.ZodTypeAny>(schema: T): {
  body: {
    required: true;
    content: {
      "application/x-www-form-urlencoded": {
        schema: T;
      };
    };
  };
} {
  return {
    body: {
      required: true,
      content: {
        "application/x-www-form-urlencoded": {
          schema,
        },
      },
    },
  };
}

export const SentinelResponseSchema = z.object({
  mock: z.literal("mint-diet"),
  sentinel: z.boolean(),
});

export const LocalDateSchema = z
  .string()
  .refine(isValidLocalDate, { message: "Invalid local date" });

export const PositiveIntSchema = z.coerce.number().int().positive();

export const LogDateParamSchema = z.object({
  date: LocalDateSchema,
});

export const EntryIdParamSchema = z.object({
  entryId: PositiveIntSchema,
});

export const PlanIdParamSchema = z.object({
  planId: PositiveIntSchema,
});

export const PlanItemParamSchema = z.object({
  planId: PositiveIntSchema,
  itemId: PositiveIntSchema,
});

export const PlanIngredientParamSchema = z.object({
  planId: PositiveIntSchema,
  ingId: PositiveIntSchema,
});

export const CreateFoodEntryFormSchema = z.object({
  slot: z.enum(LOG_SLOTS),
  food_catalog_id: formString,
  food_name: formString,
  quantity_value: formString,
  quantity_unit: formString,
  calories_kcal: formString,
  protein_g: formString,
  carbs_g: formString,
  fat_g: formString,
});

export const UpdateFoodEntryFormSchema = CreateFoodEntryFormSchema.omit({
  slot: true,
});

export const PlanFormSchema = z.object({
  title: formString,
  start_date: formString,
  end_date: formString,
  status: z.enum(PLAN_STATUSES).optional().default("draft"),
  target_calories_kcal: formString,
  notes: formString,
});

export const MealPlanItemFormSchema = z.object({
  plan_date: LocalDateSchema,
  meal_slot: z.enum(PLAN_SLOTS),
  dish_name: formString,
  notes: formString,
});

export const UpdateMealPlanItemFormSchema = MealPlanItemFormSchema.pick({
  meal_slot: true,
  dish_name: true,
  notes: true,
});

export const IngredientFormSchema = z.object({
  name: formString,
  quantity_value: formString,
  quantity_unit: z.enum(INGREDIENT_UNITS).optional().default("g"),
  notes: formString,
});
