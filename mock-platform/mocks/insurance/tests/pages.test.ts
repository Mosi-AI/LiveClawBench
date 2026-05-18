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
    expect(html).toContain('href="/plans"');
  });
});
