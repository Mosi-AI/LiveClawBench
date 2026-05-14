import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ok, err, paginate, parsePageParams } from "../helpers";

export function registerClaimRoutes(app: OpenAPIApp, db: Database): void {
  // GET /api/claims
  app.get("/api/claims", (c) => {
    const query = c.req.query();
    const { page, perPage, offset } = parsePageParams(query.page, query.per_page);
    const status = query.status;

    const userId = c.get("userId")!;
    let sql = "SELECT * FROM claims WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = ?)";
    const params: (number | string)[] = [userId];

    if (status) {
      sql += " AND claim_status = ?";
      params.push(status);
    }

    const countRow = db.query(`SELECT COUNT(*) as total FROM (${sql})`).get(...params) as { total: number };
    const items = db.query(`${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset) as Record<string, unknown>[];

    return c.json(ok(paginate(items, countRow.total, page, perPage, "claims")));
  });

  // GET /api/claims/:claim_id
  app.get("/api/claims/:claim_id", (c) => {
    const id = parseInt(c.req.param("claim_id"), 10);
    const userId = c.get("userId")!;
    const item = db.query(
      "SELECT c.* FROM claims c JOIN bookings b ON c.booking_id = b.id WHERE c.id = ? AND b.user_id = ?"
    ).get(id, userId) as Record<string, unknown> | null;
    if (!item) return c.json(err("Claim not found"), 404);
    return c.json(ok(item));
  });

  // POST /api/claims
  app.post("/api/claims", async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const bookingReference = String(body.booking_reference ?? "");
    const claimType = String(body.claim_type ?? "");
    const claimAmount = parseFloat(String(body.claim_amount ?? "0"));
    const claimReason = String(body.claim_reason ?? "");

    if (!bookingReference || !claimType || !claimReason || body.claim_amount === undefined || body.claim_amount === null) {
      return c.json(err("booking_reference, claim_type, claim_amount and claim_reason are required"), 400);
    }

    const booking = db.query("SELECT * FROM bookings WHERE booking_reference = ?").get(bookingReference) as Record<string, unknown> | null;
    if (!booking) return c.json(err("Booking not found"), 404);

    const insertResult = db.query(
      "INSERT INTO claims (booking_id, claim_type, claim_amount, claim_reason, claim_status) VALUES (?, ?, ?, ?, 'pending')"
    ).run(Number(booking.id), claimType, claimAmount, claimReason);

    const claimId = Number(insertResult.lastInsertRowid);
    const claim = db.query("SELECT * FROM claims WHERE id = ?").get(claimId) as Record<string, unknown>;
    return c.json(ok(claim, "Claim submitted successfully"), 201);
  });

  // PUT /api/claims/:claim_id
  app.put("/api/claims/:claim_id", async (c) => {
    const id = parseInt(c.req.param("claim_id"), 10);
    const userId = c.get("userId")!;
    const claim = db.query(
      "SELECT c.* FROM claims c JOIN bookings b ON c.booking_id = b.id WHERE c.id = ? AND b.user_id = ?"
    ).get(id, userId) as Record<string, unknown> | null;
    if (!claim) return c.json(err("Claim not found"), 404);

    if (claim.claim_status !== "pending") {
      return c.json(err("Claim not found or cannot be updated"), 404);
    }

    const body = (await c.req.json()) as Record<string, unknown>;
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.claim_reason !== undefined) { fields.push("claim_reason = ?"); values.push(String(body.claim_reason)); }
    if (body.claim_amount !== undefined) { fields.push("claim_amount = ?"); values.push(parseFloat(String(body.claim_amount))); }

    if (fields.length === 0) {
      return c.json(err("No fields to update"), 400);
    }

    db.query(`UPDATE claims SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ?`).run(...values, id);
    const updated = db.query("SELECT * FROM claims WHERE id = ?").get(id) as Record<string, unknown>;
    return c.json(ok(updated, "Claim updated"));
  });

  // POST /api/claims/calculate-refund/:booking_reference
  app.post("/api/claims/calculate-refund/:booking_reference", async (c) => {
    const ref = c.req.param("booking_reference");
    const body = (await c.req.json()) as Record<string, unknown>;
    const claimType = String(body.claim_type ?? "");

    const booking = db.query("SELECT * FROM bookings WHERE booking_reference = ?").get(ref) as Record<string, unknown> | null;
    if (!booking) return c.json(err("Booking not found"), 404);

    const flight = db.query("SELECT * FROM flights WHERE id = ?").get(booking.flight_id != null ? Number(booking.flight_id) : 0) as Record<string, unknown> | null;
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
