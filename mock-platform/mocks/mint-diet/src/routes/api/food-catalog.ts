import { z } from "zod";
import { createRoute, ok, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import {
  FoodCatalogSchema,
  SearchFoodQuerySchema,
  IdParamSchema,
  OkSchema,
  ErrSchema,
} from "./schemas";

export function registerFoodCatalogRoutes(
  app: OpenAPIApp,
  getDatabase: () => Database
) {
  // GET /api/food-catalog/search
  const searchFoodRoute = createRoute({
    method: "get",
    path: "/api/food-catalog/search",
    summary: "Search food catalog",
    request: {
      query: SearchFoodQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OkSchema(z.array(FoodCatalogSchema)),
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

  app.openApiRoute(searchFoodRoute, (c) => {
    const { q } = c.req.valid("query");
    const d = getDatabase();

    const rows = d
      .query(
        `SELECT id, name, serving_size_value, serving_size_unit,
                calories_kcal, protein_g, carbs_g, fat_g
         FROM food_catalog
         WHERE name LIKE ?
         ORDER BY name
         LIMIT 50`
      )
      .all(`%${q}%`) as Array<{
      id: number;
      name: string;
      serving_size_value: number;
      serving_size_unit: string;
      calories_kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    }>;

    // Map DB column 'name' to API field 'food_name'
    const results = rows.map((row) => ({
      id: row.id,
      food_name: row.name,
      serving_size_value: row.serving_size_value,
      serving_size_unit: row.serving_size_unit,
      calories_kcal: row.calories_kcal,
      protein_g: row.protein_g,
      carbs_g: row.carbs_g,
      fat_g: row.fat_g,
    }));

    return c.json(ok(results));
  });

  // GET /api/food-catalog/:id
  const getFoodRoute = createRoute({
    method: "get",
    path: "/api/food-catalog/{id}",
    summary: "Get food by ID",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OkSchema(FoodCatalogSchema),
          },
        },
        description: "OK",
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

  app.openApiRoute(getFoodRoute, (c) => {
    const { id } = c.req.valid("param");
    const d = getDatabase();

    const row = d
      .query(
        `SELECT id, name, serving_size_value, serving_size_unit,
                calories_kcal, protein_g, carbs_g, fat_g
         FROM food_catalog WHERE id = ?`
      )
      .get(id) as {
      id: number;
      name: string;
      serving_size_value: number;
      serving_size_unit: string;
      calories_kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    } | null;

    if (!row) {
      return c.json(err("Food not found"), 404);
    }

    // Map DB column 'name' to API field 'food_name'
    const food = {
      id: row.id,
      food_name: row.name,
      serving_size_value: row.serving_size_value,
      serving_size_unit: row.serving_size_unit,
      calories_kcal: row.calories_kcal,
      protein_g: row.protein_g,
      carbs_g: row.carbs_g,
      fat_g: row.fat_g,
    };

    return c.json(ok(food));
  });
}
