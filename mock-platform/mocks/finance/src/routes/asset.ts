import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { z } from "zod";
import { AssetEditSchema, AssetResponseSchema } from "../schemas/asset";
import { IdParamSchema } from "../schemas/common";
import { round2 } from "../utils";

export function registerAssetRoutes(app: OpenAPIApp, db: Database) {
  const listRoute = createRoute({
    method: "get",
    path: "/api/assets",
    summary: "List assets",
    responses: {
      200: { description: "List of assets" },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const rows = db.query("SELECT * FROM asset_record").all();
    return c.json({ data: rows });
  }, { auth: "required" });

  const detailRoute = createRoute({
    method: "get",
    path: "/api/assets/{id}",
    summary: "Get asset",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: "Asset detail",
        content: { "application/json": { schema: AssetResponseSchema } },
      },
      404: { description: "Not found" },
    },
  });

  app.openApiRoute(detailRoute, (c) => {
    const id = Number(c.req.param("id"));
    const row = db
      .query("SELECT * FROM asset_record WHERE id = ?")
      .get(id);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json(row);
  }, { auth: "required" });

  const editRoute = createRoute({
    method: "post",
    path: "/api/assets/{id}",
    summary: "Edit asset",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": { schema: AssetEditSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Updated",
        content: { "application/json": { schema: AssetResponseSchema } },
      },
      400: { description: "Invalid input" },
      404: { description: "Not found" },
    },
  });

  app.openApiRoute(editRoute, async (c) => {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const { cost_basis, residual_value, useful_life_years, depreciation_method, annual_depreciation, correction_reason } = body;

    if (!correction_reason || correction_reason.trim() === "") {
      return c.json({ error: "correction_reason is required" }, 400);
    }

    const existing = db
      .query("SELECT id FROM asset_record WHERE id = ?")
      .get(id);
    if (!existing) return c.json({ error: "Not found" }, 404);

    db.run(
      `UPDATE asset_record SET
        cost_basis = ?, residual_value = ?, useful_life_years = ?,
        depreciation_method = ?, annual_depreciation = ?, correction_reason = ?,
        updated_at = datetime('now')
      WHERE id = ?`,
      [
        round2(cost_basis),
        round2(residual_value),
        useful_life_years,
        depreciation_method,
        round2(annual_depreciation),
        correction_reason,
        id,
      ]
    );

    const row = db
      .query("SELECT * FROM asset_record WHERE id = ?")
      .get(id);
    return c.json(row);
  }, { auth: "required" });
}
