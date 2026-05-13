import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ok, err, paginate, parsePageParams } from "../helpers";

function registerPaymentRoutes(app: OpenAPIApp, db: Database, prefix: string): void {
  app.post(`${prefix}/payment/process`, async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    const bookingId = parseInt(String(body.booking_id ?? "0"), 10);
    const cardNumber = String(body.card_number ?? "");
    const cardHolder = String(body.card_holder ?? "");
    const expiry = String(body.expiry ?? "");
    const cvv = String(body.cvv ?? "");

    if (!bookingId) return c.json(err("booking_id is required"), 400);

    const booking = db.query("SELECT * FROM bookings WHERE id = ?").get(bookingId) as Record<string, unknown> | null;
    if (!booking) return c.json(err("Booking not found"), 404);

    // Validate card (Visa test card)
    const isValidCard = /^4[0-9]{15}$/.test(cardNumber.replace(/\s/g, ""));
    if (!isValidCard) {
      return c.json(err("Invalid card number"), 400);
    }

    // Automated payment: 100% success with delay; Manual: 90% success
    const isAutomated = cardHolder === "Auto Payment";
    const success = isAutomated ? true : Math.random() < 0.9;

    if (!success) {
      db.query(
        "INSERT INTO payments (booking_id, amount, currency, payment_status, card_last_four, card_type, card_holder_name) VALUES (?, ?, 'USD', 'failed', ?, 'visa', ?)"
      ).run(bookingId, Number(booking.total_price), cardNumber.slice(-4), cardHolder);
      return c.json(err("Payment declined"), 400);
    }

    const transactionId = `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const totalPrice = Number(booking.total_price);

    // Check for existing payment (booking creation may have already created one)
    const existingPayment = db.query("SELECT id FROM payments WHERE booking_id = ?").get(bookingId) as { id: number } | null;
    if (existingPayment) {
      db.query(
        "UPDATE payments SET payment_status = 'completed', card_last_four = ?, card_type = 'visa', card_holder_name = ?, transaction_id = ?, paid_at = datetime('now') WHERE id = ?"
      ).run(cardNumber.slice(-4), cardHolder, transactionId, existingPayment.id);
    } else {
      db.query(
        "INSERT INTO payments (booking_id, amount, currency, payment_status, card_last_four, card_type, card_holder_name, transaction_id, paid_at) VALUES (?, ?, 'USD', 'completed', ?, 'visa', ?, ?, datetime('now'))"
      ).run(bookingId, totalPrice, cardNumber.slice(-4), cardHolder, transactionId);
    }

    // Update booking to confirmed
    db.query("UPDATE bookings SET booking_status = 'confirmed', updated_at = datetime('now') WHERE id = ?").run(bookingId);

    const payment = db.query("SELECT * FROM payments WHERE booking_id = ? ORDER BY id DESC LIMIT 1").get(bookingId) as Record<string, unknown>;
    return c.json(ok({ payment, booking_status: "confirmed" }, "Payment processed successfully"));
  });
}

function registerEmailRoutes(app: OpenAPIApp, db: Database, prefix: string): void {
  app.get(`${prefix}/emails`, (c) => {
    const query = c.req.query();
    const { page, perPage, offset } = parsePageParams(query.page, query.per_page);
    const emailType = query.type;
    const unreadOnly = query.unread_only === "true";

    const userId = c.get("userId")!;
    let sql = "SELECT * FROM email_notifications WHERE user_id = ?";
    const params: (number | string)[] = [userId];

    if (emailType) {
      sql += " AND email_type = ?";
      params.push(emailType);
    }
    if (unreadOnly) {
      sql += " AND is_read = 0";
    }

    const countRow = db.query(`SELECT COUNT(*) as total FROM (${sql})`).get(...params) as { total: number };
    const emails = db.query(`${sql} ORDER BY sent_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset) as Record<string, unknown>[];

    return c.json(ok({
      emails,
      total: countRow.total,
      page,
      per_page: perPage,
      pages: Math.ceil(countRow.total / perPage),
    }));
  });

  app.get(`${prefix}/emails/:email_id`, (c) => {
    const id = parseInt(c.req.param("email_id"), 10);
    const userId = c.get("userId")!;
    const email = db.query("SELECT * FROM email_notifications WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown> | null;
    if (!email) return c.json(err("Email not found"), 404);

    db.query("UPDATE email_notifications SET is_read = 1 WHERE id = ?").run(id);
    return c.json(ok(email));
  });
}

