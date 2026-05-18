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

export type ClaimStatus = "submitted" | "reviewing" | "reimbursed";
export type PlanCode = "A" | "B" | "C";

interface ServiceTemplate {
  service_name: string;
  cost: number;
}

export const SERVICE_TEMPLATES: Record<CheckItem, ServiceTemplate> = {
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

export const PROVIDERS: ReadonlyArray<ProviderSeed> = [
  { name: "Metro Lab Services", district: "Central", distance_km: 1.2, offers: ["lab"] },
  { name: "Nutrition & Wellness Center", district: "Central", distance_km: 1.8, offers: ["specialist"] },
  { name: "Central Family Clinic", district: "Central", distance_km: 0.8, offers: ["general_checkup", "dental", "vision", "lab"] },
  { name: "Riverside Medical Center", district: "Riverside", distance_km: 2.4, offers: ["general_checkup", "dental", "vision", "lab", "imaging", "specialist"] },
  { name: "Northgate Health", district: "North", distance_km: 3.1, offers: ["general_checkup", "dental", "lab", "imaging"] },
  { name: "Eastside Dental & Vision", district: "East", distance_km: 4.0, offers: ["general_checkup", "dental", "vision", "lab"] },
  { name: "Southside Diagnostics", district: "South", distance_km: 5.2, offers: ["general_checkup", "lab", "imaging", "specialist"] },
  { name: "Westview General Hospital", district: "West", distance_km: 6.5, offers: ["general_checkup", "dental", "vision", "lab", "imaging", "specialist"] },
  { name: "Hillcrest Specialty Clinic", district: "Hillcrest", distance_km: 7.3, offers: ["general_checkup", "dental", "vision", "specialist"] },
  { name: "Lakeside Imaging Lab", district: "Lakeside", distance_km: 8.0, offers: ["general_checkup", "vision", "lab", "imaging"] },
  { name: "Bayview Wellness Center", district: "Bayview", distance_km: 9.4, offers: ["general_checkup", "dental", "vision", "lab", "specialist"] },
  { name: "Parkside Urgent Care", district: "Parkside", distance_km: 10.2, offers: ["general_checkup", "dental", "vision", "lab"] },
  { name: "Greenfield Family Practice", district: "Greenfield", distance_km: 11.5, offers: ["general_checkup", "dental", "vision", "lab", "imaging"] },
  { name: "Highland Specialist Group", district: "Highland", distance_km: 12.8, offers: ["general_checkup", "dental", "vision", "lab", "specialist"] },
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

export const PLANS: ReadonlyArray<PlanSeed> = [
  {
    code: "A",
    name: "Budget HDHP",
    description: "High-deductible plan for healthy individuals seeking the lowest monthly premium.",
    premium_monthly: 18000,
    deductible: 600000,
    benefits: [
      { benefit_category: "preventative", coverage_type: "full_coverage", coverage_value: null, notes: "Annual physicals and screenings covered in full." },
      { benefit_category: "specialist", coverage_type: "percentage_after_deductible", coverage_value: 70, notes: "70% coverage once the deductible is met." },
      { benefit_category: "other_services", coverage_type: "percentage_after_deductible", coverage_value: 60, notes: "Diagnostics, imaging, and lab work after deductible." },
      { benefit_category: "drug", coverage_type: "percentage_after_deductible", coverage_value: 60, notes: "Generic and brand-name prescriptions after deductible." },
      { benefit_category: "emergency", coverage_type: "percentage_after_deductible", coverage_value: 70, notes: "ER visits after deductible." },
      { benefit_category: "hospitalization", coverage_type: "percentage_after_deductible", coverage_value: 70, notes: "Inpatient stays after deductible." },
    ],
  },
  {
    code: "B",
    name: "Balanced Silver",
    description: "Balanced coverage with moderate premiums and deductibles, suitable for typical families.",
    premium_monthly: 32000,
    deductible: 250000,
    benefits: [
      { benefit_category: "preventative", coverage_type: "full_coverage", coverage_value: null, notes: "Preventative care covered in full." },
      { benefit_category: "specialist", coverage_type: "flat_copay", coverage_value: 5000, notes: "$50 copay per specialist visit." },
      { benefit_category: "other_services", coverage_type: "percentage_after_deductible", coverage_value: 80, notes: "80% coverage after deductible." },
      { benefit_category: "drug", coverage_type: "flat_copay", coverage_value: 2500, notes: "$25 generic / $50 brand-name copay." },
      { benefit_category: "emergency", coverage_type: "percentage_after_deductible", coverage_value: 85, notes: "85% coverage after deductible." },
      { benefit_category: "hospitalization", coverage_type: "percentage_after_deductible", coverage_value: 85, notes: "85% coverage after deductible." },
    ],
  },
  {
    code: "C",
    name: "Premier Gold",
    description: "Comprehensive coverage with a low deductible and a broad provider network.",
    premium_monthly: 52000,
    deductible: 100000,
    benefits: [
      { benefit_category: "preventative", coverage_type: "full_coverage", coverage_value: null, notes: "Preventative care covered in full." },
      { benefit_category: "specialist", coverage_type: "flat_copay", coverage_value: 2500, notes: "$25 copay per specialist visit." },
      { benefit_category: "other_services", coverage_type: "percentage_after_deductible", coverage_value: 90, notes: "90% coverage after deductible." },
      { benefit_category: "drug", coverage_type: "flat_copay", coverage_value: 1500, notes: "$15 generic / $30 brand-name copay." },
      { benefit_category: "emergency", coverage_type: "full_coverage", coverage_value: null, notes: "ER visits covered in full." },
      { benefit_category: "hospitalization", coverage_type: "full_coverage", coverage_value: null, notes: "Inpatient stays covered in full." },
    ],
  },
];

export const ACTIVE_POLICY_PLAN_CODE: PlanCode = "A";

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

export const CLAIMS: ReadonlyArray<ClaimSeed> = [
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
