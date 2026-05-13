import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute } from "mock-lib";
import { ok, err } from "mock-lib";
import {
  OkSchema,
  ErrSchema,
  PaymentSchema,
  ProcessPaymentBodySchema,
} from "../schemas";
import { z } from "zod";

export function registerPaymentRoutes(app: OpenAPIApp, db: Database, prefix: string): void {
  const paymentResponse = OkSchema(z.object({ payment: PaymentSchema, booking_status: z.string() }));

  const processRoute = createRoute({
    method: "post",
    path: `${prefix}/payment/process`,
    summary: "Process payment",
    request: {
      body: {
        content: { "application/json": { schema: ProcessPaymentBodySchema } },
        description: "Payment details",
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: paymentResponse } },
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

  app.openApiRoute(processRoute, async (c) => {
    const body = c.req.valid("json");
    const bookingId = body.booking_id;
    const cardNumber = body.card_number;
    const cardHolder = body.card_holder;
    const expiry = body.expiry;
    const cvv = body.cvv;

    const booking = db.query("SELECT * FROM bookings WHERE id = ?").get(bookingId) as Record<string, unknown> | null;
    if (!booking) return c.json(err("Booking not found"), 404);

    const isValidCard = /^4[0-9]{15}$/.test(cardNumber.replace(/\s/g, ""));
    if (!isValidCard) {
      return c.json(err("Invalid card number"), 400);
    }

    const isAutomated = cardHolder === "Auto Payment";
    const success = isAutomated ? true : Math.random() < 0.9;

    if (!success) {
      db.query(
        "INSERT INTO payments (booking_id, amount, currency, payment_status, card_last_four, card_type, card_holder_name) VALUES (?, ?, 'USD', 'failed', ?, 'visa', ?)"
      ).run(bookingId, Number(booking.total_price), cardNumber.slice(-4), cardHolder);
      return c.json(err("Payment declined"), 400);
    }

    const transactionId = `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const existingPayment = db.query("SELECT id FROM payments WHERE booking_id = ?").get(bookingId) as { id: number } | null;
    if (existingPayment) {
      db.query(
        "UPDATE payments SET payment_status = 'completed', card_last_four = ?, card_type = 'visa', card_holder_name = ?, transaction_id = ?, paid_at = datetime('now') WHERE id = ?"
      ).run(cardNumber.slice(-4), cardHolder, transactionId, existingPayment.id);
    } else {
      db.query(
        "INSERT INTO payments (booking_id, amount, currency, payment_status, card_last_four, card_type, card_holder_name, transaction_id, paid_at) VALUES (?, ?, 'USD', 'completed', ?, 'visa', ?, ?, datetime('now'))"
      ).run(bookingId, Number(booking.total_price), cardNumber.slice(-4), cardHolder, transactionId);
    }

    if (booking.booking_status === "pending") {
      db.query("UPDATE bookings SET booking_status = 'confirmed', updated_at = datetime('now') WHERE id = ?").run(bookingId);
    }

    const payment = db.query("SELECT * FROM payments WHERE booking_id = ? ORDER BY id DESC LIMIT 1").get(bookingId) as Record<string, unknown>;
    return c.json(ok({ payment, booking_status: "confirmed" }, "Payment processed successfully"));
  });
}
