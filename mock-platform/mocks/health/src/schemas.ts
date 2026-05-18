import { z } from "zod";

// --- Common ---

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, expected YYYY-MM-DD");

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

const PaginationResponseSchema = z.object({
  total: z.number(),
  total_pages: z.number(),
  current_page: z.number(),
  page_size: z.number(),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

// --- Health Overview ---

const MetricTypeSchema = z.enum([
  "steps",
  "active_energy_kcal",
  "sleep_hours",
  "sleep_quality",
  "light_sleep_hours",
  "deep_sleep_hours",
  "rem_sleep_hours",
  "low_intensity_min",
  "medium_intensity_min",
  "high_intensity_min",
  "total_activity_min",
  "resting_heart_rate_bpm",
  "avg_heart_rate_bpm",
  "weight_kg",
  "body_fat_percent",
  "blood_oxygen_percent",
]);

const GrainSchema = z.enum(["day", "week", "month"]);

const HealthSnapshotSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  date: z.string(),
  sleep_hours: z.number().nullable(),
  sleep_quality: z.number().nullable(),
  light_sleep_hours: z.number().nullable(),
  deep_sleep_hours: z.number().nullable(),
  rem_sleep_hours: z.number().nullable(),
  low_intensity_min: z.number().nullable(),
  medium_intensity_min: z.number().nullable(),
  high_intensity_min: z.number().nullable(),
  total_activity_min: z.number().nullable(),
  steps: z.number().nullable(),
  active_energy_kcal: z.number().nullable(),
  resting_heart_rate_bpm: z.number().nullable(),
  avg_heart_rate_bpm: z.number().nullable(),
  weight_kg: z.number().nullable(),
  body_fat_percent: z.number().nullable(),
  blood_oxygen_percent: z.number().nullable(),
  created_at: z.string(),
});

const SnapshotQuerySchema = z.object({
  date: DateStringSchema.optional(),
});

const RangeQuerySchema = z.object({
  start_date: DateStringSchema,
  end_date: DateStringSchema,
});

const MetricsQuerySchema = z.object({
  start_date: DateStringSchema,
  end_date: DateStringSchema,
  grain: GrainSchema.default("day"),
});

const MetricDataPointSchema = z.object({
  date: z.string(),
  value: z.number(),
});

const MetricsResponseSchema = z.object({
  metric_type: z.string(),
  data: z.array(MetricDataPointSchema),
});

const CategorySchema = z.object({
  name: z.string(),
  name_en: z.string(),
  icon: z.string(),
  metrics: z.array(z.string()),
});

const TrendsQuerySchema = z.object({
  metric_type: MetricTypeSchema,
  days: z.coerce.number().int().min(1).max(90).default(7),
});

const TrendsStatisticsSchema = z.object({
  mean: z.number().nullable(),
  median: z.number().nullable(),
  std_dev: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
});

const TrendsComparisonSchema = z.object({
  previous_period_mean: z.number().nullable(),
  change_percent: z.number().nullable(),
  trend: z.enum(["rising", "falling", "stable"]),
});

const TrendsResponseSchema = z.object({
  metric_type: z.string(),
  days: z.number(),
  statistics: TrendsStatisticsSchema,
  comparison: TrendsComparisonSchema,
  insight: z.string(),
});

// --- Allergens ---

const SeveritySchema = z.enum(["mild", "moderate", "severe"]);

const AllergenSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  name: z.string(),
  severity: SeveritySchema.nullable(),
  notes: z.string().nullable(),
  archived: z.number(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const AllergenListQuerySchema = PaginationQuerySchema.extend({
  archived: z.coerce.boolean().default(false),
});

const CreateAllergenBodySchema = z.object({
  name: z.string().min(1, "name is required"),
  severity: SeveritySchema.optional(),
  notes: z.string().optional(),
});

const UpdateAllergenBodySchema = z.object({
  name: z.string().min(1).optional(),
  severity: SeveritySchema.nullable().optional(),
  notes: z.string().nullable().optional(),
});

// --- Medications ---

const FrequencySchema = z.enum(["daily", "every_two_days", "weekly", "monthly", "as_needed", "other"]);
const MvpFrequencySchema = z.enum(["daily", "every_two_days", "weekly", "monthly", "as_needed", "other"]);
const LogStatusSchema = z.enum(["taken", "skipped", "pending"]);

const MedicationSlotSchema = z.object({
  id: z.number(),
  medication_id: z.number(),
  time_hhmm: z.string(),
  dose_amount: z.number(),
  dose_unit: z.string(),
  label: z.string().nullable(),
});

const MedicationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  name: z.string(),
  display_name: z.string().nullable(),
  frequency: FrequencySchema,
  dose_amount: z.number().nullable(),
  dose_unit: z.string().nullable(),
  start_date: z.string(),
  end_date: z.string().nullable(),
  notes: z.string().nullable(),
  archived: z.number(),
  archived_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  slots: z.array(MedicationSlotSchema),
});

