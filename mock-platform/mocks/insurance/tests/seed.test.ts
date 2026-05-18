import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import bcryptjs from "bcryptjs";
import { initSchema } from "../src/db";
import {
  DEFAULT_USER_EMAIL,
  DEFAULT_USER_PASSWORD,
  PLAN_EFFECTIVE_YEAR,
  seedDatabase,
} from "../src/seed";

function freshSeededDb(): Database {
  const db = new Database(":memory:");
  initSchema(db);
  seedDatabase(db);
  return db;
}

function count(db: Database, table: string): number {
  return (
    db.query<{ c: number }, []>(`SELECT COUNT(*) AS c FROM ${table}`).get()?.c ??
    0
  );
}

describe("insurance seed", () => {
  test("seeds one user with the documented email and a valid bcrypt hash", () => {
    const db = freshSeededDb();
    const user = db
      .query<
        { id: number; email: string; password_hash: string },
        []
      >("SELECT id, email, password_hash FROM users")
      .get();
    expect(user).not.toBeNull();
    expect(user!.id).toBe(1);
    expect(user!.email).toBe(DEFAULT_USER_EMAIL);
    // bcryptjs hashes start with "$2a$" or "$2b$"; validate against plaintext
    expect(user!.password_hash.startsWith("$2")).toBe(true);
    expect(bcryptjs.compareSync(DEFAULT_USER_PASSWORD, user!.password_hash)).toBe(
      true,
    );
    expect(bcryptjs.compareSync("wrong-password", user!.password_hash)).toBe(
      false,
    );
    db.close();
  });

  test("seeds the documented row counts across all 12 tables", () => {
    const db = freshSeededDb();
    expect(count(db, "users")).toBe(1);
    expect(count(db, "provider")).toBe(14);
    expect(count(db, "provider_service")).toBe(57);
    expect(count(db, "insurance_plan")).toBe(3);
    expect(count(db, "plan_benefit")).toBe(18);
    expect(count(db, "current_policy")).toBe(1);
    expect(count(db, "claim")).toBe(3);
    expect(count(db, "claim_line_item")).toBe(4);
    // Tables not populated by the seed should remain empty
    expect(count(db, "appointment")).toBe(0);
    expect(count(db, "claim_attachment")).toBe(0);
    expect(count(db, "plan_selection")).toBe(0);
    db.close();
  });

  test("each provider_service has between 3 and 5 appointment slots", () => {
    const db = freshSeededDb();
    const rows = db
      .query<
        { provider_service_id: number; n: number },
        []
      >(
        `SELECT provider_service_id, COUNT(*) AS n
         FROM appointment_slot
         GROUP BY provider_service_id`,
      )
      .all();
    expect(rows.length).toBe(57);
    for (const row of rows) {
      expect(row.n).toBeGreaterThanOrEqual(3);
      expect(row.n).toBeLessThanOrEqual(5);
    }
    db.close();
  });

  test("appointment slots are 30 minutes long and have unique start times per service", () => {
    const db = freshSeededDb();
    const slots = db
      .query<
        {
          provider_service_id: number;
          start_time: string;
          end_time: string;
        },
        []
      >("SELECT provider_service_id, start_time, end_time FROM appointment_slot")
      .all();
    expect(slots.length).toBeGreaterThan(0);

    const startsByService = new Map<number, Set<string>>();
    for (const slot of slots) {
      const start = new Date(slot.start_time).getTime();
      const end = new Date(slot.end_time).getTime();
      expect(end - start).toBe(30 * 60 * 1000);
      const set =
        startsByService.get(slot.provider_service_id) ?? new Set<string>();
      set.add(slot.start_time);
      startsByService.set(slot.provider_service_id, set);
    }
    // Each service's slots must have distinct start_time values
    for (const [serviceId, starts] of startsByService) {
      const slotCount = slots.filter(
        (s) => s.provider_service_id === serviceId,
      ).length;
      expect(starts.size).toBe(slotCount);
    }
    db.close();
  });

  test("seeds exactly three insurance plans, all in effective_year=2027 with codes A/B/C", () => {
    const db = freshSeededDb();
    const plans = db
      .query<
        { code: string; effective_year: number; name: string },
        []
      >("SELECT code, effective_year, name FROM insurance_plan ORDER BY code")
      .all();
    expect(plans.map((p) => p.code)).toEqual(["A", "B", "C"]);
    for (const plan of plans) {
      expect(plan.effective_year).toBe(PLAN_EFFECTIVE_YEAR);
      expect(plan.effective_year).toBe(2027);
      expect(plan.name.length).toBeGreaterThan(0);
    }
    // Each plan should have 6 benefit rows
    for (const plan of plans) {
      const benefits = db
        .query<
          { c: number },
          [string]
        >(
          `SELECT COUNT(*) AS c FROM plan_benefit
           WHERE plan_id = (SELECT id FROM insurance_plan WHERE code = ?)`,
        )
        .get(plan.code);
      expect(benefits?.c).toBe(6);
    }
    db.close();
  });

  test("user 1 has exactly one active current_policy pointing at plan A", () => {
    const db = freshSeededDb();
    const active = db
      .query<
        { user_id: number; plan_code: string; status: string },
        []
      >(
        `SELECT cp.user_id, ip.code AS plan_code, cp.status
         FROM current_policy cp
         JOIN insurance_plan ip ON ip.id = cp.plan_id
         WHERE cp.status = 'active'`,
      )
      .all();
    expect(active.length).toBe(1);
    expect(active[0].user_id).toBe(1);
    expect(active[0].plan_code).toBe("A");
    expect(active[0].status).toBe("active");
    db.close();
  });

  test("seeds three claims for user 1 covering all three statuses with line items", () => {
    const db = freshSeededDb();
    const claims = db
      .query<
        { id: number; user_id: number; status: string },
        []
      >("SELECT id, user_id, status FROM claim ORDER BY id")
      .all();
    expect(claims.length).toBe(3);
    for (const claim of claims) {
      expect(claim.user_id).toBe(1);
    }
    const statuses = claims.map((c) => c.status).sort();
    expect(statuses).toEqual(["reimbursed", "reviewing", "submitted"]);

    // Every claim must have at least one line item
    for (const claim of claims) {
      const lineItems = db
        .query<
          { c: number },
          [number]
        >("SELECT COUNT(*) AS c FROM claim_line_item WHERE claim_id = ?")
        .get(claim.id);
      expect(lineItems?.c).toBeGreaterThanOrEqual(1);
    }
    db.close();
  });

  test("running seedDatabase a second time is a no-op (idempotent)", () => {
    const db = new Database(":memory:");
    initSchema(db);

    seedDatabase(db);
    const usersAfterFirst = count(db, "users");
    const providersAfterFirst = count(db, "provider");
    const servicesAfterFirst = count(db, "provider_service");
    const slotsAfterFirst = count(db, "appointment_slot");
    const claimsAfterFirst = count(db, "claim");

    seedDatabase(db);
    expect(count(db, "users")).toBe(usersAfterFirst);
    expect(count(db, "provider")).toBe(providersAfterFirst);
    expect(count(db, "provider_service")).toBe(servicesAfterFirst);
    expect(count(db, "appointment_slot")).toBe(slotsAfterFirst);
    expect(count(db, "claim")).toBe(claimsAfterFirst);

    db.close();
  });

  test("at least 10 distinct providers exist for the busiest check_item categories", () => {
    const db = freshSeededDb();
    const rows = db
      .query<
        { check_item: string; n: number },
        []
      >(
        `SELECT check_item, COUNT(DISTINCT provider_id) AS n
         FROM provider_service
         GROUP BY check_item`,
      )
      .all();
    const byItem = new Map(rows.map((r) => [r.check_item, r.n]));
    // Plan calls for ≥10 providers offering general_checkup, dental, vision, lab
    expect(byItem.get("general_checkup")).toBeGreaterThanOrEqual(10);
    expect(byItem.get("dental")).toBeGreaterThanOrEqual(10);
    expect(byItem.get("vision")).toBeGreaterThanOrEqual(10);
    expect(byItem.get("lab")).toBeGreaterThanOrEqual(10);
    // Specialty categories are intentionally rarer
    expect(byItem.get("imaging")).toBeGreaterThanOrEqual(5);
    expect(byItem.get("specialist")).toBeGreaterThanOrEqual(5);
    db.close();
  });

  test("verifier fixtures: Blood Test at 2500 cents and Diet Consultation at 5000 cents exist with slots", () => {
    const db = freshSeededDb();
    const bloodTest = db
      .query<{ id: number; service_name: string; cost: number; provider_id: number }, []>(
        "SELECT id, service_name, cost, provider_id FROM provider_service WHERE service_name = 'Blood Test'",
      )
      .get();
    expect(bloodTest).not.toBeNull();
    expect(bloodTest!.cost).toBe(2500);

    const dietConsult = db
      .query<{ id: number; service_name: string; cost: number; provider_id: number }, []>(
        "SELECT id, service_name, cost, provider_id FROM provider_service WHERE service_name = 'Diet Consultation'",
      )
      .get();
    expect(dietConsult).not.toBeNull();
    expect(dietConsult!.cost).toBe(5000);

    // Each fixture must have available slots
    const bloodSlots = db
      .query<{ c: number }, [number]>(
        "SELECT COUNT(*) AS c FROM appointment_slot WHERE provider_service_id = ? AND is_available = 1",
      )
      .get(bloodTest!.id);
    expect(bloodSlots!.c).toBeGreaterThanOrEqual(3);

    const dietSlots = db
      .query<{ c: number }, [number]>(
        "SELECT COUNT(*) AS c FROM appointment_slot WHERE provider_service_id = ? AND is_available = 1",
      )
      .get(dietConsult!.id);
    expect(dietSlots!.c).toBeGreaterThanOrEqual(3);

    db.close();
  });
});
