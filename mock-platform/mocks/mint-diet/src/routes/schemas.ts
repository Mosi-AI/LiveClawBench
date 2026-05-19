import { z } from "zod";
import { INGREDIENT_UNITS, LOG_SLOTS, PLAN_SLOTS, PLAN_STATUSES } from "../constants";
import { isValidLocalDate } from "../queries";

const NON_NEGATIVE_NUMBER_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function requiredText(label: string) {
  return z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(200, `${label} must be 200 characters or fewer`);
}

function optionalText() {
  return z
    .string()
    .optional()
    .default("")
    .transform((value) => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    });
}

function requiredUnit(label: string) {
  return z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(32, `${label} must be 32 characters or fewer`);
}

function nonNegativeFormNumber(label: string) {
  return z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .regex(NON_NEGATIVE_NUMBER_PATTERN, `Invalid ${label}`)
    .transform(Number)
    .pipe(z.number().finite(`Invalid ${label}`).nonnegative(`${label} must be non-negative`));
}

function optionalNonNegativeFormNumber(label: string) {
  return z
    .string()
    .optional()
    .default("")
    .transform((value) => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? Number(trimmed) : null;
    })
    .pipe(z.number().finite(`Invalid ${label}`).nonnegative(`${label} must be non-negative`).nullable());
}

function optionalPositiveInt() {
  return z
    .string()
    .optional()
    .default("")
    .transform((value) => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? Number(trimmed) : null;
    })
    .pipe(z.number().int().positive().nullable());
}

function optionalMacroNumber(label: string, max?: number) {
  let schema = z
    .number({ invalid_type_error: `Invalid ${label} value` })
    .finite(`Invalid ${label} value`)
    .nonnegative(`Invalid ${label} value`);

  if (max !== undefined) {
    schema = schema.max(max, `${label} value too large (max ${max})`);
  }

  return z
    .string()
    .optional()
    .default("")
    .transform((value) => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? Number(trimmed) : 0;
    })
    .pipe(schema);
}

function planSpanDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

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
  .string({ required_error: "Date is required" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid local date" })
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
  food_catalog_id: optionalPositiveInt(),
  food_name: requiredText("Food name"),
  quantity_value: nonNegativeFormNumber("quantity"),
  quantity_unit: requiredUnit("Quantity unit"),
  calories_kcal: optionalMacroNumber("Calories", 100000),
  protein_g: optionalMacroNumber("protein"),
  carbs_g: optionalMacroNumber("carbs"),
  fat_g: optionalMacroNumber("fat"),
});

export const UpdateFoodEntryFormSchema = CreateFoodEntryFormSchema.omit({
  slot: true,
});

export const PlanFormSchema = z
  .object({
    title: requiredText("Title"),
    start_date: LocalDateSchema,
    end_date: LocalDateSchema,
    status: z.enum(PLAN_STATUSES).optional().default("draft"),
    target_calories_kcal: optionalNonNegativeFormNumber("calorie target"),
    notes: optionalText(),
  })
  .superRefine((body, ctx) => {
    if (body.start_date > body.end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["start_date"],
        message: "Start date must be before end date",
      });
      return;
    }

    if (planSpanDays(body.start_date, body.end_date) > 365) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "Plan span must be 365 days or fewer",
      });
    }
  });

export const MealPlanItemFormSchema = z.object({
  plan_date: LocalDateSchema,
  meal_slot: z.enum(PLAN_SLOTS),
  dish_name: requiredText("Dish name"),
  notes: optionalText(),
});

export const UpdateMealPlanItemFormSchema = MealPlanItemFormSchema.pick({
  meal_slot: true,
  dish_name: true,
  notes: true,
});

export const IngredientFormSchema = z.object({
  name: requiredText("Ingredient name"),
  quantity_value: nonNegativeFormNumber("quantity value"),
  quantity_unit: z.enum(INGREDIENT_UNITS).optional().default("g"),
  notes: optionalText(),
});
