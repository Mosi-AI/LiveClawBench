import { describe, test, expect, beforeEach } from "bun:test";
import { createExpenseApp } from "../src/index.js";
import { runMigrations, resetDb } from "../src/db/init.js";
import { seed } from "../src/db/seed.js";
import type { MockAppV2 } from "mock-lib";

describe("Expense Mock", () => {
  let app: MockAppV2;

  beforeEach(() => {
    process.env.EXPENSE_MOCK_DB_PATH = ":memory:";
    process.env.EXPENSE_MOCK_ATTACHMENTS_DIR = `${process.env.TMPDIR || "/tmp"}/expense-mock-attachments-${Date.now()}`;
    resetDb();
    app = createExpenseApp();
    runMigrations();
    seed();
  });

  test("GET /health returns 200 with ok", async () => {
    const res = await app.app.request("/health");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  test("GET /__mock_sentinel__/expense returns { ok: true }", async () => {
    const res = await app.app.request("/__mock_sentinel__/expense");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true });
  });

  test("POST /api/auth/token with valid credentials returns JWT", async () => {
    const res = await app.app.request("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@mosi.inc", password: "password123" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.expires_in).toBe(3600);
  });

  test("POST /api/auth/token with invalid credentials returns 401", async () => {
    const res = await app.app.request("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@mosi.inc", password: "wrong" }),
    });
    expect(res.status).toBe(401);
  });

  test("GET /api/drafts without auth returns 401", async () => {
    const res = await app.app.request("/api/drafts");
    expect(res.status).toBe(401);
  });

  test("POST /api/drafts creates draft with auto-generated draft_code", async () => {
    const authRes = await app.app.request("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@mosi.inc", password: "password123" }),
    });
    const { token } = await authRes.json();

    const res = await app.app.request("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        vendor_name: "Test Vendor",
        amount: 100.00,
        currency: "USD",
        invoice_date: "2026-05-01",
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.draft_code).toMatch(/^EXP-2026-\d{4}$/);
    expect(data.vendor_name).toBe("Test Vendor");
    expect(data.status).toBe("draft");
  });

  test("PATCH /api/drafts/{id} updates field and creates activity", async () => {
    const authRes = await app.app.request("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@mosi.inc", password: "password123" }),
    });
    const { token } = await authRes.json();

    const createRes = await app.app.request("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ vendor_name: "Vendor A", amount: 50.00, invoice_date: "2026-05-01" }),
    });
    const draft = await createRes.json();

    const patchRes = await app.app.request(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ vendor_name: "Vendor B" }),
    });
    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json();
    expect(updated.vendor_name).toBe("Vendor B");

    const actRes = await app.app.request(`/api/drafts/${draft.id}/activities`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const activities = await actRes.json();
    const editActivity = activities.activities.find((a: any) => a.action_type === "edited");
    expect(editActivity).toBeDefined();
    expect(editActivity.field_name).toBe("vendor_name");
  });

  test("POST /api/drafts/{id}/submit transitions status and validates required fields", async () => {
    const authRes = await app.app.request("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@mosi.inc", password: "password123" }),
    });
    const { token } = await authRes.json();

    const createRes = await app.app.request("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ vendor_name: "Vendor", amount: 50.00, invoice_date: "2026-05-01" }),
    });
    const draft = await createRes.json();

    const submitRes = await app.app.request(`/api/drafts/${draft.id}/submit`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
    });
    expect(submitRes.status).toBe(400);
    const errData = await submitRes.json();
    expect(errData.fields[0].field).toBe("category");

    await app.app.request(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ category: "software" }),
    });

    const submitRes2 = await app.app.request(`/api/drafts/${draft.id}/submit`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
    });
    expect(submitRes2.status).toBe(200);
    const submitted = await submitRes2.json();
    expect(submitted.draft.status).toBe("submitted");

    const submitRes3 = await app.app.request(`/api/drafts/${draft.id}/submit`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
    });
    expect(submitRes3.status).toBe(409);
  });

  test("PATCH /api/drafts/{id} when status != draft returns 403", async () => {
    const authRes = await app.app.request("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@mosi.inc", password: "password123" }),
    });
    const { token } = await authRes.json();

    const createRes = await app.app.request("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ vendor_name: "Vendor", amount: 50.00, invoice_date: "2026-05-01", category: "software" }),
    });
    const draft = await createRes.json();

    await app.app.request(`/api/drafts/${draft.id}/submit`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
    });

    const patchRes = await app.app.request(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ vendor_name: "New Vendor" }),
    });
    expect(patchRes.status).toBe(403);
  });

  test("DELETE /api/drafts/{id} removes draft", async () => {
    const authRes = await app.app.request("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@mosi.inc", password: "password123" }),
    });
    const { token } = await authRes.json();

    const createRes = await app.app.request("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ vendor_name: "To Delete", amount: 10.00, invoice_date: "2026-05-01" }),
    });
    const draft = await createRes.json();

    const delRes = await app.app.request(`/api/drafts/${draft.id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
    expect(delRes.status).toBe(200);
  });

  test("GET /api/reports/spend-over-time returns aggregated data", async () => {
    const authRes = await app.app.request("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@mosi.inc", password: "password123" }),
    });
    const { token } = await authRes.json();

    const createRes = await app.app.request("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ vendor_name: "Vendor", amount: 200.00, invoice_date: "2026-05-01", category: "software" }),
    });
    const draft = await createRes.json();

    await app.app.request(`/api/drafts/${draft.id}/submit`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
    });

    const reportRes = await app.app.request("/api/reports/spend-over-time?group_by=month&currency=USD", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    expect(reportRes.status).toBe(200);
    const data = await reportRes.json();
    expect(data.data).toBeInstanceOf(Array);
    expect(data.total_spend).toBeGreaterThanOrEqual(200);
  });

  test("Unauthenticated page access redirects to /login", async () => {
    const res = await app.app.request("/dashboard");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  test("POST /api/drafts/{id}/attachments uploads file and creates record", async () => {
    const authRes = await app.app.request("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@mosi.inc", password: "password123" }),
    });
    const { token } = await authRes.json();

    const createRes = await app.app.request("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ vendor_name: "Upload Test", amount: 30.00, invoice_date: "2026-05-01" }),
    });
    const draft = await createRes.json();

    const formData = new FormData();
    formData.append("file", new File(["Hello receipt content"], "receipt.txt", { type: "text/plain" }));

    const uploadRes = await app.app.request(`/api/drafts/${draft.id}/attachments`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: formData,
    });
    expect(uploadRes.status).toBe(200);
    const data = await uploadRes.json();
    expect(data.success).toBe(true);
    expect(data.attachment.attachment_ref).toMatch(/^att_[a-z0-9]{8}$/);
  });
});
