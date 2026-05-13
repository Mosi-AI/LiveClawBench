import { describe, expect, test, beforeEach } from "bun:test";
import { _resetSecret, resetDb } from "mock-lib";
import { createInsuranceApp } from "../src/index";
import { getInsuranceDb } from "../src/db";
import {
  DEFAULT_USER_EMAIL,
  DEFAULT_USER_PASSWORD,
} from "../src/seed";

describe("plans routes", () => {
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

  test("GET /api/policies/current returns active policy with plan details", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/api/policies/current", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("active");
    expect(body.plan).toBeDefined();
    expect(body.plan.code).toBe("A");
    expect(body.plan.name).toBe("Budget HDHP");
  });

  test("GET /api/plans returns exactly 3 plans", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/api/plans", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plans).toBeDefined();
    expect(body.plans.length).toBe(3);
    const codes = body.plans.map((p: any) => p.code).sort();
    expect(codes).toEqual(["A", "B", "C"]);
  });

  test("GET /api/plans/:id returns plan with benefits", async () => {
    const { app, token } = await createAppWithToken();
    const listRes = await app.request("/api/plans", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { plans } = await listRes.json();
    const planId = plans.find((p: any) => p.code === "B").id;

    const res = await app.request(`/api/plans/${planId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(planId);
    expect(body.benefits).toBeDefined();
    expect(body.benefits.length).toBe(6);
  });

  test("GET /api/plans/:id returns 404 for non-existent plan", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/api/plans/9999", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  test("POST /api/plans/:id/select creates plan_selection with snapshot", async () => {
    const { app, token } = await createAppWithToken();
    const listRes = await app.request("/api/plans", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { plans } = await listRes.json();
    const planId = plans.find((p: any) => p.code === "B").id;

    const res = await app.request(`/api/plans/${planId}/select`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.plan_id).toBe(planId);
    expect(body.plan_code_snapshot).toBe("B");
    expect(body.plan_name_snapshot).toBe("Balanced Silver");
    expect(body.deductible_snapshot).toBeDefined();
    expect(body.premium_snapshot).toBeDefined();
    expect(body.year).toBe(2027);
  });

  test("POST /api/plans/:id/select returns 404 for non-existent plan", async () => {
    const { app, token } = await createAppWithToken();
    const res = await app.request("/api/plans/9999/select", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Plan not found");
  });

  test("plan snapshot is immutable after source plan mutation", async () => {
    const { app, token } = await createAppWithToken();
    const listRes = await app.request("/api/plans", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { plans } = await listRes.json();
    const planId = plans.find((p: any) => p.code === "B").id;

    // Select the plan (creates plan_selection with frozen snapshot)
    await app.request(`/api/plans/${planId}/select`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    // Read the snapshot values from the DB
    const db = getInsuranceDb();
    const snapshotBefore = db
      .query<
        {
          plan_code_snapshot: string;
          plan_name_snapshot: string;
          deductible_snapshot: number;
          premium_snapshot: number;
        },
        []
      >(
        "SELECT plan_code_snapshot, plan_name_snapshot, deductible_snapshot, premium_snapshot FROM plan_selection ORDER BY id DESC LIMIT 1",
      )
      .get()!;

    expect(snapshotBefore.plan_code_snapshot).toBe("B");
    expect(snapshotBefore.plan_name_snapshot).toBe("Balanced Silver");

    // Mutate the source insurance_plan row directly
    db.query(
      "UPDATE insurance_plan SET deductible = 999999, name = 'Hacked Plan' WHERE id = ?",
    ).run(planId);

    // Verify the plan_selection snapshot was NOT affected
    const snapshotAfter = db
      .query<
        {
          plan_code_snapshot: string;
          plan_name_snapshot: string;
          deductible_snapshot: number;
          premium_snapshot: number;
        },
        []
      >(
        "SELECT plan_code_snapshot, plan_name_snapshot, deductible_snapshot, premium_snapshot FROM plan_selection ORDER BY id DESC LIMIT 1",
      )
      .get()!;

    expect(snapshotAfter.plan_code_snapshot).toBe("B");
    expect(snapshotAfter.plan_name_snapshot).toBe("Balanced Silver");
    expect(snapshotAfter.deductible_snapshot).toBe(snapshotBefore.deductible_snapshot);
    expect(snapshotAfter.premium_snapshot).toBe(snapshotBefore.premium_snapshot);

    // Also verify the source plan WAS actually mutated
    const mutatedPlan = db
      .query<{ name: string; deductible: number }, [number]>(
        "SELECT name, deductible FROM insurance_plan WHERE id = ?",
      )
      .get(planId)!;
    expect(mutatedPlan.name).toBe("Hacked Plan");
    expect(mutatedPlan.deductible).toBe(999999);
  });
});