function registerCalendarRoutes(app: OpenAPIApp, db: Database, prefix: string): void {
  app.get(`${prefix}/calendar/events`, (c) => {
    const startDate = c.req.query("start_date");
    const endDate = c.req.query("end_date");

    const userId = c.get("userId")!;
    let sql = "SELECT * FROM calendar_events WHERE user_id = ?";
    const params: (number | string)[] = [userId];

    if (startDate) {
      sql += " AND start_time >= ?";
      params.push(startDate);
    }
    if (endDate) {
      sql += " AND end_time <= ?";
      params.push(endDate);
    }

    const items = db.query(`${sql} ORDER BY start_time`).all(...params) as Record<string, unknown>[];
    return c.json(ok({ events: items }));
  });
}

function registerChatRoutes(app: OpenAPIApp, db: Database, prefix: string): void {
  app.get(`${prefix}/chat/sessions`, (c) => {
    const userId = c.get("userId")!;
    const status = c.req.query("status");
    let sql = "SELECT * FROM chat_sessions WHERE user_id = ?";
    const params: (number | string)[] = [userId];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    const items = db.query(`${sql} ORDER BY started_at DESC`).all(...params) as Record<string, unknown>[];
    return c.json(ok({ sessions: items }));
  });

  app.post(`${prefix}/chat/sessions`, (c) => {
    const userId = c.get("userId")!;
    const sessionId = `chat-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    db.query(
      "INSERT INTO chat_sessions (user_id, session_id, status) VALUES (?, ?, 'active')"
    ).run(userId, sessionId);

    const id = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);
    const session = db.query("SELECT * FROM chat_sessions WHERE id = ?").get(id) as Record<string, unknown>;
    return c.json(ok(session, "Chat session created"));
  });

  app.post(`${prefix}/chat/sessions/:session_id/messages`, async (c) => {
    const sessionId = c.req.param("session_id");
    const body = (await c.req.json()) as Record<string, unknown>;
    const message = String(body.message ?? "");

    if (!message) return c.json(err("message is required"), 400);

    const userId = c.get("userId")!;
    const session = db.query("SELECT * FROM chat_sessions WHERE session_id = ? AND user_id = ?").get(sessionId, userId) as Record<string, unknown> | null;
    if (!session) return c.json(err("Session not found"), 404);

    const sessionDbId = Number(session.id);

    db.query(
      "INSERT INTO chat_messages (session_id, message, sender_type, sender_name) VALUES (?, ?, 'user', 'Customer')"
    ).run(sessionDbId, message);

    // Simple bot response
    const responses = [
      "Thank you for contacting GKD Airlines support. How can I assist you today?",
      "I understand your concern. Let me look into that for you.",
      "For booking changes, please visit the 'My Bookings' section.",
      "Your booking reference is your 6-character code. You can find it in your confirmation email.",
      "Is there anything else I can help you with today?",
    ];
    const botResponse = responses[Math.floor(Math.random() * responses.length)];

    db.query(
      "INSERT INTO chat_messages (session_id, message, sender_type, sender_name) VALUES (?, ?, 'bot', 'GKD Support')"
    ).run(sessionDbId, botResponse);

    return c.json(ok({ user_message: message, bot_response: botResponse }));
  });

  app.post(`${prefix}/chat/sessions/:session_id/close`, (c) => {
    const sessionId = c.req.param("session_id");
    const userId = c.get("userId")!;
    const session = db.query("SELECT * FROM chat_sessions WHERE session_id = ? AND user_id = ?").get(sessionId, userId) as Record<string, unknown> | null;
    if (!session) return c.json(err("Session not found"), 404);

    db.query("UPDATE chat_sessions SET status = 'closed', ended_at = datetime('now') WHERE id = ?").run(Number(session.id));
    return c.json(ok(null, "Chat session closed"));
  });
}

export function registerMockServiceRoutes(app: OpenAPIApp, db: Database): void {
  // Register at both /api/mock/* (legacy) and /api/* (new) for compatibility
  registerPaymentRoutes(app, db, "/api/mock");
  registerEmailRoutes(app, db, "/api/mock");
  registerCalendarRoutes(app, db, "/api/mock");
  registerChatRoutes(app, db, "/api/mock");

  registerPaymentRoutes(app, db, "/api");
  registerEmailRoutes(app, db, "/api");
  registerCalendarRoutes(app, db, "/api");
  registerChatRoutes(app, db, "/api");
}
