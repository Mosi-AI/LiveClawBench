import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok, err } from "mock-lib";
import { paginate, parsePageParams } from "../helpers";
import {
  OkSchema,
  ErrSchema,
  AnnouncementSchema,
  AnnouncementQuerySchema,
  AnnouncementIdParamSchema,
  PaginatedSchema,
} from "../schemas";
import { z } from "zod";

export function registerAnnouncementRoutes(app: OpenAPIApp, db: Database): void {
  const announcementListResponse = OkSchema(PaginatedSchema(AnnouncementSchema, "announcements"));
  const announcementDetailResponse = OkSchema(AnnouncementSchema);

  // GET /api/announcements
  const listRoute = createRoute({
    method: "get",
    path: "/api/announcements",
    summary: "List announcements",
    request: { query: AnnouncementQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: announcementListResponse } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const query = c.req.valid("query");
    const { page, perPage, offset } = parsePageParams(query.page, query.per_page);
    const category = query.category;

    let sql = "SELECT * FROM announcements WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))";
    const params: (string | number)[] = [];

    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }

    const countRow = db.query(`SELECT COUNT(*) as total FROM (${sql})`).get(...params) as { total: number };
    const items = db.query(`${sql} ORDER BY published_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset) as Record<string, unknown>[];

    return c.json(ok(paginate(items, countRow.total, page, perPage, "announcements")));
  });

  // GET /api/announcements/:announcement_id
  const detailRoute = createRoute({
    method: "get",
    path: "/api/announcements/{announcement_id}",
    summary: "Get announcement by ID",
    request: { params: AnnouncementIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: announcementDetailResponse } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(detailRoute, (c) => {
    const { announcement_id } = c.req.valid("param");
    const id = parseInt(announcement_id, 10);
    const item = db.query("SELECT * FROM announcements WHERE id = ?").get(id) as Record<string, unknown> | null;
    if (!item) return c.json(err("Announcement not found"), 404);
    return c.json(ok(item));
  });
}
