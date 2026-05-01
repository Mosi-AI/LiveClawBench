import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ok, err, paginate, parsePageParams } from "../helpers";

export function registerFlightRoutes(app: OpenAPIApp, db: Database): void {
  // GET /api/flights/
  app.get("/api/flights", (c) => {
    const query = c.req.query();
    const { page, perPage, offset } = parsePageParams(query.page, query.per_page);

    const conditions: string[] = ["1=1"];
    const params: (string | number)[] = [];

    if (query.origin) {
      conditions.push("origin_code = ?");
      params.push(query.origin);
    }
    if (query.destination) {
      conditions.push("destination_code = ?");
      params.push(query.destination);
    }
    if (query.date) {
      conditions.push("departure_time LIKE ?");
      params.push(`${query.date}%`);
    }
    if (query.min_price) {
      conditions.push("base_price_economy >= ?");
      params.push(parseFloat(query.min_price));
    }
    if (query.max_price) {
      conditions.push("base_price_economy <= ?");
      params.push(parseFloat(query.max_price));
    }
    if (query.status) {
      conditions.push("status = ?");
      params.push(query.status);
    }

    const where = conditions.join(" AND ");
    const countRow = db.query(`SELECT COUNT(*) as total FROM flights WHERE ${where}`).get(...params) as { total: number };
    const flights = db
      .query(`SELECT * FROM flights WHERE ${where} ORDER BY departure_time LIMIT ? OFFSET ?`)
      .all(...params, perPage, offset) as Record<string, unknown>[];

    return c.json(ok(paginate(flights, countRow.total, page, perPage, "flights")));
  });

  // POST /api/flights/search
  app.post("/api/flights/search", async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const origin = String(body.origin ?? "");
    const destination = String(body.destination ?? "");
    const departureDate = String(body.departure_date ?? "");
    const passengers = Math.max(1, parseInt(String(body.passengers ?? "1"), 10) || 1);
    const cabinClass = String(body.cabin_class ?? "economy");

    const flights = db
      .query(
        "SELECT * FROM flights WHERE origin_code = ? AND destination_code = ? AND departure_time LIKE ? AND status != 'cancelled' ORDER BY departure_time"
      )
      .all(origin, destination, `${departureDate}%`) as Record<string, unknown>[];

    return c.json(ok({ flights, search_criteria: { origin, destination, departure_date: departureDate, passengers, cabin_class: cabinClass } }));
  });

  // GET /api/flights/:flight_id
  app.get("/api/flights/:flight_id", (c) => {
    const flightId = parseInt(c.req.param("flight_id"), 10);
    const flight = db.query("SELECT * FROM flights WHERE id = ?").get(flightId) as Record<string, unknown> | null;
    if (!flight) {
      return c.json(err("Flight not found"), 404);
    }
    return c.json(ok(flight));
  });

  // GET /api/flights/:flight_id/seats
  app.get("/api/flights/:flight_id/seats", (c) => {
    const flightId = parseInt(c.req.param("flight_id"), 10);
    const cabinClass = c.req.query("cabin_class");
    const availableOnly = c.req.query("available_only") === "true";

    const flight = db.query("SELECT flight_number FROM flights WHERE id = ?").get(flightId) as { flight_number: string } | null;

    let sql = "SELECT * FROM seats WHERE flight_id = ?";
    const params: (number | string)[] = [flightId];

    if (cabinClass) {
      sql += " AND cabin_class = ?";
      params.push(cabinClass);
    }
    if (availableOnly) {
      sql += " AND is_available = 1";
    }
    sql += " ORDER BY row_number, seat_letter";

    const seats = db.query(sql).all(...params) as Record<string, unknown>[];

    // Compute available_seats per cabin
    const availableSeatsByCabin: Record<string, number> = {};
    const allSeats = db.query("SELECT cabin_class, is_available FROM seats WHERE flight_id = ?").all(flightId) as { cabin_class: string; is_available: number }[];
    for (const s of allSeats) {
      if (!availableSeatsByCabin[s.cabin_class]) availableSeatsByCabin[s.cabin_class] = 0;
      if (s.is_available) availableSeatsByCabin[s.cabin_class]++;
    }

    const grouped: Record<string, Record<string, unknown>[]> = { economy: [], business: [], first: [] };
    for (const seat of seats) {
      const cabin = String(seat.cabin_class ?? "economy");
      if (!grouped[cabin]) grouped[cabin] = [];
      grouped[cabin].push(seat);
    }

    return c.json(ok({
      flight_id: flightId,
      flight_number: flight?.flight_number ?? "",
      seats: grouped,
      total_seats: allSeats.length,
      available_seats: availableSeatsByCabin,
    }));
  });

  // GET /api/flights/:flight_id/seats/:seat_id
  app.get("/api/flights/:flight_id/seats/:seat_id", (c) => {
    const seatId = parseInt(c.req.param("seat_id"), 10);
    const seat = db.query("SELECT * FROM seats WHERE id = ?").get(seatId) as Record<string, unknown> | null;
    if (!seat) {
      return c.json(err("Seat not found"), 404);
    }
    return c.json(ok(seat));
  });
}
