import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok, err } from "mock-lib";
import { paginate, parsePageParams, DEFAULT_USER_ID } from "../helpers";
import {
  OkSchema,
  ErrSchema,
  EmailNotificationSchema,
  MockServiceQuerySchema,
  EmailIdParamSchema,
} from "../schemas";
import { z } from "zod";

export function registerMockEmailRoutes(app: OpenAPIApp, db: Database, prefix: string): void {
  const emailListResponse = OkSchema(z.object({
    emails: z.array(EmailNotificationSchema),
    total: z.number(),
    page: z.number(),
    per_page: z.number(),
    pages: z.number(),
  }));
  const emailDetailResponse = OkSchema(EmailNotificationSchema);

  const listRoute = createRoute({
    method: "get",
    path: `${prefix}/emails`,
    summary: "List email notifications",
    request: { query: MockServiceQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: emailListResponse } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const query = c.req.valid("query");
    const { page, perPage, offset } = parsePageParams(query.page, query.per_page);
    const emailType = query.type;
    const unreadOnly = query.unread_only === "true";

    let sql = "SELECT * FROM email_notifications WHERE user_id = ?";
    const params: (number | string)[] = [DEFAULT_USER_ID];

    if (emailType) {
      sql += " AND email_type = ?";
      params.push(emailType);
    }
    if (unreadOnly) {
      sql += " AND is_read = 0";
    }

    const countRow = db.query(`SELECT COUNT(*) as total FROM (${sql})`).get(...params) as { total: number };
    const emails = db.query(`${sql} ORDER BY sent_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset) as Record<string, unknown>[];

    return c.json(ok({
      emails,
      total: countRow.total,
      page,
      per_page: perPage,
      pages: Math.ceil(countRow.total / perPage),
    }));
  });

  const detailRoute = createRoute({
    method: "get",
    path: `${prefix}/emails/{email_id}`,
    summary: "Get email notification",
    request: { params: EmailIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: emailDetailResponse } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(detailRoute, (c) => {
    const { email_id } = c.req.valid("param");
    const id = parseInt(email_id, 10);
    const email = db.query("SELECT * FROM email_notifications WHERE id = ? AND user_id = ?").get(id, DEFAULT_USER_ID) as Record<string, unknown> | null;
    if (!email) return c.json(err("Email not found"), 404);

    db.query("UPDATE email_notifications SET is_read = 1 WHERE id = ?").run(id);
    return c.json(ok(email));
  });
}
