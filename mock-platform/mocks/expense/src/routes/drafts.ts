import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { z } from "zod";
import { getExpenseDb, escapeLikePattern } from "../utils/db.js";
import { generateDraftCode } from "../utils/draft-code.js";
import { rowToDraft } from "../utils/mappers.js";
import {
  DraftSchema, UserSchema, CreateDraftBodySchema, UpdateDraftBodySchema,
  ListDraftsQuerySchema, ListDraftsResponseSchema, SubmitDraftResponseSchema,
} from "../schemas.js";

export function registerDraftRoutes(app: OpenAPIApp): void {
  // GET /api/drafts
  const listRoute = createRoute({
    method: "get",
    path: "/api/drafts",
    summary: "List drafts",
    request: { query: ListDraftsQuerySchema },
    responses: {
      200: { content: { "application/json": { schema: ListDraftsResponseSchema } }, description: "Draft list" },
    },
  });

  app.openApiRoute(listRoute, async (c) => {
    const query = c.req.valid("query");
    const userId = c.var.userId as number;
    const db = getExpenseDb();

    let where = "WHERE user_id = ?";
    const params: unknown[] = [userId];

    if (query.status) {
      where += " AND status = ?";
      params.push(query.status);
    }
    if (query.q) {
      where += " AND (vendor_name LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\' OR draft_code LIKE ? ESCAPE '\\')";
      const term = `%${escapeLikePattern(query.q)}%`;
      params.push(term, term, term);
    }

    const totalRow = db.query(`SELECT COUNT(*) as cnt FROM expense_draft ${where}`).get(...params) as { cnt: number };
    const total = totalRow.cnt;
    const totalPages = Math.ceil(total / query.limit) || 1;

    const orderBy = {
      newest: "created_at DESC",
      oldest: "created_at ASC",
      amount_desc: "amount DESC",
      amount_asc: "amount ASC",
    }[query.sort];

    const offset = (query.page - 1) * query.limit;
    const rows = db.query(`SELECT * FROM expense_draft ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params, query.limit, offset) as Record<string, unknown>[];

    return c.json({
      drafts: rows.map(rowToDraft),
      total,
      page: query.page,
      total_pages: totalPages,
    });
  }, { auth: "required" });

  // POST /api/drafts
  const postRoute = createRoute({
    method: "post",
    path: "/api/drafts",
    summary: "Create new draft",
    request: { body: { content: { "application/json": { schema: CreateDraftBodySchema } } } },
    responses: {
      200: { content: { "application/json": { schema: DraftSchema } }, description: "Created draft" },
    },
  });

  app.openApiRoute(postRoute, async (c) => {
    const body = c.req.valid("json");
    const userId = c.var.userId as number;
    const db = getExpenseDb();

    const draftCode = generateDraftCode();
    const result = db.exec(
      `INSERT INTO expense_draft (draft_code, user_id, vendor_name, category, amount, currency, invoice_date, expense_date, notes, source_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [draftCode, userId, body.vendor_name, body.category ?? null, body.amount, body.currency, body.invoice_date, body.expense_date ?? null, body.notes ?? null, body.source_type],
    );

    const draftId = Number(result.lastInsertRowid);
    db.exec("INSERT INTO expense_activity (draft_id, actor_user_id, action_type) VALUES (?, ?, 'created')", [draftId, userId]);

    const row = db.query("SELECT * FROM expense_draft WHERE id = ?").get(draftId) as Record<string, unknown>;
    return c.json(rowToDraft(row));
  }, { auth: "required" });

  // GET /api/drafts/{id}
  const getRoute = createRoute({
    method: "get",
    path: "/api/drafts/{id}",
    summary: "Get draft detail",
    request: { params: z.object({ id: z.coerce.number().int() }) },
    responses: {
      200: { content: { "application/json": { schema: DraftSchema } }, description: "Draft detail" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
    },
  });

  app.openApiRoute(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    const userId = c.var.userId as number;
    const db = getExpenseDb();

    const row = db.query("SELECT * FROM expense_draft WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown> | null;
    if (!row) return c.json({ error: "Draft not found" }, 404);

    return c.json(rowToDraft(row));
  }, { auth: "required" });

  // PATCH /api/drafts/{id}
  const updateRoute = createRoute({
    method: "patch",
    path: "/api/drafts/{id}",
    summary: "Edit draft fields",
    request: {
      params: z.object({ id: z.coerce.number().int() }),
      body: { content: { "application/json": { schema: UpdateDraftBodySchema } } },
    },
    responses: {
      200: { content: { "application/json": { schema: DraftSchema } }, description: "Updated draft" },
      403: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Forbidden" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
    },
  });

  app.openApiRoute(updateRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const userId = c.var.userId as number;
    const db = getExpenseDb();

    const row = db.query("SELECT * FROM expense_draft WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown> | null;
    if (!row) return c.json({ error: "Draft not found" }, 404);
    if (row.status !== "draft") return c.json({ error: "Cannot edit a submitted draft" }, 403);

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(body)) {
      const oldValue = row[key];
      if (String(oldValue ?? "") !== String(value ?? "")) {
        updates.push(`${key} = ?`);
        values.push(value);
        db.exec(
          "INSERT INTO expense_activity (draft_id, actor_user_id, action_type, field_name, old_value, new_value) VALUES (?, ?, 'edited', ?, ?, ?)",
          [id, userId, key, String(oldValue ?? ""), String(value ?? "")],
        );
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      db.exec(`UPDATE expense_draft SET ${updates.join(", ")} WHERE id = ?`, [...values, id]);
    }

    const updated = db.query("SELECT * FROM expense_draft WHERE id = ?").get(id) as Record<string, unknown>;
    return c.json(rowToDraft(updated));
  }, { auth: "required" });

  // POST /api/drafts/{id}/submit
  const submitRoute = createRoute({
    method: "post",
    path: "/api/drafts/{id}/submit",
    summary: "Submit draft for review",
    request: { params: z.object({ id: z.coerce.number().int() }) },
    responses: {
      200: { content: { "application/json": { schema: SubmitDraftResponseSchema } }, description: "Submitted" },
      400: { content: { "application/json": { schema: z.object({ error: z.string(), fields: z.array(z.object({ field: z.string(), message: z.string() })).optional() }) } }, description: "Validation failed" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
      409: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Conflict" },
    },
  });

  app.openApiRoute(submitRoute, async (c) => {
    const { id } = c.req.valid("param");
    const userId = c.var.userId as number;
    const db = getExpenseDb();

    const row = db.query("SELECT * FROM expense_draft WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown> | null;
    if (!row) return c.json({ error: "Draft not found" }, 404);
    if (row.status !== "draft") return c.json({ error: "Draft already submitted" }, 409);

    if (row.category === null) {
      return c.json({
        error: "Validation failed",
        fields: [{ field: "category", message: "Category is required before submission" }],
      }, 400);
    }

    db.exec("UPDATE expense_draft SET status = 'submitted', submitted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", [id]);
    db.exec("INSERT INTO expense_activity (draft_id, actor_user_id, action_type) VALUES (?, ?, 'submitted')", [id, userId]);

    const updated = db.query("SELECT * FROM expense_draft WHERE id = ?").get(id) as Record<string, unknown>;
    return c.json({ success: true, draft: rowToDraft(updated), message: "Draft submitted successfully" });
  }, { auth: "required" });

  // DELETE /api/drafts/{id}
  const deleteRoute = createRoute({
    method: "delete",
    path: "/api/drafts/{id}",
    summary: "Delete draft",
    request: { params: z.object({ id: z.coerce.number().int() }) },
    responses: {
      200: { content: { "application/json": { schema: z.object({ success: z.boolean() }) } }, description: "Deleted" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
    },
  });

  app.openApiRoute(deleteRoute, async (c) => {
    const { id } = c.req.valid("param");
    const userId = c.var.userId as number;
    const db = getExpenseDb();

    const row = db.query("SELECT id FROM expense_draft WHERE id = ? AND user_id = ?").get(id, userId) as { id: number } | null;
    if (!row) return c.json({ error: "Draft not found" }, 404);

    db.exec("DELETE FROM expense_draft WHERE id = ?", [id]);
    return c.json({ success: true });
  }, { auth: "required" });

  // GET /api/me
  const meRoute = createRoute({
    method: "get",
    path: "/api/me",
    summary: "Current user profile",
    responses: {
      200: { content: { "application/json": { schema: UserSchema } }, description: "User profile" },
      404: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Not found" },
    },
  });

  app.openApiRoute(meRoute, async (c) => {
    const userId = c.var.userId as number;
    const db = getExpenseDb();
    const user = db.query("SELECT * FROM user WHERE id = ?").get(userId) as Record<string, unknown> | null;
    if (!user) return c.json({ error: "User not found" }, 404);

    db.exec("UPDATE user SET last_login_at = datetime('now') WHERE id = ?", [userId]);

    return c.json({
      id: user.id, full_name: user.full_name, email: user.email, department: user.department,
      role: user.role, preferred_currency: user.preferred_currency, avatar_url: user.avatar_url,
      is_active: user.is_active, created_at: user.created_at, last_login_at: user.last_login_at,
    });
  }, { auth: "required" });
}
