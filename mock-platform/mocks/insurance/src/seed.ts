import type { Database } from "bun:sqlite";
import bcryptjs from "bcryptjs";
import { BCRYPT_SALT_ROUNDS } from "mock-lib";
import { initSchema } from "./db/schema";

export const DEFAULT_USER_EMAIL = "peter.griffin@work.mosi.inc";
export const DEFAULT_USER_PASSWORD = "password123";
export const PLAN_EFFECTIVE_YEAR = 2027;

type CheckItem =
  | "general_checkup"
  | "dental"
  | "vision"
  | "lab"
  | "imaging"
  | "specialist";

type BenefitCategory =
  | "preventative"
  | "specialist"
  | "other_services"
  | "drug"
  | "emergency"
  | "hospitalization";

type CoverageType =
  | "percentage_after_deductible"
  | "flat_copay"
  | "full_coverage";

type ClaimStatus = "submitted" | "reviewing" | "reimbursed";
type PlanCode = "A" | "B" | "C";

interface ServiceTemplate {
  service_name: string;
  cost: number;
}

const SERVICE_TEMPLATES: Record<CheckItem, ServiceTemplate> = {
  general_checkup: { service_name: "Annual Physical Exam", cost: 15000 },
  dental: { service_name: "Routine Cleaning", cost: 12000 },
  vision: { service_name: "Comprehensive Eye Exam", cost: 9500 },
  lab: { service_name: "Standard Blood Panel", cost: 8000 },
  imaging: { service_name: "Diagnostic X-Ray", cost: 22000 },
  specialist: { service_name: "Specialist Consult", cost: 25000 },
};

interface ProviderSeed {
  name: string;
  district: string;
  distance_km: number;
  offers: ReadonlyArray<CheckItem>;
}

const PROVIDERS: ReadonlyArray<ProviderSeed> = [
  {
    name: "Metro Lab Services",
    district: "Central",
    distance_km: 1.2,
    offers: ["lab"],
  },
  {
    name: "Nutrition & Wellness Center",
    district: "Central",
    distance_km: 1.8,
    offers: ["specialist"],
  },
  {
    name: "Central Family Clinic",
    district: "Central",
    distance_km: 0.8,
    offers: ["general_checkup", "dental", "vision", "lab"],
  },
  {
    name: "Riverside Medical Center",
    district: "Riverside",
    distance_km: 2.4,
    offers: [
      "general_checkup",
      "dental",
      "vision",
      "lab",
      "imaging",
      "specialist",
    ],
  },
  {
    name: "Northgate Health",
    district: "North",
    distance_km: 3.1,
    offers: ["general_checkup", "dental", "lab", "imaging"],
  },
  {
    name: "Eastside Dental & Vision",
    district: "East",
    distance_km: 4.0,
    offers: ["general_checkup", "dental", "vision", "lab"],
  },
  {
    name: "Southside Diagnostics",
    district: "South",
    distance_km: 5.2,
    offers: ["general_checkup", "lab", "imaging", "specialist"],
  },
  {
    name: "Westview General Hospital",
    district: "West",
    distance_km: 6.5,
    offers: [
      "general_checkup",
      "dental",
      "vision",
      "lab",
      "imaging",
      "specialist",
    ],
  },
  {
    name: "Hillcrest Specialty Clinic",
    district: "Hillcrest",
    distance_km: 7.3,
    offers: ["general_checkup", "dental", "vision", "specialist"],
  },
  {
    name: "Lakeside Imaging Lab",
    district: "Lakeside",
    distance_km: 8.0,
    offers: ["general_checkup", "vision", "lab", "imaging"],
  },
  {
    name: "Bayview Wellness Center",
    district: "Bayview",
    distance_km: 9.4,
    offers: ["general_checkup", "dental", "vision", "lab", "specialist"],
  },
  {
    name: "Parkside Urgent Care",
    district: "Parkside",
    distance_km: 10.2,
    offers: ["general_checkup", "dental", "vision", "lab"],
  },
  {
    name: "Greenfield Family Practice",
    district: "Greenfield",
    distance_km: 11.5,
    offers: ["general_checkup", "dental", "vision", "lab", "imaging"],
  },
  {
    name: "Highland Specialist Group",
    district: "Highland",
    distance_km: 12.8,
    offers: ["general_checkup", "dental", "vision", "lab", "specialist"],
  },
];

interface BenefitSeed {
  benefit_category: BenefitCategory;
  coverage_type: CoverageType;
  coverage_value: number | null;
  notes: string;
}

interface PlanSeed {
  code: PlanCode;
  name: string;
  description: string;
  premium_monthly: number;
  deductible: number;
  benefits: ReadonlyArray<BenefitSeed>;
}

