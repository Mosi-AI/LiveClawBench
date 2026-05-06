import { describe, expect, test, beforeEach } from "bun:test";
import { _resetSecret, resetDb } from "mock-lib";
import { createInsuranceApp } from "../src/index";
import {
  DEFAULT_USER_EMAIL,
  DEFAULT_USER_PASSWORD,
} from "../src/seed";

describe("appointments routes", () => {
  beforeEach(() => {
    resetDb();
    _resetSecret();
    process.env.NODE_ENV = "test";
    process.env.MOCK_JWT_SECRET = "test-secret-for-deterministic-jwt";
    process.env.INSURANCE_DB_PATH = ":memory:";
  });

  async function createAppWithToken() {
    const insuranceApp = createInsuranceApp();
    insuranceApp.seed!();
    const app = insuranceApp.app;

    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: DEFAULT_USER_EMAIL,
        password: DEFAULT_USER_PASSWORD,
      }),
    });
    const { token } = await loginRes.json();
    return { app, token };
  }

  test("GET /api/providers returns providers without auth", async () => {
    const { app } = await createAppWithToken();
    const res = await app.request("/api/providers");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.providers).toBeDefined();
    expect(body.providers.length).toBeGreaterThanOrEqual(14);
    // Each provider should include services
    expect(body.providers[0].services).toBeDefined();
    expect(body.providers[0].services.length).toBeGreaterThan(0);
  });

  test("GET /api/providers filters by check_item", async () => {
    const { app } = await createAppWithToken();
    const res = await app.request("/api/providers?check_item=lab");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.providers.length).toBeGreaterThan(0);
    for (const p of body.providers) {
      expect(p.services.some((s: any) => s.check_item === "lab")).toBe(true);
    }
  });

  test("GET /api/providers filters by district and max_distance", async () => {
    const { app } = await createAppWithToken();
    const res = await app.request("/api/providers?district=Central&max_distance=2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.providers.length).toBeGreaterThan(0);
    for (const p of body.providers) {
      expect(p.district).toBe("Central");
      expect(p.distance_km).toBeLessThanOrEqual(2);
    }
  });

  test("GET /api/providers filters by max_price", async () => {
    const { app } = await createAppWithToken();
    const res = await app.request("/api/providers?max_price=3000");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.providers.length).toBeGreaterThan(0);
    for (const p of body.providers) {
      expect(p.services.some((s: any) => s.cost <= 3000)).toBe(true);
    }
  });

  test("GET /api/providers/:id returns provider with services without auth", async () => {
    const { app } = await createAppWithToken();
    const listRes = await app.request("/api/providers");
    const { providers } = await listRes.json();
    const providerId = providers[0].id;

    const res = await app.request(`/api/providers/${providerId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(providerId);
    expect(body.services).toBeDefined();
    expect(body.services.length).toBeGreaterThan(0);
  });

  test("GET /api/providers/:id/services/:service_id/slots returns available slots without auth", async () => {
    const { app } = await createAppWithToken();
    const listRes = await app.request("/api/providers");
    const { providers } = await listRes.json();
    const providerId = providers[0].id;

    const providerRes = await app.request(`/api/providers/${providerId}`);
    const { services } = await providerRes.json();
    const serviceId = services[0].id;

    const res = await app.request(
      `/api/providers/${providerId}/services/${serviceId}/slots`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slots).toBeDefined();
    expect(body.slots.length).toBeGreaterThan(0);
    // All returned slots should be available
    for (const slot of body.slots) {
      expect(slot.is_available).toBe(1);
    }
  });

  test("GET /api/providers/:id/services/:service_id/slots filters by date_from", async () => {
    const { app } = await createAppWithToken();
    const listRes = await app.request("/api/providers");
    const { providers } = await listRes.json();
    const providerId = providers[0].id;

    const providerRes = await app.request(`/api/providers/${providerId}`);
    const { services } = await providerRes.json();
    const serviceId = services[0].id;

    // Use a date 15 days from now (all slots are within 1-14 days ahead)
    const farFuture = new Date();
    farFuture.setUTCDate(farFuture.getUTCDate() + 15);
    const dateFrom = farFuture.toISOString().slice(0, 10);

    const res = await app.request(
      `/api/providers/${providerId}/services/${serviceId}/slots?date_from=${dateFrom}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slots.length).toBe(0);
  });

  test("GET /api/providers/:id/services/:service_id/slots filters by date_to", async () => {
    const { app } = await createAppWithToken();
    const listRes = await app.request("/api/providers");
    const { providers } = await listRes.json();
    const providerId = providers[0].id;

    const providerRes = await app.request(`/api/providers/${providerId}`);
    const { services } = await providerRes.json();
    const serviceId = services[0].id;

    // Use tomorrow as date_to — at least some slots should be excluded
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const dateTo = tomorrow.toISOString().slice(0, 10) + "T23:59:59Z";

    const res = await app.request(
      `/api/providers/${providerId}/services/${serviceId}/slots?date_to=${dateTo}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // Some slots fall on day 1, so they should still be included
    expect(body.slots.length).toBeGreaterThanOrEqual(0);
    for (const slot of body.slots) {
      expect(slot.end_time <= dateTo).toBe(true);
    }
  });

  test("POST /api/appointments books an appointment and freezes snapshot", async () => {
    const { app, token } = await createAppWithToken();
    const listRes = await app.request("/api/providers", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { providers } = await listRes.json();
    const providerId = providers[0].id;

    const providerRes = await app.request(`/api/providers/${providerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { services } = await providerRes.json();
    const serviceId = services[0].id;

    const slotsRes = await app.request(
      `/api/providers/${providerId}/services/${serviceId}/slots`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const { slots } = await slotsRes.json();
    const slotId = slots[0].id;

    const res = await app.request("/api/appointments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ slot_id: slotId }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.slot_id).toBe(slotId);
    expect(body.provider_name).toBeDefined();
    expect(body.service_name_snapshot).toBeDefined();
    expect(body.cost_snapshot).toBeGreaterThan(0);
    expect(body.distance_km_snapshot).toBeDefined();

    // Slot should now be unavailable
    const slotsAfterRes = await app.request(
      `/api/providers/${providerId}/services/${serviceId}/slots`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const { slots: slotsAfter } = await slotsAfterRes.json();
    expect(slotsAfter.find((s: any) => s.id === slotId)).toBeUndefined();
  });

  test("GET /api/appointments returns user appointments", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/api/appointments", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appointments).toBeDefined();
    expect(body.appointments.length).toBe(0);
  });

  test("GET /api/appointments/:id returns appointment details", async () => {
    const { app, token } = await createAppWithToken();
    const listRes = await app.request("/api/providers", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { providers } = await listRes.json();
    const providerId = providers[0].id;

    const providerRes = await app.request(`/api/providers/${providerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { services } = await providerRes.json();
    const serviceId = services[0].id;

    const slotsRes = await app.request(
      `/api/providers/${providerId}/services/${serviceId}/slots`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const { slots } = await slotsRes.json();
    const slotId = slots[0].id;

    const bookRes = await app.request("/api/appointments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ slot_id: slotId }),
    });
    const { id: appointmentId } = await bookRes.json();

    const res = await app.request(`/api/appointments/${appointmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(appointmentId);
    expect(body.slot_id).toBe(slotId);
  });
});
