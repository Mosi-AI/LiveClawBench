import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { z } from "zod";
import {
  AllergenSchema,
  AllergenListQuerySchema,
  CreateAllergenBodySchema,
  UpdateAllergenBodySchema,
  PaginationResponseSchema,
  ErrorResponseSchema,
} from "../schemas";
import { errorResponse } from "../utils/errors";
import { initDb } from "../db";
import { getNow } from "../utils/clock";

export function registerAllergenRoutes(app: OpenAPIApp) {
  // GET /api/allergens
  const listRoute = createRoute({
    method: "get",
    path: "/api/allergens",
    summary: "List allergens",
    request: { query: AllergenListQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              allergens: z.array(AllergenSchema),
              pagination: PaginationResponseSchema,
            }),
          },
        },
        description: "Allergen list with pagination",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Validation error",
      },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const { page, page_size } = c.req.valid("query");
    const db = initDb();
    const total = (db.query("SELECT COUNT(*) as c FROM allergen WHERE user_id = 1 AND archived = 0").get() as any).c;
    const offset = (page - 1) * page_size;
    const allergens = db.query(
      "SELECT * FROM allergen WHERE user_id = 1 AND archived = 0 ORDER BY id DESC LIMIT ? OFFSET ?"
    ).all(page_size, offset);
    return c.json({
      allergens,
      pagination: { total, total_pages: Math.ceil(total / page_size), current_page: page, page_size },
    });
  });

  // POST /api/allergens
  const createRoute_ = createRoute({
    method: "post",
    path: "/api/allergens",
    summary: "Create an allergen",
    request: {
      body: { content: { "application/json": { schema: CreateAllergenBodySchema } } },
    },
    responses: {
      201: {
        content: { "application/json": { schema: AllergenSchema } },
        description: "Created",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Validation error",
      },
      409: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Conflict",
      },
    },
  });

  app.openApiRoute(createRoute_, (c) => {
    const body = c.req.valid("json");
    const db = initDb();
    const existing = db.query("SELECT id FROM allergen WHERE user_id = 1 AND name = ? AND archived = 0").get(body.name);
    if (existing) {
      return errorResponse(c, "CONFLICT" as any, `Allergen "${body.name}" already exists`);
    }
    const now = getNow();
    const result = db.query(
      "INSERT INTO allergen (user_id, name, severity, notes, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?) RETURNING *"
    ).get(body.name, body.severity ?? null, body.notes ?? null, now, now) as any;
    return c.json(result, 201);
  });

  // GET /api/allergens/{id}
  const getRoute = createRoute({
    method: "get",
    path: "/api/allergens/{id}",
    summary: "Get allergen by ID",
    request: { params: z.object({ id: z.coerce.number().int() }) },
    responses: {
      200: {
        content: { "application/json": { schema: AllergenSchema } },
        description: "Allergen detail",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(getRoute, (c) => {
    const { id } = c.req.valid("param");
    const db = initDb();
    const row = db.query("SELECT * FROM allergen WHERE id = ? AND user_id = 1").get(id);
    if (!row) return errorResponse(c, "NOT_FOUND", `Allergen with id ${id} not found`);
    return c.json(row);
  });

  // PUT /api/allergens/{id}
  const updateRoute = createRoute({
    method: "put",
    path: "/api/allergens/{id}",
    summary: "Update an allergen",
    request: {
      params: z.object({ id: z.coerce.number().int() }),
      body: { content: { "application/json": { schema: UpdateAllergenBodySchema } } },
    },
    responses: {
      200: {
        content: { "application/json": { schema: AllergenSchema } },
        description: "Updated",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
      409: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Conflict",
      },
    },
  });

  app.openApiRoute(updateRoute, (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = initDb();
    const existing = db.query("SELECT * FROM allergen WHERE id = ? AND user_id = 1").get(id) as any;
    if (!existing) return errorResponse(c, "NOT_FOUND", `Allergen with id ${id} not found`);
    if (body.name && body.name !== existing.name) {
      const dup = db.query("SELECT id FROM allergen WHERE user_id = 1 AND name = ? AND archived = 0 AND id != ?").get(body.name, id);
      if (dup) return errorResponse(c, "CONFLICT" as any, `Allergen "${body.name}" already exists`);
    }
    const now = getNow();
    const updated = db.query(
      "UPDATE allergen SET name = ?, severity = ?, notes = ?, updated_at = ? WHERE id = ? RETURNING *"
    ).get(
      body.name ?? existing.name,
      body.severity !== undefined ? body.severity : existing.severity,
      body.notes !== undefined ? body.notes : existing.notes,
      now,
      id,
    );
    return c.json(updated);
  });

  // DELETE /api/allergens/{id}
  const archiveRoute = createRoute({
    method: "delete",
    path: "/api/allergens/{id}",
    summary: "Archive an allergen",
    request: { params: z.object({ id: z.coerce.number().int() }) },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean(), archived_at: z.string() }),
          },
        },
        description: "Archived",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(archiveRoute, (c) => {
    const { id } = c.req.valid("param");
    const db = initDb();
    const existing = db.query("SELECT * FROM allergen WHERE id = ? AND user_id = 1 AND archived = 0").get(id);
    if (!existing) return errorResponse(c, "NOT_FOUND", `Allergen with id ${id} not found`);
    const now = getNow();
    db.query("UPDATE allergen SET archived = 1, archived_at = ? WHERE id = ?").run(now, id);
    return c.json({ success: true, archived_at: now });
  });
}
