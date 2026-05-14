import type { z } from "zod";
import type {
  DraftStatusSchema, CurrencySchema, CategorySchema, SourceTypeSchema,
  MimeTypeSchema, ActionTypeSchema, UserRoleSchema,
  UserSchema, DraftSchema, AttachmentSchema, ActivitySchema,
  SpendOverTimePointSchema, TopCategorySchema, TopMerchantSchema,
} from "./schemas.js";

export type DraftStatus = z.infer<typeof DraftStatusSchema>;
export type Currency = z.infer<typeof CurrencySchema>;
export type Category = z.infer<typeof CategorySchema>;
export type SourceType = z.infer<typeof SourceTypeSchema>;
export type MimeType = z.infer<typeof MimeTypeSchema>;
export type ActionType = z.infer<typeof ActionTypeSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;

export type User = z.infer<typeof UserSchema>;
export type Draft = z.infer<typeof DraftSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type SpendOverTimePoint = z.infer<typeof SpendOverTimePointSchema>;
export type TopCategory = z.infer<typeof TopCategorySchema>;
export type TopMerchant = z.infer<typeof TopMerchantSchema>;
