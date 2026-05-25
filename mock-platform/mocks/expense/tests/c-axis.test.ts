import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetInjectionState } from "mock-lib";
import { createExpenseApp } from "../src/index.js";
import { runMigrations, resetDb } from "../src/db/init.js";
import { seed } from "../src/db/seed.js";
import type { MockAppV2 } from "mock-lib";

describe("expense C-axis fault injection", () => {
  let app: MockAppV2;
  let authToken: string;

  beforeEach(() => {
    process.env.EXPENSE_MOCK_DB_PATH = ":memory:";
    process.env.EXPENSE_MOCK_ATTACHMENTS_DIR = `${process.env.TMPDIR || "/tmp"}/expense-mock-attachments-${Date.now()}`;
    resetDb();
    resetInjectionState();
    delete process.env.TASK_NAME;
    app = createExpenseApp();
    runMigrations();
    seed();
  });

  afterEach(() => {
    delete process.env.EXPENSE_MOCK_DB_PATH;
    delete process.env.EXPENSE_MOCK_ATTACHMENTS_DIR;
    delete process.env.TASK_NAME;
  });

  async function getToken(): Promise<string> {
    const res = await app.app.request("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "alice@mosi.inc", password: "password123" }),
    });
    const body = await res.json();
    return body.token;
  }

  async function createDraft(token: string): Promise<number> {
    const res = await app.app.request("/api/drafts", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        vendor_name: "Test Merchant",
        amount: 100.0,
        currency: "USD",
        category: "meals",
        invoice_date: "2026-01-01",
      }),
    });
    const body = await res.json();
    return body.id;
  }

  // ---------------------------------------------------------------------------
  // C2 — expense-submit-verify
  // ---------------------------------------------------------------------------

  describe("C2: expense-submit-verify", () => {
    beforeEach(async () => {
      process.env.TASK_NAME = "expense-submit-verify";
      authToken = await getToken();
    });

    test("first submit returns success but draft stays 'draft'", async () => {
      const draftId = await createDraft(authToken);

      // Submit — C2 fires
      const submitRes = await app.app.request(`/api/drafts/${draftId}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(submitRes.status).toBe(200);
      const body = await submitRes.json();
      expect(body.success).toBe(true);

      // But draft should still have status 'draft'
      const getRes = await app.app.request(`/api/drafts/${draftId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const getData = await getRes.json();
      expect(getData.status).toBe("draft");
    });

    test("second submit persists status 'submitted' (one-shot)", async () => {
      const draftId = await createDraft(authToken);

      // First: silent fail
      await app.app.request(`/api/drafts/${draftId}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      // Second: real persist
      const submit2 = await app.app.request(`/api/drafts/${draftId}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(submit2.status).toBe(200);

      const getRes = await app.app.request(`/api/drafts/${draftId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const getData = await getRes.json();
      expect(getData.status).toBe("submitted");
    });
  });

  // ---------------------------------------------------------------------------
  // Non-C task — no injection
  // ---------------------------------------------------------------------------

  describe("non-C task: no fault injection", () => {
    beforeEach(async () => {
      process.env.TASK_NAME = "expense-draft-delete";
      authToken = await getToken();
    });

    test("submit sets status 'submitted' for non-C task", async () => {
      const draftId = await createDraft(authToken);

      const submitRes = await app.app.request(`/api/drafts/${draftId}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(submitRes.status).toBe(200);

      const getRes = await app.app.request(`/api/drafts/${draftId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const getData = await getRes.json();
      expect(getData.status).toBe("submitted");
    });
  });
});
