import { describe, expect, test, beforeEach } from "bun:test";
import { _resetSecret, resetDb } from "mock-lib";
import { createInsuranceApp } from "../src/index";
import {
  DEFAULT_USER_EMAIL,
  DEFAULT_USER_PASSWORD,
} from "../src/seed";

describe("SSR pages", () => {
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

  test("GET /login returns 200 HTML", async () => {
    const { app } = await createAppWithToken();
    const res = await app.request("/login");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Insurance Portal Login");
    expect(html).toContain("<form");
  });

  test("GET /claims without auth redirects to /login", async () => {
    const { app } = await createAppWithToken();
    const res = await app.request("/claims");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login?next=%2Fclaims");
  });

  test("GET /claims with Bearer token returns 200 HTML", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/claims", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("My Claims");
    expect(html).toContain("data-table");
  });

  test("GET /claims/new returns 200 HTML", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/claims/new", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Submit a New Claim");
    expect(html).toContain("<form");
  });

  test("POST /claims/new creates claim and redirects to /claims/:id", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/claims/new", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        claim_type: "medical",
        total_amount: "25000",
        service_date: "2026-05-01",
        provider_name: "Test Clinic",
        check_item: "lab",
        notes: "Test note",
      }).toString(),
    });
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toMatch(/^\/claims\/\d+$/);
  });

  test("GET /claims/:id returns 200 HTML", async () => {
    const { app, token } = await createAppWithToken();
    const listRes = await app.request("/api/claims", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { claims } = await listRes.json();
    const claimId = claims[0].id;

    const res = await app.request(`/claims/${claimId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(`Claim #${claimId}`);
    expect(html).toContain("Line Items");
  });

  test("GET /appointments/search returns 200 HTML", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/appointments/search", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Find Providers");
    expect(html).toContain("data-table");
  });

  test("GET /appointments/search with district filter shows only matching providers", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/appointments/search?district=Central", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Central");
    // Should not show providers from other districts
    expect(html).not.toContain("Riverside");
    expect(html).not.toContain("North");
  });

  test("GET /appointments/search with check_item filter shows only matching providers", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/appointments/search?check_item=lab", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Metro Lab Services");
    // Should not show providers that don't offer lab
    expect(html).not.toContain("Nutrition & Wellness Center");
  });

  test("GET /appointments/search with max_distance filter excludes distant providers", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/appointments/search?max_distance=2", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    // Providers within 2km should appear
    expect(html).toContain("Central");
    // Distant providers should not appear
    expect(html).not.toContain("Highland");
    expect(html).not.toContain("Greenfield");
  });

  test("GET /appointments/search with max_price filter excludes expensive providers", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/appointments/search?max_price=3000", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    // Metro Lab Services offers Blood Test at 2500 cents
    expect(html).toContain("Metro Lab Services");
  });

  test("GET /appointments/search filter form preserves current values", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/appointments/search?district=Central&check_item=lab", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('value="Central"');
    expect(html).toContain('value="lab"');
  });

  test("GET /appointments/providers/:id returns 200 HTML", async () => {
    const { app, token } = await createAppWithToken();
    const listRes = await app.request("/api/providers");
    const { providers } = await listRes.json();
    const providerId = providers[0].id;

    const res = await app.request(`/appointments/providers/${providerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(providers[0].name);
    expect(html).toContain("Services");
  });

  test("POST /appointments/book books slot and redirects to /appointments/search", async () => {
    const { app, token } = await createAppWithToken();
    const listRes = await app.request("/api/providers");
    const { providers } = await listRes.json();
    const providerId = providers[0].id;

    const providerRes = await app.request(`/api/providers/${providerId}`);
    const { services } = await providerRes.json();
    const serviceId = services[0].id;

    const slotsRes = await app.request(
      `/api/providers/${providerId}/services/${serviceId}/slots`,
    );
    const { slots } = await slotsRes.json();
    const slotId = slots[0].id;

    const res = await app.request("/appointments/book", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ slot_id: String(slotId) }).toString(),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/appointments/search");
  });

  // Book the first available slot for the authenticated user and return
  // identifiers that downstream tests need to drive list / cancel flows.
  async function bookFirstSlotPage(app: any, token: string) {
    const providersRes = await app.request("/api/providers");
    const { providers } = await providersRes.json();
    const provider = providers[0];

    const providerRes = await app.request(`/api/providers/${provider.id}`);
    const { services } = await providerRes.json();
    const service = services[0];

    const slotsRes = await app.request(
      `/api/providers/${provider.id}/services/${service.id}/slots`,
    );
    const { slots } = await slotsRes.json();
    const slot = slots[0];

    const bookRes = await app.request("/api/appointments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slot_id: slot.id }),
    });
    const appointment = await bookRes.json();
    return {
      appointmentId: appointment.id as number,
      slotId: slot.id as number,
      providerId: provider.id as number,
      providerName: provider.name as string,
    };
  }

  test("GET /appointments without auth redirects to /login", async () => {
    const { app } = await createAppWithToken();
    const res = await app.request("/appointments");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login?next=%2Fappointments");
  });

  test("GET /appointments with no bookings shows empty state", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/appointments", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("My Appointments");
    expect(html).toContain("You have no appointments yet.");
    expect(html).toContain('href="/appointments/search"');
    expect(html).not.toContain("data-appointment-id=");
  });

  test("GET /appointments after booking lists the appointment with provider, network, and cancel control", async () => {
    const { app, token } = await createAppWithToken();
    const { appointmentId, providerName } = await bookFirstSlotPage(app, token);

    const res = await app.request("/appointments", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("data-table");
    expect(html).toContain(`data-appointment-id="${appointmentId}"`);
    expect(html).toContain(providerName);
    // The seeded first provider is in-network; the contaminated out-of-network
    // case is covered by the dedicated test below.
    expect(html).toMatch(/in_network|out_of_network/);
    expect(html).toContain(`action="/appointments/${appointmentId}/cancel"`);
    expect(html).toContain("Cancel");
    expect(html).toContain("status-confirmed");
  });

  test("GET /appointments surfaces out_of_network for an OON provider booking", async () => {
    const { app, token } = await createAppWithToken();

    // Find the first out-of-network provider via the public list endpoint.
    const oonListRes = await app.request(
      "/api/providers?network_status=out_of_network",
    );
    const { providers: oonProviders } = await oonListRes.json();
    expect(oonProviders.length).toBeGreaterThan(0);
    const provider = oonProviders[0];

    const detailRes = await app.request(`/api/providers/${provider.id}`);
    const { services } = await detailRes.json();
    const service = services[0];

    const slotsRes = await app.request(
      `/api/providers/${provider.id}/services/${service.id}/slots`,
    );
    const { slots } = await slotsRes.json();
    const slot = slots[0];

    await app.request("/api/appointments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ slot_id: slot.id }),
    });

    const res = await app.request("/appointments", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(provider.name);
    expect(html).toContain("out_of_network");
  });

  test("POST /appointments/:id/cancel without auth redirects to /login", async () => {
    const { app } = await createAppWithToken();
    const res = await app.request("/appointments/1/cancel", {
      method: "POST",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/^\/login\?next=/);
  });

  test("POST /appointments/:id/cancel cancels the appointment, frees the slot, and redirects to /appointments", async () => {
    const { app, token } = await createAppWithToken();
    const { appointmentId, slotId, providerId } = await bookFirstSlotPage(
      app,
      token,
    );

    const cancelRes = await app.request(
      `/appointments/${appointmentId}/cancel`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    expect(cancelRes.status).toBe(302);
    expect(cancelRes.headers.get("location")).toBe("/appointments");

    // Slot is freed and shows up again in the available slots list.
    const detailRes = await app.request(`/api/providers/${providerId}`);
    const { services } = await detailRes.json();
    const serviceId = services[0].id;
    const slotsRes = await app.request(
      `/api/providers/${providerId}/services/${serviceId}/slots`,
    );
    const { slots } = await slotsRes.json();
    expect(slots.map((s: any) => s.id)).toContain(slotId);

    // List page now shows the appointment as cancelled with no cancel form.
    const listRes = await app.request("/appointments", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.status).toBe(200);
    const html = await listRes.text();
    expect(html).toContain(`data-appointment-id="${appointmentId}"`);
    expect(html).toContain("status-cancelled");
    expect(html).not.toContain(`action="/appointments/${appointmentId}/cancel"`);
  });

  test("POST /appointments/:id/cancel on a non-existent id still redirects to /appointments", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/appointments/999999/cancel", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    // SSR flow intentionally redirects on no-op; the DELETE API surface is
    // responsible for returning 404 for missing appointments.
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/appointments");
  });

  test("GET /plans returns 200 HTML", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/plans", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Insurance Plans");
    expect(html).toContain("plan-card");
  });

  test("GET /plans/current returns 200 HTML", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/plans/current", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Current Plan");
    expect(html).toContain("Budget HDHP");
  });

  test("GET /plans/select returns 200 HTML", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/plans/select", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Select a Plan");
    expect(html).toContain("Select Budget HDHP");
    expect(html).toContain("Select Balanced Silver");
    expect(html).toContain("Select Premier Gold");
  });

  test("POST /plans/select selects plan and redirects to /plans/current", async () => {
    const { app, token } = await createAppWithToken();
    const plansRes = await app.request("/api/plans", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { plans } = await plansRes.json();
    const planId = plans[0].id;

    const res = await app.request("/plans/select", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ plan_id: String(planId) }).toString(),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/plans/current");
  });

  test("all pages link to /static/css/style.css", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/claims", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const html = await res.text();
    expect(html).toContain('href="/static/css/style.css"');
  });

  test("top nav contains Claims / Appointments / Plans links", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/claims", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const html = await res.text();
    expect(html).toContain('href="/claims"');
    expect(html).toContain('href="/appointments/search"');
    expect(html).toContain('href="/appointments"');
    expect(html).toContain('href="/plans"');
  });
});
