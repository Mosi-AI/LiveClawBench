import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok, err } from "mock-lib";
import { paginate, parsePageParams, DEFAULT_USER_ID } from "../helpers";
import {
  OkSchema,
  ErrSchema,
  BaggageSchema,
  CreateBaggageBodySchema,
  ReportIdParamSchema,
  PaginatedSchema,
  PageQuerySchema,
} from "../schemas";
import { z } from "zod";

export function registerBaggageRoutes(app: OpenAPIApp, db: Database): void {
  const baggageListResponse = OkSchema(PaginatedSchema(BaggageSchema, "baggage_reports"));
  const baggageDetailResponse = OkSchema(BaggageSchema);

  // GET /api/baggage
  const listRoute = createRoute({
    method: "get",
    path: "/api/baggage",
    summary: "List baggage reports",
    request: { query: PageQuerySchema.extend({ status: z.string().optional() }) },
    responses: {
      200: {
        content: { "application/json": { schema: baggageListResponse } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const query = c.req.valid("query");
    const { page, perPage, offset } = parsePageParams(query.page, query.per_page);
    const status = query.status;

    let sql = "SELECT * FROM baggage_tracking WHERE user_id = ?";
    const params: (number | string)[] = [DEFAULT_USER_ID];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    const countRow = db.query(`SELECT COUNT(*) as total FROM (${sql})`).get(...params) as { total: number };
    const items = db.query(`${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset) as Record<string, unknown>[];

    return c.json(ok(paginate(items, countRow.total, page, perPage, "baggage_reports")));
  });

  // POST /api/baggage
  const createBaggageRoute = createRoute({
    method: "post",
    path: "/api/baggage",
    summary: "Create baggage report",
    request: {
      body: {
        content: { "application/json": { schema: CreateBaggageBodySchema } },
        description: "Baggage report data",
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: baggageDetailResponse } },
        description: "Created",
      },
      400: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Bad request",
      },
    },
  });

  app.openApiRoute(createBaggageRoute, async (c) => {
    const body = c.req.valid("json");

    const result = db.query(
      "INSERT INTO baggage_tracking (user_id, booking_id, flight_number, flight_time, passenger_name, passenger_phone, passenger_email, baggage_description, seat_number, loss_details, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing')"
    ).run(
      DEFAULT_USER_ID,
      body.booking_id ?? null,
      body.flight_number,
      body.flight_time,
      body.passenger_name,
      body.passenger_phone,
      body.passenger_email,
      body.baggage_description,
      body.seat_number ?? null,
      body.loss_details ?? null,
    );

    const reportId = Number(result.lastInsertRowid);
    const report = db.query("SELECT * FROM baggage_tracking WHERE id = ?").get(reportId) as Record<string, unknown>;
    return c.json(ok(report, "Baggage report submitted successfully"), 201);
  });

  // GET /api/baggage/:report_id
  const detailRoute = createRoute({
    method: "get",
    path: "/api/baggage/{report_id}",
    summary: "Get baggage report",
    request: { params: ReportIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: baggageDetailResponse } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(detailRoute, (c) => {
    const { report_id } = c.req.valid("param");
    const id = parseInt(report_id, 10);
    const report = db.query("SELECT * FROM baggage_tracking WHERE id = ?").get(id) as Record<string, unknown> | null;
    if (!report) return c.json(err("Baggage report not found"), 404);
    return c.json(ok(report));
  });
}
