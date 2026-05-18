import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { z } from "zod";
import { getExpenseDb } from "../utils/db.js";
import { rowToActivity } from "../utils/mappers.js";
import { ListActivitiesResponseSchema } from "../schemas.js";

export function registerActivityRoutes(app: OpenAPIApp): void {
  const listRoute = createRoute({
    method: "get",
    path: "/api/drafts/{id}/activities",
    summary: "Get activity timeline",
    request: { params: z.object({ id: z.coerce.number().int() }) },
    responses: {
      200: { content: { "application/json": { schema: ListActivitiesResponseSchema } }, description: "Activity list" },
    },
  });

  app.openApiRoute(listRoute, async (c) => {
    const { id } = c.req.valid("param");
    const userId = c.var.userId as number;
    const db = getExpenseDb();

    const draft = db.query("SELECT id FROM expense_draft WHERE id = ? AND user_id = ?").get(id, userId) as { id: number } | null;
    if (!draft) return c.json({ activities: [] });

    const rows = db.query(
      `SELECT a.*, u.full_name as actor_name
       FROM expense_activity a
       LEFT JOIN user u ON a.actor_user_id = u.id
       WHERE a.draft_id = ?
       ORDER BY a.created_at DESC`,
    ).all(id) as Record<string, unknown>[];

    return c.json({ activities: rows.map(rowToActivity) });
  }, { auth: "required" });
}
