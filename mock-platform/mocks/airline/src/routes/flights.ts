import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok, err } from "mock-lib";
import { paginate, parsePageParams } from "../helpers";
import {
  OkSchema,
  ErrSchema,
  FlightSchema,
  SeatSchema,
  FlightListQuerySchema,
  FlightSearchBodySchema,
  FlightIdParamSchema,
  SeatIdParamSchema,
  PaginatedSchema,
} from "../schemas";
import { z } from "zod";

export function registerFlightRoutes(app: OpenAPIApp, db: Database): void {
  const flightListResponse = OkSchema(PaginatedSchema(FlightSchema, "flights"));
  const flightDetailResponse = OkSchema(FlightSchema);
  const flightSearchResponse = OkSchema(z.object({
    flights: z.array(FlightSchema),
    search_criteria: z.object({
      origin: z.string(),
      destination: z.string(),
      departure_date: z.string(),
      passengers: z.number(),
      cabin_class: z.string(),
    }),
  }));
  const seatListResponse = OkSchema(z.object({
    flight_id: z.number(),
    flight_number: z.string(),
    seats: z.record(z.string(), z.array(SeatSchema)),
    total_seats: z.number(),
    available_seats: z.record(z.string(), z.number()),
  }));
  const seatDetailResponse = OkSchema(SeatSchema);

  // GET /api/flights
  const listRoute = createRoute({
    method: "get",
    path: "/api/flights",
    summary: "List flights",
    request: { query: FlightListQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: flightListResponse } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const query = c.req.valid("query");
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
  const searchRoute = createRoute({
    method: "post",
    path: "/api/flights/search",
    summary: "Search flights",
    request: {
      body: {
        content: { "application/json": { schema: FlightSearchBodySchema } },
        description: "Search criteria",
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: flightSearchResponse } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(searchRoute, async (c) => {
    const body = c.req.valid("json");
    const origin = body.origin;
    const destination = body.destination;
    const departureDate = body.departure_date;
    const passengers = Math.max(1, body.passengers ?? 1);
    const cabinClass = body.cabin_class ?? "economy";

    const flights = db
      .query(
        "SELECT * FROM flights WHERE origin_code = ? AND destination_code = ? AND departure_time LIKE ? AND status != 'cancelled' ORDER BY departure_time"
      )
      .all(origin, destination, `${departureDate}%`) as Record<string, unknown>[];

    return c.json(ok({ flights, search_criteria: { origin, destination, departure_date: departureDate, passengers, cabin_class: cabinClass } }));
  });

  // GET /api/flights/:flight_id
  const detailRoute = createRoute({
    method: "get",
    path: "/api/flights/{flight_id}",
    summary: "Get flight by ID",
    request: { params: FlightIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: flightDetailResponse } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(detailRoute, (c) => {
    const { flight_id } = c.req.valid("param");
    const flightId = parseInt(flight_id, 10);
    const flight = db.query("SELECT * FROM flights WHERE id = ?").get(flightId) as Record<string, unknown> | null;
    if (!flight) {
      return c.json(err("Flight not found"), 404);
    }
    return c.json(ok(flight));
  });

  // GET /api/flights/:flight_id/seats
  const seatsRoute = createRoute({
    method: "get",
    path: "/api/flights/{flight_id}/seats",
    summary: "Get flight seats",
    request: {
      params: FlightIdParamSchema,
      query: z.object({
        cabin_class: z.string().optional(),
        available_only: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: seatListResponse } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(seatsRoute, (c) => {
    const { flight_id } = c.req.valid("param");
    const flightId = parseInt(flight_id, 10);
    const query = c.req.valid("query");
    const cabinClass = query.cabin_class;
    const availableOnly = query.available_only === "true";

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
  const seatDetailRoute = createRoute({
    method: "get",
    path: "/api/flights/{flight_id}/seats/{seat_id}",
    summary: "Get seat by ID",
    request: {
      params: z.object({
        flight_id: z.string().regex(/^\d+$/),
        seat_id: z.string().regex(/^\d+$/),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: seatDetailResponse } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(seatDetailRoute, (c) => {
    const { seat_id } = c.req.valid("param");
    const seatId = parseInt(seat_id, 10);
    const seat = db.query("SELECT * FROM seats WHERE id = ?").get(seatId) as Record<string, unknown> | null;
    if (!seat) {
      return c.json(err("Seat not found"), 404);
    }
    return c.json(ok(seat));
  });
}
