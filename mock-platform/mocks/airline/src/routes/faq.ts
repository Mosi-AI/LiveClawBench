import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok, err } from "mock-lib";
import {
  OkSchema,
  ErrSchema,
  FaqSchema,
  FaqQuerySchema,
  FaqIdParamSchema,
} from "../schemas";
import { z } from "zod";

export function registerFaqRoutes(app: OpenAPIApp, db: Database): void {
  const faqListResponse = OkSchema(z.object({ faqs: z.array(FaqSchema) }));
  const faqDetailResponse = OkSchema(FaqSchema);

  // GET /api/faq
  const listRoute = createRoute({
    method: "get",
    path: "/api/faq",
    summary: "List FAQs",
    request: { query: FaqQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: faqListResponse } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const { category } = c.req.valid("query");
    let sql = "SELECT * FROM faqs WHERE is_active = 1";
    const params: string[] = [];

    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }

    const items = db.query(`${sql} ORDER BY display_order, id`).all(...params) as Record<string, unknown>[];
    return c.json(ok({ faqs: items }));
  });

  // GET /api/faq/:faq_id
  const detailRoute = createRoute({
    method: "get",
    path: "/api/faq/{faq_id}",
    summary: "Get FAQ by ID",
    request: { params: FaqIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: faqDetailResponse } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(detailRoute, (c) => {
    const { faq_id } = c.req.valid("param");
    const id = parseInt(faq_id, 10);
    const item = db.query("SELECT * FROM faqs WHERE id = ?").get(id) as Record<string, unknown> | null;
    if (!item) return c.json(err("FAQ not found"), 404);
    return c.json(ok(item));
  });
}
