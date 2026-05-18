import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { initSchema, resetInsuranceDb } from "../src/db";

const REQUIRED_TABLES = [
  "appointment",
  "appointment_slot",
  "claim",
  "claim_attachment",
  "claim_line_item",
  "current_policy",
  "insurance_plan",
  "plan_benefit",
  "plan_selection",
  "provider",
  "provider_service",
  "users",
] as const;

function listTables(db: Database): string[] {
  return db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map((row) => row.name);
}

describe("insurance schema", () => {
  test("creates all 12 required tables", () => {
    const db = new Database(":memory:");
    initSchema(db);
    const tables = listTables(db);
    for (const required of REQUIRED_TABLES) {
      expect(tables).toContain(required);
    }
    expect(tables.length).toBe(REQUIRED_TABLES.length);
    db.close();
  });

  test("foreign keys are enabled", () => {
    const db = new Database(":memory:");
    initSchema(db);
    const fk = db
      .query<{ foreign_keys: number }, []>("PRAGMA foreign_keys")
      .get();
    expect(fk?.foreign_keys).toBe(1);
    db.close();
  });

  test("partial unique index on current_policy enforces one active policy per user", () => {
    const db = new Database(":memory:");
    initSchema(db);

    const indexRow = db
      .query<{ sql: string }, []>(
        "SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_current_policy_active'",
      )
      .get();
    expect(indexRow).not.toBeNull();
    expect(indexRow!.sql).toContain("WHERE status = 'active'");

    db.run(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ('a@b.com', 'h', 'A', 'B')`,
    );
    db.run(
      `INSERT INTO insurance_plan (code, name, effective_year, premium_monthly, deductible)
       VALUES ('A', 'Budget', 2026, 10000, 500000)`,
    );
    db.run(
      `INSERT INTO current_policy (user_id, plan_id, status) VALUES (1, 1, 'active')`,
    );

    expect(() =>
      db.run(
        `INSERT INTO current_policy (user_id, plan_id, status) VALUES (1, 1, 'active')`,
      ),
    ).toThrow();

    db.run(
      `INSERT INTO current_policy (user_id, plan_id, status) VALUES (1, 1, 'cancelled')`,
    );

    db.close();
  });

  test("ON DELETE CASCADE removes claim_line_item and claim_attachment when claim is deleted", () => {
    const db = new Database(":memory:");
    initSchema(db);

    db.run(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ('c@d.com', 'h', 'C', 'D')`,
    );
    db.run(
      `INSERT INTO claim (user_id, claim_type, total_amount, service_date, provider_name, check_item)
       VALUES (1, 'medical', 12345, '2026-05-01', 'ACME Clinic', 'general_checkup')`,
    );
    db.run(
      `INSERT INTO claim_line_item (claim_id, description, amount_cents)
       VALUES (1, 'Office visit', 12345)`,
    );
    db.run(
      `INSERT INTO claim_attachment (claim_id, filename, file_path)
       VALUES (1, 'receipt.pdf', '/tmp/r.pdf')`,
    );

    db.run(`DELETE FROM claim WHERE id = 1`);

    const lineItems = db
      .query<{ c: number }, []>("SELECT COUNT(*) AS c FROM claim_line_item")
      .get();
    const attachments = db
      .query<{ c: number }, []>("SELECT COUNT(*) AS c FROM claim_attachment")
      .get();
    expect(lineItems?.c).toBe(0);
    expect(attachments?.c).toBe(0);

    db.close();
  });

  test("ON DELETE RESTRICT blocks deleting a user that has appointments or plan selections", () => {
    const db = new Database(":memory:");
    initSchema(db);

    db.run(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ('e@f.com', 'h', 'E', 'F')`,
    );
    db.run(
      `INSERT INTO provider (name, district, distance_km) VALUES ('Clinic', 'Central', 1.0)`,
    );
    db.run(
      `INSERT INTO provider_service (provider_id, check_item, service_name, cost)
       VALUES (1, 'general_checkup', 'Annual Physical', 15000)`,
    );
    db.run(
      `INSERT INTO appointment_slot (provider_service_id, start_time, end_time)
       VALUES (1, '2026-05-10T09:00:00Z', '2026-05-10T09:30:00Z')`,
    );
    db.run(
      `INSERT INTO appointment
        (user_id, provider_id, slot_id, provider_name, service_name_snapshot,
         check_item, slot_start_time, slot_end_time, cost_snapshot, distance_km_snapshot)
       VALUES (1, 1, 1, 'Clinic', 'Annual Physical', 'general_checkup',
         '2026-05-10T09:00:00Z', '2026-05-10T09:30:00Z', 15000, 1.0)`,
    );

    expect(() => db.run(`DELETE FROM users WHERE id = 1`)).toThrow();

    db.close();
  });

  test("resetInsuranceDb drops and recreates all tables idempotently", () => {
    const db = new Database(":memory:");
    initSchema(db);

    db.run(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ('g@h.com', 'h', 'G', 'H')`,
    );
    expect(
      db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM users").get()?.c,
    ).toBe(1);

    resetInsuranceDb(db);

    const tables = listTables(db);
    for (const required of REQUIRED_TABLES) {
      expect(tables).toContain(required);
    }
    expect(
      db.query<{ c: number }, []>("SELECT COUNT(*) AS c FROM users").get()?.c,
    ).toBe(0);

    resetInsuranceDb(db);
    expect(listTables(db).length).toBe(REQUIRED_TABLES.length);

    db.close();
  });

  test("recommended indexes exist", () => {
    const db = new Database(":memory:");
    initSchema(db);
    const indexNames = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name",
      )
      .all()
      .map((r) => r.name);

    const expected = [
      "idx_appointment_slot",
      "idx_appointment_slot_service",
      "idx_appointment_user",
      "idx_claim_attachment_claim",
      "idx_claim_line_item_claim",
      "idx_claim_user",
      "idx_current_policy_active",
      "idx_current_policy_user",
      "idx_plan_benefit_plan",
      "idx_plan_selection_user",
      "idx_provider_service_provider",
      "idx_users_email",
    ];
    for (const name of expected) {
      expect(indexNames).toContain(name);
    }
    db.close();
  });
});
