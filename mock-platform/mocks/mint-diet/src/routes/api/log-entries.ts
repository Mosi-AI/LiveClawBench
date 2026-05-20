import { z } from "zod";
import { createRoute, ok, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import {
  isValidLocalDate,
  scaleMacros,
  insertFoodEntry,
  updateFoodEntry,
  deleteFoodEntry,
  getFoodEntry,
  getFoodById,
  ensureDailyLog,
  listEntriesByDay,
  computeDailyTotals,
  resolveEffectiveBudget,
  type FoodEntryInput,
  type FoodEntryUpdateInput,
} from "../../queries";
import { isCatalogQuantityUnit, parseManualMacros } from "../log-shared";
import {
  DateParamSchema,
  EntryIdParamSchema,
  FoodEntrySchema,
  CreateFoodEntryBodySchema,
  UpdateFoodEntryBodySchema,
  DailyLogSchema,
  OkSchema,
  ErrSchema,
} from "./schemas";

export function registerLogEntryRoutes(
  app: OpenAPIApp,
  getDatabase: () => Database
) {
  // GET /api/log/:date
  const getLogRoute = createRoute({
    method: "get",
    path: "/api/log/{date}",
    summary: "Get daily log with entries",
    request: {
      params: DateParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OkSchema(
              z.object({
                date: z.string(),
                log: DailyLogSchema.nullable(),
                entries: z.array(FoodEntrySchema),
                totals: z.object({
                  calories: z.number(),
                  protein: z.number(),
                  carbs: z.number(),
                  fat: z.number(),
                }),
              })
            ),
          },
        },
        description: "OK",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Bad Request",
      },
    },
  });

  app.openApiRoute(getLogRoute, (c) => {
    const { date } = c.req.valid("param");

    if (!isValidLocalDate(date)) {
      return c.json(err("Invalid date format"), 400);
    }

    const d = getDatabase();

    // Get or create daily log
    const log = ensureDailyLog(d, date);

    // Get entries
    const entries = listEntriesByDay(d, log.id);
    const totals = computeDailyTotals(d, log.id);

    return c.json(
      ok({
        date,
        log,
        entries,
        totals,
      })
    );
  });

  // POST /api/log/:date/entries
  const createEntryRoute = createRoute({
    method: "post",
    path: "/api/log/{date}/entries",
    summary: "Create food entry",
    request: {
      params: DateParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CreateFoodEntryBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: OkSchema(FoodEntrySchema),
          },
        },
        description: "Created",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Bad Request",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Not Found",
      },
    },
  });

  app.openApiRoute(createEntryRoute, (c) => {
    const { date } = c.req.valid("param");
    const body = c.req.valid("json");

    if (!isValidLocalDate(date)) {
      return c.json(err("Invalid date format"), 400);
    }

    const d = getDatabase();

    // Get or create daily log
    const log = ensureDailyLog(d, date);

    // Calculate nutrition
    let caloriesKcal = 0;
    let proteinG = 0;
    let carbsG = 0;
    let fatG = 0;

    const foodCatalogId = body.food_catalog_id ?? null;
    const quantityValue = body.quantity_value;
    const quantityUnit = body.quantity_unit;

    if (foodCatalogId) {
      const catalog = getFoodById(d, foodCatalogId);
      if (!catalog) {
        return c.json(err("Food catalog item not found"), 404);
      }

      // Validate quantity unit
      if (!isCatalogQuantityUnit(catalog, quantityUnit)) {
        return c.json(err("Invalid quantity unit for selected food"), 400);
      }

      try {
        const macros = scaleMacros(catalog, quantityValue, quantityUnit);
        caloriesKcal = Math.round(macros.calories);
        proteinG = Math.round(macros.protein * 10) / 10;
        carbsG = Math.round(macros.carbs * 10) / 10;
        fatG = Math.round(macros.fat * 10) / 10;
      } catch (e) {
        return c.json(err("Failed to calculate nutrition from catalog"), 400);
      }
    } else {
      const macros = parseManualMacros(body as Record<string, unknown>);
      if ("error" in macros) {
        return c.json(err(macros.error), 400);
      }
      caloriesKcal = macros.values.caloriesKcal;
      proteinG = macros.values.proteinG;
      carbsG = macros.values.carbsG;
      fatG = macros.values.fatG;
    }

    if (caloriesKcal > 100000) {
      return c.json(err("Calories value too large (max 100000)"), 400);
    }

    const input: FoodEntryInput = {
      dailyLogId: log.id,
      foodCatalogId,
      mealSlot: body.slot,
      foodName: body.food_name,
      quantityValue,
      quantityUnit,
      caloriesKcal,
      proteinG,
      carbsG,
      fatG,
    };

    const entryId = insertFoodEntry(d, input);
    const entry = getFoodEntry(d, entryId);

    if (!entry) {
      return c.json(err("Failed to create entry"), 500);
    }

    return c.json(ok(entry), 201);
  });

  // PUT /api/log/entries/:entryId
  const updateEntryRoute = createRoute({
    method: "put",
    path: "/api/log/entries/{entryId}",
    summary: "Update food entry",
    request: {
      params: EntryIdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateFoodEntryBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OkSchema(FoodEntrySchema),
          },
        },
        description: "OK",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Bad Request",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Not Found",
      },
    },
  });

  app.openApiRoute(updateEntryRoute, (c) => {
    const { entryId } = c.req.valid("param");
    const body = c.req.valid("json");
    const d = getDatabase();

    const existing = getFoodEntry(d, entryId);
    if (!existing) {
      return c.json(err("Entry not found"), 404);
    }

    // Calculate nutrition
    let caloriesKcal = existing.calories_kcal;
    let proteinG = existing.protein_g;
    let carbsG = existing.carbs_g;
    let fatG = existing.fat_g;

    const quantityValue = body.quantity_value;
    const quantityUnit = body.quantity_unit;

    if (existing.food_catalog_id) {
      const catalog = getFoodById(d, existing.food_catalog_id);
      if (!catalog) {
        return c.json(err("Food catalog item not found"), 404);
      }

      // Validate quantity unit
      if (!isCatalogQuantityUnit(catalog, quantityUnit)) {
        return c.json(err("Invalid quantity unit for selected food"), 400);
      }

      try {
        const macros = scaleMacros(catalog, quantityValue, quantityUnit);
        caloriesKcal = Math.round(macros.calories);
        proteinG = Math.round(macros.protein * 10) / 10;
        carbsG = Math.round(macros.carbs * 10) / 10;
        fatG = Math.round(macros.fat * 10) / 10;
      } catch (e) {
        return c.json(err("Failed to calculate nutrition from catalog"), 400);
      }
    } else {
      const macros = parseManualMacros(body as Record<string, unknown>);
      if ("error" in macros) {
        return c.json(err(macros.error), 400);
      }
      caloriesKcal = macros.values.caloriesKcal;
      proteinG = macros.values.proteinG;
      carbsG = macros.values.carbsG;
      fatG = macros.values.fatG;
    }

    if (caloriesKcal > 100000) {
      return c.json(err("Calories value too large (max 100000)"), 400);
    }

    const input: FoodEntryUpdateInput = {
      foodName: body.food_name,
      quantityValue,
      quantityUnit,
      caloriesKcal,
      proteinG,
      carbsG,
      fatG,
    };

    updateFoodEntry(d, entryId, input);

    const entry = getFoodEntry(d, entryId);
    if (!entry) {
      return c.json(err("Failed to update entry"), 500);
    }

    return c.json(ok(entry));
  });

  // DELETE /api/log/entries/:entryId
  const deleteEntryRoute = createRoute({
    method: "delete",
    path: "/api/log/entries/{entryId}",
    summary: "Delete food entry",
    request: {
      params: EntryIdParamSchema,
    },
    responses: {
      204: {
        description: "No Content",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Not Found",
      },
    },
  });

  app.openApiRoute(deleteEntryRoute, (c) => {
    const { entryId } = c.req.valid("param");
    const d = getDatabase();

    const existing = getFoodEntry(d, entryId);
    if (!existing) {
      return c.json(err("Entry not found"), 404);
    }

    deleteFoodEntry(d, entryId);

    return new Response(null, { status: 204 });
  });
}
