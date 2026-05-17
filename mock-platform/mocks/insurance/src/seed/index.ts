import type { Database } from "bun:sqlite";
import bcryptjs from "bcryptjs";
import { BCRYPT_SALT_ROUNDS } from "mock-lib";
import { initSchema } from "../db/schema";
import {
  DEFAULT_USER_EMAIL,
  DEFAULT_USER_PASSWORD,
  PLAN_EFFECTIVE_YEAR,
  SERVICE_TEMPLATES,
  PROVIDERS,
  PLANS,
  CLAIMS,
  ACTIVE_POLICY_PLAN_CODE,
} from "./data";
import { generateSlotsForService } from "./slots";

export {
  DEFAULT_USER_EMAIL,
  DEFAULT_USER_PASSWORD,
  PLAN_EFFECTIVE_YEAR,
} from "./data";

function lastInsertId(db: Database): number {
  const row = db
    .query<{ id: number }, []>("SELECT last_insert_rowid() AS id")
    .get();
  return Number(row?.id ?? 0);
}

/**
 * Seeds the insurance database with a deterministic baseline:
 *   - 1 user (peter.griffin@work.mosi.inc, password "password123" — bcryptjs hashed)
 *   - 12 providers, each offering 3-6 services across the 6 check_item categories
 *   - 3-5 appointment_slot rows per provider_service over the next 14 days
 *   - 3 insurance_plans (A/B/C, effective_year 2027) each with 6 plan_benefit rows
 *   - 1 active current_policy on user 1 (Plan A)
 *   - 3 claims on user 1, one per status (submitted / reviewing / reimbursed)
 *
 * Idempotent: if `users` already has rows, the seed is a no-op.
 */
export function seedDatabase(db: Database): void {
  initSchema(db);

  const userCount = db
    .query<{ c: number }, []>("SELECT COUNT(*) AS c FROM users")
    .get();
  if (userCount?.c) {
    console.log("insurance: database already seeded, skipping");
    return;
  }

  const passwordHash = bcryptjs.hashSync(
    DEFAULT_USER_PASSWORD,
    BCRYPT_SALT_ROUNDS,
  );
  const baseDay = new Date();
  baseDay.setUTCHours(0, 0, 0, 0);

  const insertUser = db.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, phone)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const insertProvider = db.query(
    `INSERT INTO provider (name, district, distance_km, network_status)
     VALUES (?, ?, ?, 'in_network')`,
  );
  const insertProviderService = db.query(
    `INSERT INTO provider_service (provider_id, check_item, service_name, cost)
     VALUES (?, ?, ?, ?)`,
  );
  const insertSlot = db.query(
    `INSERT INTO appointment_slot
       (provider_service_id, start_time, end_time, is_available)
     VALUES (?, ?, ?, 1)`,
  );
  const insertPlan = db.query(
    `INSERT INTO insurance_plan
       (code, name, description, effective_year, premium_monthly, deductible)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertBenefit = db.query(
    `INSERT INTO plan_benefit
       (plan_id, benefit_category, coverage_type, coverage_value, notes)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const insertCurrentPolicy = db.query(
    `INSERT INTO current_policy (user_id, plan_id, status)
     VALUES (?, ?, 'active')`,
  );
  const insertClaim = db.query(
    `INSERT INTO claim
       (user_id, claim_type, total_amount, service_date, provider_name,
        check_item, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertLineItem = db.query(
    `INSERT INTO claim_line_item (claim_id, description, amount_cents)
     VALUES (?, ?, ?)`,
  );

  const seed = db.transaction(() => {
    insertUser.run(
      DEFAULT_USER_EMAIL,
      passwordHash,
      "Peter",
      "Griffin",
      "+1-555-0100",
    );
    const userId = lastInsertId(db);

    let serviceCounter = 0;
    for (const provider of PROVIDERS) {
      insertProvider.run(provider.name, provider.district, provider.distance_km);
      const providerId = lastInsertId(db);

      for (const checkItem of provider.offers) {
        const tmpl = SERVICE_TEMPLATES[checkItem];
        let serviceName = tmpl.service_name;
        let cost = tmpl.cost;

        // Verifier fixtures: deterministic names / costs for health-insurance-optimization
        if (provider.name === "Metro Lab Services" && checkItem === "lab") {
          serviceName = "Blood Test";
          cost = 2500;
        }
        if (
          provider.name === "Nutrition & Wellness Center" &&
          checkItem === "specialist"
        ) {
          serviceName = "Diet Consultation";
          cost = 5000;
        }

        insertProviderService.run(providerId, checkItem, serviceName, cost);
        const serviceId = lastInsertId(db);

        const slotCount = 3 + (serviceCounter % 3); // 3, 4, or 5
        for (const { start, end } of generateSlotsForService(
          serviceCounter,
          slotCount,
          baseDay,
        )) {
          insertSlot.run(serviceId, start, end);
        }
        serviceCounter += 1;
      }
    }

    const planIdsByCode = new Map<string, number>();
    for (const plan of PLANS) {
      insertPlan.run(
        plan.code,
        plan.name,
        plan.description,
        PLAN_EFFECTIVE_YEAR,
        plan.premium_monthly,
        plan.deductible,
      );
      const planId = lastInsertId(db);
      planIdsByCode.set(plan.code, planId);

      for (const benefit of plan.benefits) {
        insertBenefit.run(
          planId,
          benefit.benefit_category,
          benefit.coverage_type,
          benefit.coverage_value,
          benefit.notes,
        );
      }
    }

    const activePlanId = planIdsByCode.get(ACTIVE_POLICY_PLAN_CODE);
    if (activePlanId == null) {
      throw new Error(
        `seed: active policy plan code ${ACTIVE_POLICY_PLAN_CODE} not seeded`,
      );
    }
    insertCurrentPolicy.run(userId, activePlanId);

    for (const claim of CLAIMS) {
      insertClaim.run(
        userId,
        claim.claim_type,
        claim.total_amount,
        claim.service_date,
        claim.provider_name,
        claim.check_item,
        claim.status,
        claim.notes,
      );
      const claimId = lastInsertId(db);
      for (const item of claim.line_items) {
        insertLineItem.run(claimId, item.description, item.amount_cents);
      }
    }
  });

  seed();

  console.log("insurance: database seeded");
}
