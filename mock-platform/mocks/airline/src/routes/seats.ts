import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok, err } from "mock-lib";
import {
  OkSchema,
  ErrSchema,
  BookingSchema,
  AssignSeatsBodySchema,
  BookingRefParamSchema,
} from "../schemas";

export function registerSeatRoutes(app: OpenAPIApp, db: Database): void {
  const bookingUpdateResponse = OkSchema(BookingSchema);

  // POST /api/bookings/:booking_reference/seats
  const assignSeatsRoute = createRoute({
    method: "post",
    path: "/api/bookings/{booking_reference}/seats",
    summary: "Assign seats to passengers",
    request: {
      params: BookingRefParamSchema,
      body: {
        content: { "application/json": { schema: AssignSeatsBodySchema } },
        description: "Seat assignments",
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: bookingUpdateResponse } },
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
      409: {
        content: { "application/json": { schema: ErrSchema } },
        description: "Conflict",
      },
    },
  });

  app.openApiRoute(assignSeatsRoute, async (c) => {
    const { booking_reference } = c.req.valid("param");
    const ref = booking_reference;
    const data = c.req.valid("json");
    const assignments = data.seat_assignments;

    const booking = db.query("SELECT * FROM bookings WHERE booking_reference = ?").get(ref) as Record<string, unknown> | null;
    if (!booking) return c.json(err("Booking not found"), 404);

    db.query("BEGIN TRANSACTION").run();
    try {
      for (const assignment of assignments) {
        const passenger = db.query("SELECT * FROM passengers WHERE id = ? AND booking_id = ?").get(assignment.passenger_id, Number(booking.id)) as Record<string, unknown> | null;
        if (!passenger) {
          db.query("ROLLBACK").run();
          return c.json(err(`Passenger ${assignment.passenger_id} not found in booking`), 404);
        }

        const seat = db.query("SELECT * FROM seats WHERE id = ? AND flight_id = ?").get(assignment.seat_id, Number(booking.flight_id)) as Record<string, unknown> | null;
        if (!seat) {
          db.query("ROLLBACK").run();
          return c.json(err(`Seat ${assignment.seat_id} not found`), 404);
        }

        if (!seat.is_available) {
          const isEconomyWindow = seat.cabin_class === "economy" && seat.is_window;
          if (isEconomyWindow) {
            const availableEconWindow = db.query(
              "SELECT COUNT(*) as count FROM seats WHERE flight_id = ? AND cabin_class = 'economy' AND is_window = 1 AND is_available = 1"
            ).get(Number(booking.flight_id)) as { count: number };
            if (availableEconWindow.count === 0) {
              db.query("ROLLBACK").run();
              return c.json(err(
                `Seat ${seat.seat_number} is not available. No economy window seats are available on this flight. ` +
                `You can upgrade to business class for an additional $350 to get a window seat. ` +
                `Upgrade fee: $350`
              ), 400);
            }
          }
          db.query("ROLLBACK").run();
          return c.json(err(`Seat ${seat.seat_number} is not available`), 400);
        }

        const seatUpdate = db.query("UPDATE seats SET is_available = 0 WHERE id = ? AND is_available = 1").run(assignment.seat_id);
        if (seatUpdate.changes === 0) {
          db.query("ROLLBACK").run();
          return c.json(err(`Seat ${seat.seat_number} is no longer available`), 409);
        }

        db.query("UPDATE passengers SET seat_id = ? WHERE id = ? AND booking_id = ?").run(assignment.seat_id, assignment.passenger_id, Number(booking.id));
      }

      db.query("COMMIT").run();
    } catch (e) {
      db.query("ROLLBACK").run();
      throw e;
    }

    const updated = db.query("SELECT * FROM bookings WHERE id = ?").get(Number(booking.id)) as Record<string, unknown>;
    return c.json(ok(updated, "Seats assigned successfully"));
  });
}
