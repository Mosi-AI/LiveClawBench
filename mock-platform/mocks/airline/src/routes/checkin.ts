import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ok, err } from "../helpers";

export function registerCheckinRoutes(app: OpenAPIApp, db: Database): void {
  // POST /api/checkin/:booking_reference
  app.post("/api/checkin/:booking_reference", (c) => {
    const ref = c.req.param("booking_reference");
    const booking = db.query("SELECT * FROM bookings WHERE booking_reference = ?").get(ref) as Record<string, unknown> | null;
    if (!booking) return c.json(err("Booking not found"), 404);
    const userId = c.get("userId")!;
    if (Number(booking.user_id) !== userId) {
      return c.json(err("Booking not found"), 404);
    }
    const bookingId = Number(booking.id);

    // Check payment completed
    const payment = db.query("SELECT * FROM payments WHERE booking_id = ?").get(bookingId) as Record<string, unknown> | null;
    if (!payment || payment.payment_status !== "completed") {
      return c.json(err("Payment must be completed before check-in"), 400);
    }

    // Check all passengers have seats
    const unseated = db.query("SELECT COUNT(*) as count FROM passengers WHERE booking_id = ? AND seat_id IS NULL").get(bookingId) as { count: number };
    if (unseated.count > 0) {
      // Check if there are no economy window seats available — mention upgrade fee
      const flightId = Number(booking.flight_id);
      const cabinClass = String(booking.cabin_class ?? "economy");
      if (cabinClass === "economy") {
        const availableEconWindow = db.query(
          "SELECT COUNT(*) as count FROM seats WHERE flight_id = ? AND cabin_class = 'economy' AND is_window = 1 AND is_available = 1"
        ).get(flightId) as { count: number };
        if (availableEconWindow.count === 0) {
          return c.json(err(
            "All passengers must have seat assignments before check-in. " +
            "No economy window seats are available. " +
            "You can upgrade to business class for an additional $350 to get a window seat. " +
            "Upgrade fee: $350"
          ), 400);
        }
      }
      return c.json(err("All passengers must have seat assignments before check-in"), 400);
    }

    // Check within 24h of departure
    const flight = db.query("SELECT departure_time FROM flights WHERE id = ?").get(booking.flight_id != null ? Number(booking.flight_id) : 0) as { departure_time: string } | null;
    if (flight) {
      const departure = new Date(flight.departure_time.replace(" ", "T"));
      const now = new Date();
      const hoursUntil = (departure.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntil > 24) {
        return c.json(err("Check-in opens 24 hours before departure"), 400);
      }
      if (hoursUntil < -1) {
        return c.json(err("Flight has already departed"), 400);
      }
    }

    db.query("UPDATE bookings SET checked_in = 1, check_in_time = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(bookingId);

    const updated = db.query("SELECT * FROM bookings WHERE id = ?").get(bookingId) as Record<string, unknown>;
    return c.json(ok(updated, "Check-in successful"));
  });

  // GET /api/checkin/:booking_reference/boarding-pass
  app.get("/api/checkin/:booking_reference/boarding-pass", (c) => {
    const ref = c.req.param("booking_reference");
    const booking = db.query("SELECT * FROM bookings WHERE booking_reference = ?").get(ref) as Record<string, unknown> | null;
    if (!booking) return c.json(err("Booking not found"), 404);
    const userId = c.get("userId")!;
    if (Number(booking.user_id) !== userId) {
      return c.json(err("Booking not found"), 404);
    }
    const bookingId = Number(booking.id);
    const flightId = booking.flight_id != null ? Number(booking.flight_id) : 0;

    if (!booking.checked_in) {
      return c.json(err("Must check in first"), 400);
    }

    const flight = db.query("SELECT * FROM flights WHERE id = ?").get(flightId) as Record<string, unknown> | null;
    const passengers = db.query(`
      SELECT p.*, s.seat_number FROM passengers p
      LEFT JOIN seats s ON p.seat_id = s.id
      WHERE p.booking_id = ?
    `).all(bookingId) as Record<string, unknown>[];

    const boardingPasses = passengers.map((p) => ({
      passenger_name: `${p.first_name} ${p.last_name}`,
      flight_number: flight?.flight_number ?? "",
      seat_number: p.seat_number ?? "",
      departure_time: flight?.departure_time ?? "",
      origin: flight?.origin_code ?? "",
      destination: flight?.destination_code ?? "",
      gate: flight?.gate ?? "TBD",
      terminal: flight?.terminal ?? "TBD",
    }));

    return c.json(ok({ booking_reference: ref, boarding_passes: boardingPasses }));
  });

  // GET /api/checkin/eligible
  app.get("/api/checkin/eligible", (c) => {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const future24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);

    const userId = c.get("userId")!;
    const bookings = db.query(`
      SELECT b.* FROM bookings b
      JOIN flights f ON b.flight_id = f.id
      WHERE b.user_id = ? AND b.checked_in = 0 AND b.booking_status = 'confirmed'
      AND f.departure_time >= ? AND f.departure_time <= ?
      ORDER BY f.departure_time
    `).all(userId, now, future24h) as Record<string, unknown>[];

    return c.json(ok({ eligible_checkins: bookings }));
  });

  // GET /api/checkin/:booking_reference/seats
  app.get("/api/checkin/:booking_reference/seats", (c) => {
    const ref = c.req.param("booking_reference");
    const booking = db.query("SELECT * FROM bookings WHERE booking_reference = ?").get(ref) as Record<string, unknown> | null;
    if (!booking) return c.json(err("Booking not found"), 404);

    const flightId = Number(booking.flight_id);
    const cabinClass = String(booking.cabin_class ?? "economy");

    // Filter seats to the booking's cabin class
    const seats = db.query("SELECT * FROM seats WHERE flight_id = ? AND cabin_class = ? ORDER BY row_number, seat_letter").all(flightId, cabinClass) as Record<string, unknown>[];

    const chart: Record<number, Record<string, unknown>[]> = {};
    for (const seat of seats) {
      const row = Number(seat.row_number);
      if (!chart[row]) chart[row] = [];
      chart[row].push(seat);
    }

    const flight = db.query("SELECT * FROM flights WHERE id = ?").get(flightId) as Record<string, unknown> | null;
    return c.json(ok({
      booking_reference: ref,
      flight_number: flight?.flight_number ?? "",
      cabin_class: booking.cabin_class,
      seat_chart: chart,
    }));
  });
}
