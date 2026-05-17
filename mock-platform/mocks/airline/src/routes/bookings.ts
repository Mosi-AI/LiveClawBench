import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ok, err, paginate, parsePageParams, generateBookingReference } from "../helpers";

export function registerBookingRoutes(app: OpenAPIApp, db: Database): void {
  // GET /api/bookings
  app.get("/api/bookings", (c) => {
    const query = c.req.query();
    const { page, perPage, offset } = parsePageParams(query.page, query.per_page);
    const status = query.status;

    const userId = c.get("userId")!;
    let sql = "SELECT * FROM bookings WHERE user_id = ?";
    const params: (number | string)[] = [userId];

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
  app.get("/api/bookings/:booking_reference", (c) => {
    const ref = c.req.param("booking_reference");
    const booking = db.query("SELECT * FROM bookings WHERE booking_reference = ?").get(ref) as Record<string, unknown> | null;
    if (!booking) return c.json(err("Booking not found"), 404);
    const userId = c.get("userId")!;
    if (Number(booking.user_id) !== userId) {
      return c.json(err("Booking not found"), 404);
    }
    const bookingId = Number(booking.id);

    const passengers = db.query("SELECT * FROM passengers WHERE booking_id = ?").all(bookingId) as Record<string, unknown>[];
    const payment = db.query("SELECT * FROM payments WHERE booking_id = ?").get(bookingId) as Record<string, unknown> | null;

    return c.json(ok({ ...booking, passengers, payment }));
  });

  // POST /api/bookings
  app.post("/api/bookings", async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const flightId = parseInt(String(body.flight_id ?? "0"), 10);
    const cabinClass = String(body.cabin_class ?? "economy");
    const passengers = (body.passengers ?? []) as Record<string, unknown>[];

    if (!flightId) return c.json(err("flight_id is required"), 400);

    const flight = db.query("SELECT * FROM flights WHERE id = ?").get(flightId) as Record<string, unknown> | null;
    if (!flight) return c.json(err("Flight not found"), 404);

    // Calculate total price based on cabin class and passenger count
    let basePrice = 0;
    if (cabinClass === "economy") basePrice = Number(flight.base_price_economy ?? 0);
    else if (cabinClass === "business") basePrice = Number(flight.base_price_business ?? 0);
    else if (cabinClass === "first") basePrice = Number(flight.base_price_first ?? 0);

    const totalPrice = basePrice * passengers.length;

    const userId = c.get("userId")!;

    // Generate unique booking reference with retry loop
    let reference = generateBookingReference();
    let insertResult: { lastInsertRowid: number | bigint };
    let attempts = 0;
    const maxAttempts = 10;
    while (true) {
      try {
        insertResult = db.query(
          "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, ?, ?, ?, ?, 'pending', 0)"
        ).run(reference, userId, flightId, cabinClass, totalPrice);
        break;
      } catch (e: any) {
        if (e.message?.includes("UNIQUE constraint failed") && attempts < maxAttempts) {
          reference = generateBookingReference();
          attempts++;
          continue;
        }
        throw e;
      }
    }

    const bookingId = Number(insertResult.lastInsertRowid);

    // Insert passengers
    for (const p of passengers) {
      db.query(
        "INSERT INTO passengers (booking_id, first_name, last_name, date_of_birth, nationality, meal_preference, special_assistance) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(
        bookingId,
        String(p.first_name ?? ""),
        String(p.last_name ?? ""),
        String(p.date_of_birth ?? ""),
        p.nationality ? String(p.nationality) : null,
        p.meal_preference ? String(p.meal_preference) : null,
        p.special_assistance ? String(p.special_assistance) : null,
      );
    }

    const booking = db.query("SELECT * FROM bookings WHERE id = ?").get(bookingId) as Record<string, unknown>;

    // Create payment side effect
    const txnId = `TXN-${Date.now()}`;
    db.query(
      "INSERT INTO payments (booking_id, amount, currency, payment_status, payment_method, card_last_four, card_type, card_holder_name, transaction_id, paid_at) VALUES (?, ?, 'USD', 'completed', 'credit_card', '4242', 'visa', 'Auto Payment', ?, datetime('now'))"
    ).run(bookingId, totalPrice, txnId);

    // Create email notification side effect
    const user = db.query("SELECT email, first_name, last_name FROM users WHERE id = ?").get(userId) as { email: string; first_name: string; last_name: string } | null;
    if (user) {
      db.query(
        "INSERT INTO email_notifications (user_id, booking_id, email_type, recipient_email, subject, body) VALUES (?, ?, 'booking_confirmation', ?, ?, ?)"
      ).run(userId, bookingId, user.email, `Booking Confirmation - ${reference}`, `Dear ${user.first_name}, your booking ${reference} has been confirmed.`);
    }

    // Update booking status to confirmed
    db.query("UPDATE bookings SET booking_status = 'confirmed', updated_at = datetime('now') WHERE id = ?").run(bookingId);

    const confirmedBooking = db.query("SELECT * FROM bookings WHERE id = ?").get(bookingId) as Record<string, unknown>;
    return c.json(ok(confirmedBooking, "Booking created successfully"), 201);
  });

  // POST /api/bookings/:booking_reference/seats
  app.post("/api/bookings/:booking_reference/seats", async (c) => {
    const ref = c.req.param("booking_reference");
    const body = (await c.req.json()) as Record<string, unknown>;
    const assignments = (body.seat_assignments ?? []) as { passenger_id: number; seat_id: number }[];

    const booking = db.query("SELECT * FROM bookings WHERE booking_reference = ?").get(ref) as Record<string, unknown> | null;
    if (!booking) return c.json(err("Booking not found"), 404);
    const userId = c.get("userId")!;
    if (Number(booking.user_id) !== userId) {
      return c.json(err("Booking not found"), 404);
    }
    const bookingId = Number(booking.id);
    const flightId = Number(booking.flight_id);

    // Validate all assignments before applying
    for (const assignment of assignments) {
      const passenger = db.query("SELECT * FROM passengers WHERE id = ? AND booking_id = ?").get(assignment.passenger_id, bookingId) as Record<string, unknown> | null;
      if (!passenger) {
        return c.json(err(`Passenger ${assignment.passenger_id} not found in booking`), 404);
      }

      const seat = db.query("SELECT * FROM seats WHERE id = ? AND flight_id = ?").get(assignment.seat_id, flightId) as Record<string, unknown> | null;
      if (!seat) {
        return c.json(err(`Seat ${assignment.seat_id} not found`), 404);
      }

      if (!seat.is_available) {
        const isEconomyWindow = seat.cabin_class === "economy" && seat.is_window;
        if (isEconomyWindow) {
          const availableEconWindow = db.query(
            "SELECT COUNT(*) as count FROM seats WHERE flight_id = ? AND cabin_class = 'economy' AND is_window = 1 AND is_available = 1"
          ).get(flightId) as { count: number };
          if (availableEconWindow.count === 0) {
            return c.json(err(
              `Seat ${seat.seat_number} is not available. No economy window seats are available on this flight. ` +
              `You can upgrade to business class for an additional $350 to get a window seat. ` +
              `Upgrade fee: $350`
            ), 400);
          }
        }
        return c.json(err(`Seat ${seat.seat_number} is not available`), 400);
      }
    }

    // Apply updates atomically with TOCTOU protection
    db.query("BEGIN TRANSACTION").run();
    try {
      for (const assignment of assignments) {
        const seatUpdate = db.query("UPDATE seats SET is_available = 0 WHERE id = ? AND is_available = 1").run(assignment.seat_id);
        if (seatUpdate.changes === 0) {
          db.query("ROLLBACK").run();
          const seat = db.query("SELECT * FROM seats WHERE id = ? AND flight_id = ?").get(assignment.seat_id, flightId) as Record<string, unknown> | null;
          return c.json(err(`Seat ${seat ? seat.seat_number : assignment.seat_id} is no longer available`), 409);
        }
        db.query("UPDATE passengers SET seat_id = ? WHERE id = ? AND booking_id = ?").run(assignment.seat_id, assignment.passenger_id, bookingId);
      }
      db.query("COMMIT").run();
    } catch (e) {
      db.query("ROLLBACK").run();
      throw e;
    }

    const updated = db.query("SELECT * FROM bookings WHERE id = ?").get(bookingId) as Record<string, unknown>;
    return c.json(ok(updated, "Seats assigned successfully"));
  });

  // POST /api/bookings/:booking_reference/cancel
  app.post("/api/bookings/:booking_reference/cancel", (c) => {
    const ref = c.req.param("booking_reference");
    const booking = db.query("SELECT * FROM bookings WHERE booking_reference = ?").get(ref) as Record<string, unknown> | null;
    if (!booking) return c.json(err("Booking not found"), 404);
    const userId = c.get("userId")!;
    if (Number(booking.user_id) !== userId) {
      return c.json(err("Booking not found"), 404);
    }
    const bookingId = Number(booking.id);

    const cancelBooking = db.transaction(() => {
      db.query("UPDATE seats SET is_available = 1 WHERE id IN (SELECT seat_id FROM passengers WHERE booking_id = ? AND seat_id IS NOT NULL)").run(bookingId);
      db.query("UPDATE passengers SET seat_id = NULL WHERE booking_id = ?").run(bookingId);
      db.query("UPDATE bookings SET booking_status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(bookingId);
    });
    cancelBooking();

    const updated = db.query("SELECT * FROM bookings WHERE id = ?").get(bookingId) as Record<string, unknown>;
    return c.json(ok(updated, "Booking cancelled successfully"));
  });
}