const SlotInputSchema = z.object({
  time_hhmm: z.string().regex(/^\d{2}:\d{2}$/, "time_hhmm must be HH:MM format"),
  dose_amount: z.number().nonnegative().optional(),
  dose_unit: z.string().optional(),
  label: z.string().optional(),
});

const CreateMedicationBodySchema = z.object({
  name: z.string().min(1, "name is required"),
  display_name: z.string().optional(),
  frequency: FrequencySchema,
  dose_amount: z.number().nonnegative().optional(),
  dose_unit: z.string().min(1).optional(),
  start_date: DateStringSchema,
  end_date: DateStringSchema.optional(),
  notes: z.string().optional(),
  slots: z.array(SlotInputSchema).optional(),
});

const UpdateMedicationBodySchema = z.object({
  name: z.string().min(1).optional(),
  display_name: z.string().nullable().optional(),
  frequency: FrequencySchema.optional(),
  dose_amount: z.number().nonnegative().nullable().optional(),
  dose_unit: z.string().min(1).nullable().optional(),
  start_date: DateStringSchema.optional(),
  end_date: DateStringSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
  slots: z.array(SlotInputSchema).optional(),
});

const MedicationListQuerySchema = PaginationQuerySchema;

const TodayQuerySchema = z.object({
  date: DateStringSchema.optional(),
});

const DoseLogSchema = z.object({
  id: z.number(),
  medication_id: z.number(),
  slot_id: z.number().nullable(),
  logged_at: z.string(),
  status: LogStatusSchema,
  log_dose_amount: z.number().nullable(),
  log_dose_unit: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const CreateDoseLogBodySchema = z.object({
  slot_id: z.number().optional(),
  status: z.enum(["taken", "skipped"]),
  log_dose_amount: z.number().nonnegative().optional(),
  log_dose_unit: z.string().min(1).optional(),
  date: DateStringSchema.optional(),
});

const UpdateDoseLogBodySchema = z.object({
  status: z.enum(["taken", "skipped"]),
});

const DoseLogHistoryQuerySchema = z.object({
  start_date: DateStringSchema,
  end_date: DateStringSchema,
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(30),
});

// --- Admin ---

const BatchSnapshotsBodySchema = z.object({
  snapshots: z.array(z.object({
    snapshot_date: DateStringSchema,
    sleep_hours: z.number().nullable().optional(),
    sleep_quality: z.number().nullable().optional(),
    steps: z.number().nullable().optional(),
    active_energy_kcal: z.number().nullable().optional(),
    resting_heart_rate_bpm: z.number().nullable().optional(),
    avg_heart_rate_bpm: z.number().nullable().optional(),
    weight_kg: z.number().nullable().optional(),
    body_fat_percent: z.number().nullable().optional(),
    blood_oxygen_percent: z.number().nullable().optional(),
  })).min(1, "snapshots array must not be empty"),
});

const BatchMedicationsBodySchema = z.object({
  medications: z.array(CreateMedicationBodySchema).min(1, "medications array must not be empty"),
});

// --- Exports ---

export {
  DateStringSchema,
  PaginationQuerySchema,
  PaginationResponseSchema,
  ErrorResponseSchema,
  MetricTypeSchema,
  GrainSchema,
  HealthSnapshotSchema,
  SnapshotQuerySchema,
  RangeQuerySchema,
  MetricsQuerySchema,
  MetricDataPointSchema,
  MetricsResponseSchema,
  CategorySchema,
  TrendsQuerySchema,
  TrendsStatisticsSchema,
  TrendsComparisonSchema,
  TrendsResponseSchema,
  SeveritySchema,
  AllergenSchema,
  AllergenListQuerySchema,
  CreateAllergenBodySchema,
  UpdateAllergenBodySchema,
  FrequencySchema,
  MvpFrequencySchema,
  LogStatusSchema,
  MedicationSlotSchema,
  MedicationSchema,
  SlotInputSchema,
  CreateMedicationBodySchema,
  UpdateMedicationBodySchema,
  MedicationListQuerySchema,
  TodayQuerySchema,
  DoseLogSchema,
  CreateDoseLogBodySchema,
  UpdateDoseLogBodySchema,
  DoseLogHistoryQuerySchema,
  BatchSnapshotsBodySchema,
  BatchMedicationsBodySchema,
};
