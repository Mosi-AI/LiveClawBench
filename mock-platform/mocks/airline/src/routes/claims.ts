import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok, err } from "mock-lib";
import { paginate, parsePageParams, DEFAULT_USER_ID } from "../helpers";
import {
  OkSchema,
  ErrSchema,
  ClaimSchema,
  CreateClaimBodySchema,
  UpdateClaimBodySchema,
  CalculateRefundBodySchema,
  ClaimIdParamSchema,
  BookingRefParamSchema,
  PaginatedSchema,
  PageQuerySchema,
} from "../schemas";
import { z } from "zod";

export function registerClaimRoutes(app: OpenAPIApp, db: Database): void {
  const claimListResponse = OkSchema(PaginatedSchema(ClaimSchema, "claims"));
  const claimDetailResponse = OkSchema(ClaimSchema);
  const refundCalcResponse = OkSchema(z.object({
    booking_reference: z.string(),
    claim_type: z.string(),
    refund_amount: z.number(),
    reason: z.string(),
    flight_status: z.string(),
    delay_minutes: z.number(),
  }));

  // GET /api/claims
  const listRoute = createRoute({
    method: "get",
    path: "/api/claims",
    summary: "List claims",
    request: { query: PageQuerySchema.extend({ status: z.string().optional() }) },
    responses: {
      200: {
        content: { "application/json": { schema: claimListResponse } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const query = c.req.valid("query");
    const { page, perPage, offset } = parsePageParams(query.page, query.per_page);
    const status = query.status;

    let sql = "SELECT * FROM claims WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = ?)";
    const params: (number | string)[] = [DEFAULT_USER_ID];

    if (status) {
      sql += " AND claim_status = ?";
      params.push(status);
    }

    const countRow = db.query(`SELECT COUNT(*) as total FROM (${sql})`).get(...params) as { total: number };
    const items = db.query(`${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset) as Record<string, unknown>[];

    return c.json(ok(paginate(items, countRow.total, page, perPage, "claims")));
  });

  // GET /api/claims/:claim_id
  const detailRoute = createRoute({
    method: "get",
    path: "/api/claims/{claim_id}",
    summary: "Get claim by ID",
    request: { params: ClaimIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: claimDetailResponse } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(detailRoute, (c) => {
    const { claim_id } = c.req.valid("param");
    const id = parseInt(claim_id, 10);
    const item = db.query("SELECT * FROM claims WHERE id = ?").get(id) as Record<string, unknown> | null;
    if (!item) return c.json(err("Claim not found"), 404);
    return c.json(ok(item));
  });

  // POST /api/claims
  const createClaimRoute = createRoute({
    method: "post",
    path: "/api/claims",
    summary: "Submit a claim",
    request: {
      body: {
        content: { "application/json": { schema: CreateClaimBodySchema } },
        description: "Claim data",
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: claimDetailResponse } },
        description: "Created",
      },
      400: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Bad request",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(createClaimRoute, async (c) => {
    const body = c.req.valid("json");

    const booking = db.query("SELECT * FROM bookings WHERE booking_reference = ?").get(body.booking_reference) as Record<string, unknown> | null;
    if (!booking) return c.json(err("Booking not found"), 404);

    const result = db.query(
      "INSERT INTO claims (booking_id, claim_type, claim_amount, claim_reason, claim_status) VALUES (?, ?, ?, ?, 'pending')"
    ).run(Number(booking.id), body.claim_type, body.claim_amount, body.claim_reason);

    const claimId = Number(result.lastInsertRowid);
    const claim = db.query("SELECT * FROM claims WHERE id = ?").get(claimId) as Record<string, unknown>;
    return c.json(ok(claim, "Claim submitted successfully"), 201);
  });

  // PUT /api/claims/:claim_id
  const updateRoute = createRoute({
    method: "put",
    path: "/api/claims/{claim_id}",
    summary: "Update a pending claim",
    request: {
      params: ClaimIdParamSchema,
      body: {
        content: { "application/json": { schema: UpdateClaimBodySchema } },
        description: "Claim updates",
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: claimDetailResponse } },
        description: "OK",
      },
      400: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Bad request",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(updateRoute, async (c) => {
    const { claim_id } = c.req.valid("param");
    const id = parseInt(claim_id, 10);
    const claim = db.query("SELECT * FROM claims WHERE id = ?").get(id) as Record<string, unknown> | null;
    if (!claim) return c.json(err("Claim not found"), 404);

    if (claim.claim_status !== "pending") {
      return c.json(err("Claim not found or cannot be updated"), 404);
    }

    const data = c.req.valid("json");
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.claim_reason !== undefined) { fields.push("claim_reason = ?"); values.push(String(data.claim_reason)); }
    if (data.claim_amount !== undefined) { fields.push("claim_amount = ?"); values.push(data.claim_amount); }

    if (fields.length === 0) {
      return c.json(err("No fields to update"), 400);
    }

    db.query(`UPDATE claims SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...values, id);
    const updated = db.query("SELECT * FROM claims WHERE id = ?").get(id) as Record<string, unknown>;
    return c.json(ok(updated, "Claim updated"));
  });

  // POST /api/claims/calculate-refund/:booking_reference
  const refundRoute = createRoute({
    method: "post",
    path: "/api/claims/calculate-refund/{booking_reference}",
    summary: "Calculate refund amount",
    request: {
      params: BookingRefParamSchema,
      body: {
        content: { "application/json": { schema: CalculateRefundBodySchema } },
        description: "Refund calculation request",
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: refundCalcResponse } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(refundRoute, async (c) => {
    const { booking_reference } = c.req.valid("param");
    const ref = booking_reference;
    const body = c.req.valid("json");
    const claimType = body.claim_type;

    const booking = db.query("SELECT * FROM bookings WHERE booking_reference = ?").get(ref) as Record<string, unknown> | null;
    if (!booking) return c.json(err("Booking not found"), 404);

    const flight = db.query("SELECT * FROM flights WHERE id = ?").get(Number(booking.flight_id)) as Record<string, unknown> | null;
    const totalPrice = Number(booking.total_price);
    const delayMinutes = Number(flight?.delay_minutes ?? 0);

    let refundAmount = 0;
    let reason = "";

    if (claimType === "cancellation" && flight?.status === "cancelled") {
      refundAmount = totalPrice;
      reason = "Full refund for cancelled flight";
    } else if (claimType === "delay" && delayMinutes > 0) {
      const delayHours = delayMinutes / 60;
      refundAmount = Math.min(delayHours * 25, totalPrice);
      reason = `Compensation for ${delayMinutes} minute delay`;
    } else {
      reason = "No compensation applicable";
    }

    return c.json(ok({
      booking_reference: ref,
      claim_type: claimType,
      refund_amount: parseFloat(refundAmount.toFixed(2)),
      reason,
      flight_status: flight?.status ?? "unknown",
      delay_minutes: delayMinutes,
    }));
  });
}
