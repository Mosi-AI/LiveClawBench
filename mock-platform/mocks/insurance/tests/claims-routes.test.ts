import { describe, expect, test, beforeEach } from "bun:test";
import { _resetSecret, resetDb } from "mock-lib";
import { createInsuranceApp } from "../src/index";
import {
  DEFAULT_USER_EMAIL,
  DEFAULT_USER_PASSWORD,
} from "../src/seed";

describe("claims routes", () => {
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

  test("GET /api/claims returns seeded claims for authenticated user", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/api/claims", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims).toBeDefined();
    expect(body.claims.length).toBe(3);
  });

  test("GET /api/claims returns 401 without token", async () => {
    const { app } = await createAppWithToken();
    const res = await app.request("/api/claims");
    expect(res.status).toBe(401);
  });

  test("POST /api/claims creates a new claim", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/api/claims", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        claim_type: "medical",
        total_amount: 25000,
        service_date: "2026-05-01",
        provider_name: "Test Clinic",
        check_item: "general_checkup",
        notes: "Test claim",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.claim_type).toBe("medical");
    expect(body.total_amount).toBe(25000);
    expect(body.status).toBe("submitted");
  });

  test("GET /api/claims/:id returns claim with line items and attachments", async () => {
    const { app, token } = await createAppWithToken();
    const listRes = await app.request("/api/claims", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { claims } = await listRes.json();
    const claimId = claims[0].id;

    const res = await app.request(`/api/claims/${claimId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(claimId);
    expect(body.line_items).toBeDefined();
    expect(body.attachments).toBeDefined();
  });

  test("GET /api/claims/:id returns 404 for non-existent claim", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/api/claims/9999", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  test("PATCH /api/claims/:id updates status", async () => {
    const { app, token } = await createAppWithToken();
    const listRes = await app.request("/api/claims", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { claims } = await listRes.json();
    const claimId = claims[0].id;

    const res = await app.request(`/api/claims/${claimId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "reimbursed" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("reimbursed");
  });

  test("POST /api/claims/:id/line-items adds a line item", async () => {
    const { app, token } = await createAppWithToken();
    // Create a fresh claim with a high total to accommodate the line item
    const createRes = await app.request("/api/claims", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        claim_type: "medical",
        total_amount: 25000,
        service_date: "2026-05-01",
        provider_name: "Test Clinic",
        check_item: "general_checkup",
      }),
    });
    const newClaim = await createRes.json();
    const claimId = newClaim.id;

    const res = await app.request(`/api/claims/${claimId}/line-items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        description: "New line item",
        amount_cents: 5000,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.claim_id).toBe(claimId);
    expect(body.description).toBe("New line item");
    expect(body.amount_cents).toBe(5000);
  });

  test("POST /api/claims/:id/line-items rejects if total exceeds claim amount", async () => {
    const { app, token } = await createAppWithToken();
    const createRes = await app.request("/api/claims", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        claim_type: "medical",
        total_amount: 1000,
        service_date: "2026-05-01",
        provider_name: "Test Clinic",
        check_item: "general_checkup",
      }),
    });
    const newClaim = await createRes.json();
    const claimId = newClaim.id;

    const res = await app.request(`/api/claims/${claimId}/line-items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        description: "Over budget",
        amount_cents: 2000,
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Line item total exceeds claim amount");
  });

  test("POST /api/claims/:id/attachments adds an attachment", async () => {
    const { app, token } = await createAppWithToken();
    const listRes = await app.request("/api/claims", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { claims } = await listRes.json();
    const claimId = claims[0].id;

    const res = await app.request(`/api/claims/${claimId}/attachments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        filename: "receipt.pdf",
        file_path: "/uploads/receipt.pdf",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.claim_id).toBe(claimId);
    expect(body.filename).toBe("receipt.pdf");
  });
});
