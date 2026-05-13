import type { Database } from "bun:sqlite";
import { describe, expect, test, beforeEach } from "bun:test";
import { createAirlineApp } from "../src/index";
import { resetAirlineDb } from "../src/db";
import type { OpenAPIApp } from "mock-lib";

describe("airline routes", () => {
  let app: OpenAPIApp;
  let db: Database;

  beforeEach(() => {
    resetAirlineDb();
    const mockApp = createAirlineApp({ dbPath: ":memory:" });
    app = mockApp.app;
    db = mockApp.db;
  });

  describe("auth", () => {
    test("POST /api/auth/register creates user", async () => {
      const email = `test-${Date.now()}@example.com`;
      const res = await app.request("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "password123", first_name: "Test", last_name: "User" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe(email);
    });

    test("POST /api/auth/login returns token", async () => {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "peter.griffin@work.mosi.inc", password: "password123" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.access_token).toBeDefined();
    });

    test("GET /api/auth/profile returns default user", async () => {
      const res = await app.request("/api/auth/profile");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.email).toBe("peter.griffin@work.mosi.inc");
    });
  });

  describe("flights", () => {
    test("GET /api/flights returns paginated list", async () => {
      const res = await app.request("/api/flights");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.flights).toBeArray();
      expect(body.data.total).toBeGreaterThan(0);
    });

    test("POST /api/flights/search filters by origin/destination", async () => {
      const res = await app.request("/api/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: "JFK", destination: "LAX", departure_date: "2026-05-05" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.flights).toBeArray();
    });

    test("GET /api/flights/:id/seats returns grouped seats", async () => {
      const flightRes = await app.request("/api/flights");
      const flightBody = await flightRes.json();
      const flightId = flightBody.data.flights[0].id;

      const res = await app.request(`/api/flights/${flightId}/seats`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.seats.economy).toBeArray();
      expect(body.data.total_seats).toBe(208);
      expect(body.data.flight_number).toBeString();
      expect(body.data.available_seats).toBeObject();
    });
  });

  describe("bookings", () => {
    test("POST /api/bookings/ creates confirmed booking with payment side effect", async () => {
      const flightRes = await app.request("/api/flights");
      const flightBody = await flightRes.json();
      const flightId = flightBody.data.flights[0].id;

      const res = await app.request("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flight_id: flightId,
          cabin_class: "economy",
          passengers: [{ first_name: "Test", last_name: "User", date_of_birth: "1990-01-01" }],
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.booking_status).toBe("confirmed");
      expect(body.data.booking_reference).toHaveLength(6);

      // Verify payment side effect was created
      const payments = await app.request(`/api/bookings/${body.data.booking_reference}`);
      const paymentBody = await payments.json();
      expect(paymentBody.data.payment).toBeDefined();
      expect(paymentBody.data.payment.payment_status).toBe("completed");
    });

    test("POST /api/payment/process processes payment", async () => {
      const flightRes = await app.request("/api/flights");
      const flightBody = await flightRes.json();
      const flightId = flightBody.data.flights[0].id;

      const bookingRes = await app.request("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flight_id: flightId,
          cabin_class: "economy",
          passengers: [{ first_name: "Test", last_name: "User", date_of_birth: "1990-01-01" }],
        }),
      });
      const bookingBody = await bookingRes.json();
      const bookingId = bookingBody.data.id;

      const res = await app.request("/api/payment/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          card_number: "4111111111111111",
          card_holder: "Auto Payment",
          expiry: "12/25",
          cvv: "123",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.payment).toBeDefined();
      expect(body.data.payment.payment_status).toBe("completed");
    });
  });

  describe("claims", () => {
    test("POST /api/claims creates claim", async () => {
      const res = await app.request("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_reference: "FAKE01",
          claim_type: "cancellation",
          claim_amount: 500,
          claim_reason: "Flight was cancelled",
        }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  describe("claims calculate-refund (Flask parity)", () => {
    async function setupBookingOnExistingFlight(overrides: Record<string, unknown> = {}) {
      // Get first seeded flight
      const flight = db.query("SELECT id, base_price_economy FROM flights LIMIT 1").get() as { id: number; base_price_economy: number } | null;
      expect(flight).toBeDefined();

      // Apply overrides to flight
      if (overrides.status) {
        db.query("UPDATE flights SET status = ? WHERE id = ?").run(String(overrides.status), flight!.id);
      }
      if (overrides.delay_minutes !== undefined) {
        db.query("UPDATE flights SET delay_minutes = ? WHERE id = ?").run(Number(overrides.delay_minutes), flight!.id);
      }

      // Create a booking for this flight
      const totalPrice = Number(overrides.total_price ?? 300);
      const ref = `REFUND-${Date.now()}`;
      db.query(
        "INSERT INTO bookings (booking_reference, user_id, flight_id, cabin_class, total_price, booking_status, checked_in) VALUES (?, 1, ?, 'economy', ?, 'confirmed', 0)"
      ).run(ref, flight!.id, totalPrice);
      return { ref, totalPrice: Number(totalPrice) };
    }

    test("cancellation + cancelled flight = full refund", async () => {
      const { ref, totalPrice } = await setupBookingOnExistingFlight({ status: "cancelled", total_price: 300 });
      const res = await app.request(`/api/claims/calculate-refund/${ref}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_type: "cancellation" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.refund_amount).toBe(totalPrice);
      expect(body.data.reason).toContain("cancelled flight");
    });

    test("delay + positive delay_minutes = $25/hr capped at total", async () => {
      const { ref } = await setupBookingOnExistingFlight({ delay_minutes: 120, total_price: 300 });
      const res = await app.request(`/api/claims/calculate-refund/${ref}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_type: "delay" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      // 120 min / 60 = 2 hours * $25 = $50
      expect(body.data.refund_amount).toBe(50);
      expect(body.data.reason).toContain("120 minute delay");
    });

    test("no matching conditions = zero refund with 'No compensation applicable'", async () => {
      const { ref } = await setupBookingOnExistingFlight({ delay_minutes: 0 });
      const res = await app.request(`/api/claims/calculate-refund/${ref}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_type: "cancellation" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.refund_amount).toBe(0);
      expect(body.data.reason).toBe("No compensation applicable");
    });

    test("delay compensation capped by total price", async () => {
      const { ref } = await setupBookingOnExistingFlight({ delay_minutes: 600, total_price: 100 });
      const res = await app.request(`/api/claims/calculate-refund/${ref}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_type: "delay" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      // 600/60 = 10hr * $25 = $250 but capped at 100
      expect(body.data.refund_amount).toBe(100);
    });
  });

  describe("baggage POST returns 201", () => {
    test("POST /api/baggage creates report with 201 status", async () => {
      const res = await app.request("/api/baggage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flight_number: "GKD1001",
          flight_time: "2026-06-01 10:00:00",
          passenger_name: "Peter Griffin",
          passenger_phone: "555-1234",
          passenger_email: "peter@example.com",
          baggage_description: "Black suitcase",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain("successfully");
    });
  });

  describe("seat selection upgrade fee (flight-seat-selection-failed flow)", () => {
    test("returns upgrade fee with 350 when all economy window seats are occupied", async () => {
      // Get a flight with seats
      const flightRes = await app.request("/api/flights");
      const flightBody = await flightRes.json();
      const flightId = flightBody.data.flights[0].id;

      // Create a booking for this flight
      const bookingRes = await app.request("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flight_id: flightId,
          cabin_class: "economy",
          passengers: [{ first_name: "Test", last_name: "User", date_of_birth: "1990-01-01" }],
        }),
      });
      const bookingBody = await bookingRes.json();
      const bookingRef = bookingBody.data.booking_reference;
      const bookingId = bookingBody.data.id;

      // Query passenger from DB directly
      const passenger = db.query("SELECT id FROM passengers WHERE booking_id = ? LIMIT 1").get(bookingId) as { id: number } | null;
      expect(passenger).toBeDefined();

      // Get all economy window seats and mark them all as unavailable
      // (simulating flight-seat-selection-failed scenario)
      db.query(
        "UPDATE seats SET is_available = 0 WHERE flight_id = ? AND cabin_class = 'economy' AND is_window = 1"
      ).run(flightId);

      // Find one of those occupied window seats
      const occupiedWindowSeat = db.query(
        "SELECT id, seat_number FROM seats WHERE flight_id = ? AND cabin_class = 'economy' AND is_window = 1 LIMIT 1"
      ).get(flightId) as { id: number; seat_number: string } | null;
      expect(occupiedWindowSeat).toBeDefined();

      // Attempt to select that occupied window seat
      const seatRes = await app.request(`/api/bookings/${bookingRef}/seats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seat_assignments: [{ passenger_id: passenger!.id, seat_id: occupiedWindowSeat!.id }],
        }),
      });
      expect(seatRes.status).toBe(400);
      const seatBody = await seatRes.json();
      expect(seatBody.success).toBe(false);
      expect(seatBody.message).toContain("350");
      expect(seatBody.message).toContain("upgrade");
    });
  });

  describe("mock services", () => {
    test("GET /api/emails returns emails with legacy key", async () => {
      const res = await app.request("/api/emails");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.emails).toBeArray();
    });

    test("GET /api/calendar/events returns events", async () => {
      const res = await app.request("/api/calendar/events");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.events).toBeArray();
    });

    test("GET /api/chat/sessions returns sessions", async () => {
      const res = await app.request("/api/chat/sessions");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.sessions).toBeArray();
    });
  });
});
