import { z } from "zod";

// Enums
export const DraftStatusSchema = z.enum(["draft", "submitted", "approved", "rejected", "reimbursed"]);
export const CurrencySchema = z.enum(["USD", "CNY", "EUR", "GBP", "JPY"]);
export const CategorySchema = z.enum(["travel", "meals", "office_supplies", "software", "lodging", "transport", "other"]);
export const SourceTypeSchema = z.enum(["manual", "email", "imported"]);
export const MimeTypeSchema = z.enum(["application/pdf", "image/png", "image/jpeg", "text/plain", "text/html", "text/csv"]);
export const ActionTypeSchema = z.enum(["created", "edited", "attachment_added", "submitted", "status_changed"]);
export const UserRoleSchema = z.enum(["employee", "manager", "admin"]);
export const SortOptionSchema = z.enum(["newest", "oldest", "amount_desc", "amount_asc"]);
export const GroupBySchema = z.enum(["day", "week", "month"]);

// Auth
export const TokenRequestSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const TokenResponseSchema = z.object({ token: z.string(), expires_in: z.number() });

// User
export const UserSchema = z.object({
  id: z.number(), full_name: z.string(), email: z.string(), department: z.string(),
  role: UserRoleSchema, preferred_currency: CurrencySchema, avatar_url: z.string().nullable(),
  is_active: z.number(), created_at: z.string(), last_login_at: z.string().nullable(),
});

// Draft
export const DraftSchema = z.object({
  id: z.number(), draft_code: z.string(), user_id: z.number(), vendor_name: z.string(),
  category: CategorySchema.nullable(), amount: z.number(), currency: CurrencySchema,
  invoice_date: z.string(), expense_date: z.string().nullable(), notes: z.string().nullable(),
  source_type: SourceTypeSchema, status: DraftStatusSchema, attachment_ref: z.string().nullable(),
  created_at: z.string(), updated_at: z.string(), submitted_at: z.string().nullable(),
});

export const ListDraftsQuerySchema = z.object({
  status: DraftStatusSchema.optional(),
  q: z.string().max(255).optional(),
  sort: SortOptionSchema.optional().default("newest"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const ListDraftsResponseSchema = z.object({
  drafts: z.array(DraftSchema), total: z.number(), page: z.number(), total_pages: z.number(),
});

export const CreateDraftBodySchema = z.object({
  vendor_name: z.string().min(1).max(255),
  category: CategorySchema.optional(),
  amount: z.number().positive(),
  currency: CurrencySchema.optional().default("USD"),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(2000).optional(),
  source_type: SourceTypeSchema.optional().default("manual"),
});

export const UpdateDraftBodySchema = z.object({
  vendor_name: z.string().min(1).max(255).optional(),
  category: CategorySchema.nullable().optional(),
  amount: z.number().positive().optional(),
  currency: CurrencySchema.optional(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });

export const SubmitDraftResponseSchema = z.object({
  success: z.boolean(), draft: DraftSchema, message: z.string(),
});

// Attachment
export const AttachmentSchema = z.object({
  id: z.number(), draft_id: z.number(), attachment_ref: z.string(),
  original_filename: z.string(), mime_type: MimeTypeSchema, file_size_bytes: z.number(),
  page_count: z.number().nullable(), preview_text: z.string().nullable(),
  extracted_vendor_name: z.string().nullable(), extracted_amount: z.number().nullable(),
  extracted_currency: CurrencySchema.nullable(), extracted_invoice_date: z.string().nullable(),
  created_at: z.string(),
});

export const AttachmentUploadResponseSchema = z.object({
  success: z.boolean(), attachment: AttachmentSchema,
});

// Activity
export const ActivitySchema = z.object({
  id: z.number(), draft_id: z.number(), actor_user_id: z.number().nullable(),
  actor_name: z.string().nullable(), action_type: ActionTypeSchema,
  field_name: z.string().nullable(), old_value: z.string().nullable(),
  new_value: z.string().nullable(), created_at: z.string(),
});

export const ListActivitiesResponseSchema = z.object({ activities: z.array(ActivitySchema) });

// Reports
export const SpendOverTimePointSchema = z.object({
  period: z.string(), total_amount: z.number(), count: z.number(), currency: CurrencySchema,
});
export const SpendOverTimeResponseSchema = z.object({
  data: z.array(SpendOverTimePointSchema), currency: CurrencySchema,
  total_spend: z.number(), total_expenses: z.number(),
});

export const TopCategorySchema = z.object({
  category: CategorySchema, total_amount: z.number(), count: z.number(), percentage: z.number(),
});
export const TopCategoriesResponseSchema = z.object({
  data: z.array(TopCategorySchema), currency: CurrencySchema, total_spend: z.number(),
});

export const TopMerchantSchema = z.object({
  vendor_name: z.string(), total_amount: z.number(), count: z.number(), percentage: z.number(),
});
export const TopMerchantsResponseSchema = z.object({
  data: z.array(TopMerchantSchema), currency: CurrencySchema, total_spend: z.number(),
});

// Report query schemas
export const SpendOverTimeQuerySchema = z.object({
  group_by: GroupBySchema.optional().default("month"),
  currency: CurrencySchema.optional().default("USD"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const TopCategoriesQuerySchema = z.object({
  currency: CurrencySchema.optional().default("USD"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const TopMerchantsQuerySchema = z.object({
  currency: CurrencySchema.optional().default("USD"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});