const PLANS: ReadonlyArray<PlanSeed> = [
  {
    code: "A",
    name: "Budget HDHP",
    description:
      "High-deductible plan for healthy individuals seeking the lowest monthly premium.",
    premium_monthly: 18000,
    deductible: 600000,
    benefits: [
      {
        benefit_category: "preventative",
        coverage_type: "full_coverage",
        coverage_value: null,
        notes: "Annual physicals and screenings covered in full.",
      },
      {
        benefit_category: "specialist",
        coverage_type: "percentage_after_deductible",
        coverage_value: 70,
        notes: "70% coverage once the deductible is met.",
      },
      {
        benefit_category: "other_services",
        coverage_type: "percentage_after_deductible",
        coverage_value: 60,
        notes: "Diagnostics, imaging, and lab work after deductible.",
      },
      {
        benefit_category: "drug",
        coverage_type: "percentage_after_deductible",
        coverage_value: 60,
        notes: "Generic and brand-name prescriptions after deductible.",
      },
      {
        benefit_category: "emergency",
        coverage_type: "percentage_after_deductible",
        coverage_value: 70,
        notes: "ER visits after deductible.",
      },
      {
        benefit_category: "hospitalization",
        coverage_type: "percentage_after_deductible",
        coverage_value: 70,
        notes: "Inpatient stays after deductible.",
      },
    ],
  },
  {
    code: "B",
    name: "Balanced Silver",
    description:
      "Balanced coverage with moderate premiums and deductibles, suitable for typical families.",
    premium_monthly: 32000,
    deductible: 250000,
    benefits: [
      {
        benefit_category: "preventative",
        coverage_type: "full_coverage",
        coverage_value: null,
        notes: "Preventative care covered in full.",
      },
      {
        benefit_category: "specialist",
        coverage_type: "flat_copay",
        coverage_value: 5000,
        notes: "$50 copay per specialist visit.",
      },
      {
        benefit_category: "other_services",
        coverage_type: "percentage_after_deductible",
        coverage_value: 80,
        notes: "80% coverage after deductible.",
      },
      {
        benefit_category: "drug",
        coverage_type: "flat_copay",
        coverage_value: 2500,
        notes: "$25 generic / $50 brand-name copay.",
      },
      {
        benefit_category: "emergency",
        coverage_type: "percentage_after_deductible",
        coverage_value: 85,
        notes: "85% coverage after deductible.",
      },
      {
        benefit_category: "hospitalization",
        coverage_type: "percentage_after_deductible",
        coverage_value: 85,
        notes: "85% coverage after deductible.",
      },
    ],
  },
  {
    code: "C",
    name: "Premier Gold",
    description:
      "Comprehensive coverage with a low deductible and a broad provider network.",
    premium_monthly: 52000,
    deductible: 100000,
    benefits: [
      {
        benefit_category: "preventative",
        coverage_type: "full_coverage",
        coverage_value: null,
        notes: "Preventative care covered in full.",
      },
      {
        benefit_category: "specialist",
        coverage_type: "flat_copay",
        coverage_value: 2500,
        notes: "$25 copay per specialist visit.",
      },
      {
        benefit_category: "other_services",
        coverage_type: "percentage_after_deductible",
        coverage_value: 90,
        notes: "90% coverage after deductible.",
      },
      {
        benefit_category: "drug",
        coverage_type: "flat_copay",
        coverage_value: 1500,
        notes: "$15 generic / $30 brand-name copay.",
      },
      {
        benefit_category: "emergency",
        coverage_type: "full_coverage",
        coverage_value: null,
        notes: "ER visits covered in full.",
      },
      {
        benefit_category: "hospitalization",
        coverage_type: "full_coverage",
        coverage_value: null,
        notes: "Inpatient stays covered in full.",
      },
    ],
  },
];

const ACTIVE_POLICY_PLAN_CODE: PlanCode = "A";

interface ClaimSeed {
  claim_type: string;
  total_amount: number;
  service_date: string;
  provider_name: string;
  check_item: CheckItem;
  status: ClaimStatus;
  notes: string;
  line_items: ReadonlyArray<{ description: string; amount_cents: number }>;
}

const CLAIMS: ReadonlyArray<ClaimSeed> = [
  {
    claim_type: "medical",
    total_amount: 15000,
    service_date: "2026-04-12",
    provider_name: "Central Family Clinic",
    check_item: "general_checkup",
    status: "submitted",
    notes: "Annual physical for fiscal year.",
    line_items: [{ description: "Office visit", amount_cents: 15000 }],
  },
  {
    claim_type: "dental",
    total_amount: 12500,
    service_date: "2026-03-22",
    provider_name: "Eastside Dental & Vision",
    check_item: "dental",
    status: "reviewing",
    notes: "Routine cleaning, no follow-up required.",
    line_items: [
      { description: "Dental cleaning", amount_cents: 10000 },
      { description: "Fluoride treatment", amount_cents: 2500 },
    ],
  },
  {
    claim_type: "vision",
    total_amount: 9500,
    service_date: "2026-02-08",
    provider_name: "Eastside Dental & Vision",
    check_item: "vision",
    status: "reimbursed",
    notes: "Eye exam reimbursed in full.",
    line_items: [{ description: "Comprehensive eye exam", amount_cents: 9500 }],
  },
];

const SLOT_TIMES_OF_DAY = [9, 10, 11, 13, 14, 15] as const;

function generateSlotsForService(
  serviceIndex: number,
  count: number,
  baseDay: Date,
): Array<{ start: string; end: string }> {
  const slots: Array<{ start: string; end: string }> = [];
  for (let i = 0; i < count; i++) {
    // Deterministic spread across days 1..14 ahead, hours from SLOT_TIMES_OF_DAY.
    const dayOffset = ((serviceIndex * 3 + i * 4) % 14) + 1;
    const hour =
      SLOT_TIMES_OF_DAY[(serviceIndex + i) % SLOT_TIMES_OF_DAY.length];
    const slotStart = new Date(baseDay);
    slotStart.setUTCDate(slotStart.getUTCDate() + dayOffset);
    slotStart.setUTCHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
    slots.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
    });
  }
  return slots;
}

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

    const planIdsByCode = new Map<PlanCode, number>();
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
