import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok, err } from "mock-lib";
import { paginate, parsePageParams, DEFAULT_USER_ID, generateBookingReference } from "../helpers";
import {
  OkSchema,
  ErrSchema,
  BookingSchema,
  BookingWithDetailsSchema,
  CreateBookingBodySchema,
  BookingRefParamSchema,
  PaginatedSchema,
  PageQuerySchema,
} from "../schemas";
import { z } from "zod";

export function registerBookingRoutes(app: OpenAPIApp, db: Database): void {
  const bookingListResponse = OkSchema(PaginatedSchema(BookingSchema, "bookings"));
  const bookingDetailResponse = OkSchema(BookingWithDetailsSchema);
  const bookingUpdateResponse = OkSchema(BookingSchema);

  // GET /api/bookings
  const listRoute = createRoute({
    method: "get",
    path: "/api/bookings",
    summary: "List bookings",
    request: { query: PageQuerySchema.extend({ status: z.string().optional() }) },
    responses: {
      200: {
        content: { "application/json": { schema: bookingListResponse } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const query = c.req.valid("query");
    const { page, perPage, offset } = parsePageParams(query.page, query.per_page);
    const status = query.status;

    let sql = "SELECT * FROM bookings WHERE user_id = ?";
    const params: (number | string)[] = [DEFAULT_USER_ID];

    if (status) {
      sql += " AND booking_status = ?";
      params.push(status);
    } else {
      sql += " AND booking_status != 'pending'";
    }

    const countRow = db.query(`SELECT COUNT(*) as total FROM bookings WHERE user_id = ? ${status ? "AND booking_status = ?" : "AND booking_status != 'pending'"}`).get(...params) as { total: number };
    const items = db.query(`${sql} ORDER BY booked_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset) as Record<string, unknown>[];

    return c.json(ok(paginate(items, countRow.total, page, perPage, "bookings")));
  });

  // GET /api/bookings/:booking_reference
  const detailRoute = createRoute({
    method: "get",
    path: "/api/bookings/{booking_reference}",
    summary: "Get booking by reference",
    request: { params: BookingRefParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: bookingDetailResponse } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(detailRoute, (c) => {
    const { booking_reference } = c.req.valid("param");
    const ref = booking_reference;
    const booking = db.query("SELECT * FROM bookings WHERE booking_reference = ?").get(ref) as Record<string, unknown> | null;
    if (!booking) return c.json(err("Booking not found"), 404);

    const passengers = db.query("SELECT * FROM passengers WHERE booking_id = ?").all(Number(booking.id)) as Record<string, unknown>[];
    const payment = db.query("SELECT * FROM payments WHERE booking_id = ?").get(Number(booking.id)) as Record<string, unknown> | null;

    return c.json(ok({ ...booking, passengers, payment }));
  });

  // POST /api/bookings
  const createBookingRoute = createRoute({
    method: "post",
    path: "/api/bookings",
    summary: "Create a booking",
    request: {
      body: {
        content: { "application/json": { schema: CreateBookingBodySchema } },
        description: "Booking data",
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: OkSchema(BookingSchema) } },
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

  app.openApiRoute(createBookingRoute, async (c) => {
    const body = c.req.valid("json");
    const flightId = body.flight_id;
    const cabinClass = body.cabin_class ?? "economy";
    const passengers = body.passengers;

    const flight = db.query("SELECT * FROM flights WHERE id = ?").get(flightId) as Record<string, unknown> | null;
    if (!flight) return c.json(err("Flight not found"), 404);

    let basePrice = 0;
    if (cabinClass === "economy") basePrice = Number(flight.base_price_economy ?? 0);
    else if (cabinClass === "business") basePrice = Number(flight.base_price_business ?? 0);
    else if (cabinClass === "first") basePrice = Number(flight.base_price_first ?? 0);

    const totalPrice = basePrice * passengers.length;

    let reference = generateBookingReference();
    let attempts = 0;
    let bookingId: number;
    while (true) {
      try {
        const result = db.query(
          "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'pending', 0)"
        ).run(reference, DEFAULT_USER_ID, flightId, cabinClass, totalPrice);
        bookingId = Number(result.lastInsertRowid);
        break;
      } catch (e: any) {
        if (e.message?.includes("UNIQUE constraint failed") && attempts < 10) {
          reference = generateBookingReference();
          attempts++;
          continue;
        }
        throw e;
      }
    }

    for (const p of passengers) {
      db.query(
        "INSERT INTO passengers (booking_id, first_name, last_name, date_of_birth, nationality, meal_preference, special_assistance) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(
        bookingId,
        p.first_name,
        p.last_name,
        p.date_of_birth,
        p.nationality ?? null,
        p.meal_preference ?? null,
        p.special_assistance ?? null,
      );
    }

    const booking = db.query("SELECT * FROM bookings WHERE id = ?").get(bookingId) as Record<string, unknown>;

    const txnId = `TXN-${Date.now()}`;
    db.query(
      "INSERT INTO payments (booking_id, amount, currency, payment_status, payment_method, card_last_four, card_type, card_holder_name, transaction_id, paid_at) VALUES (?, ?, 'USD', 'completed', 'credit_card', '4242', 'visa', 'Auto Payment', ?, datetime('now'))"
    ).run(bookingId, totalPrice, txnId);

    const user = db.query("SELECT email, first_name, last_name FROM users WHERE id = ?").get(DEFAULT_USER_ID) as { email: string; first_name: string; last_name: string } | null;
    if (user) {
      db.query(
        "INSERT INTO email_notifications (user_id, booking_id, email_type, recipient_email, subject, body) VALUES (?, ?, 'booking_confirmation', ?, ?, ?)"
      ).run(DEFAULT_USER_ID, bookingId, user.email, `Booking Confirmation - ${reference}`, `Dear ${user.first_name}, your booking ${reference} has been confirmed.`);
    }

    db.query("UPDATE bookings SET booking_status = 'confirmed', updated_at = datetime('now') WHERE id = ?").run(bookingId);

    const confirmedBooking = db.query("SELECT * FROM bookings WHERE id = ?").get(bookingId) as Record<string, unknown>;
    return c.json(ok(confirmedBooking, "Booking created successfully"), 201);
  });

  // POST /api/bookings/:booking_reference/cancel
  const cancelRoute = createRoute({
    method: "post",
    path: "/api/bookings/{booking_reference}/cancel",
    summary: "Cancel a booking",
    request: { params: BookingRefParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: bookingUpdateResponse } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(cancelRoute, (c) => {
    const { booking_reference } = c.req.valid("param");
    const ref = booking_reference;
    const booking = db.query("SELECT * FROM bookings WHERE booking_reference = ?").get(ref) as Record<string, unknown> | null;
    if (!booking) return c.json(err("Booking not found"), 404);

    db.transaction(() => {
      db.query("UPDATE seats SET is_available = 1 WHERE id IN (SELECT seat_id FROM passengers WHERE booking_id = ? AND seat_id IS NOT NULL)").run(Number(booking.id));
      db.query("UPDATE passengers SET seat_id = NULL WHERE booking_id = ?").run(Number(booking.id));
      db.query("UPDATE bookings SET booking_status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(Number(booking.id));
    })();

    const updated = db.query("SELECT * FROM bookings WHERE id = ?").get(Number(booking.id)) as Record<string, unknown>;
    return c.json(ok(updated, "Booking cancelled successfully"));
  });
}
