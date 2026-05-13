import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ok, err, paginate, parsePageParams } from "../helpers";

export function registerBaggageRoutes(app: OpenAPIApp, db: Database): void {
  // GET /api/baggage
  app.get("/api/baggage", (c) => {
    const query = c.req.query();
    const { page, perPage, offset } = parsePageParams(query.page, query.per_page);
    const status = query.status;

    const userId = c.get("userId")!;
    let sql = "SELECT * FROM baggage_tracking WHERE user_id = ?";
    const params: (number | string)[] = [userId];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    const countRow = db.query(`SELECT COUNT(*) as total FROM (${sql})`).get(...params) as { total: number };
    const items = db.query(`${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset) as Record<string, unknown>[];

    return c.json(ok(paginate(items, countRow.total, page, perPage, "baggage_reports")));
  });

  // POST /api/baggage
  app.post("/api/baggage", async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const flightNumber = String(body.flight_number ?? "");
    const flightTime = String(body.flight_time ?? "");
    const passengerName = String(body.passenger_name ?? "");
    const passengerPhone = String(body.passenger_phone ?? "");
    const passengerEmail = String(body.passenger_email ?? "");
    const baggageDescription = String(body.baggage_description ?? "");
    const seatNumber = body.seat_number ? String(body.seat_number) : null;
    const lossDetails = body.loss_details ? String(body.loss_details) : null;
    const bookingId = body.booking_id ? parseInt(String(body.booking_id), 10) : null;

    if (!flightNumber || !flightTime || !passengerName || !passengerPhone || !passengerEmail || !baggageDescription) {
      return c.json(err("flight_number, flight_time, passenger_name, passenger_phone, passenger_email and baggage_description are required"), 400);
    }

    const userId = c.get("userId")!;
    db.query(
      "INSERT INTO baggage_tracking (user_id, booking_id, flight_number, flight_time, passenger_name, passenger_phone, passenger_email, baggage_description, seat_number, loss_details, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing')"
    ).run(
      userId,
      bookingId,
      flightNumber,
      flightTime,
      passengerName,
      passengerPhone,
      passengerEmail,
      baggageDescription,
      seatNumber,
      lossDetails,
    );

    const reportId = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);
    const report = db.query("SELECT * FROM baggage_tracking WHERE id = ?").get(reportId) as Record<string, unknown>;
    return c.json(ok(report, "Baggage report submitted successfully"), 201);
  });

  // GET /api/baggage/:report_id
  app.get("/api/baggage/:report_id", (c) => {
    const id = parseInt(c.req.param("report_id"), 10);
    const userId = c.get("userId")!;
    const report = db.query("SELECT * FROM baggage_tracking WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown> | null;
    if (!report) return c.json(err("Baggage report not found"), 404);
    return c.json(ok(report));
  });
}
