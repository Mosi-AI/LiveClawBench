import { z } from "zod";
import { ErrorResponseSchema } from "mock-lib";

export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  created_at: z.string(),
});

export const AttachmentSchema = z.object({
  id: z.number(),
  original_filename: z.string(),
  file_size: z.number(),
  mime_type: z.string(),
  created_at: z.string(),
});

export const EmailSchema = z.object({
  id: z.number(),
  sender_id: z.number(),
  sender_email: z.string(),
  sender_name: z.string(),
  recipient_id: z.number().nullable(),
  recipient_email: z.string(),
  recipient_name: z.string(),
  subject: z.string(),
  body: z.string(),
  folder: z.string(),
  is_read: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  attachments: z.array(AttachmentSchema),
});

export const AuthRegisterBodySchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

export const AuthLoginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const AuthRegisterResponseSchema = z.object({
  message: z.string(),
  user: UserSchema,
  access_token: z.string(),
});

export const AuthLoginResponseSchema = z.object({
  message: z.string(),
  user: UserSchema,
  access_token: z.string(),
});

export const AuthMeResponseSchema = z.object({
  user: UserSchema,
});

export const FolderQuerySchema = z.object({
  folder: z.enum(["inbox", "sent", "drafts", "trash"]).optional(),
});

export const EmailListResponseSchema = z.object({
  emails: z.array(EmailSchema),
  count: z.number(),
});

export const EmailDetailResponseSchema = z.object({
  email: EmailSchema,
});

export const CreateEmailBodySchema = z.object({
  recipient: z.string().email(),
  subject: z.string(),
  body: z.string(),
  send_now: z.boolean().optional(),
  attachment_ids: z.array(z.number()).optional(),
});

export const UpdateEmailBodySchema = z.object({
  recipient: z.string().email().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  attachment_ids: z.array(z.number()).optional(),
});

export const ReadEmailBodySchema = z.object({
  is_read: z.boolean(),
});

export const CreateEmailResponseSchema = z.object({
  message: z.string(),
  email: EmailSchema,
});

export const UpdateEmailResponseSchema = z.object({
  message: z.string(),
  email: EmailSchema,
});

export const DeleteEmailResponseSchema = z.object({
  message: z.string(),
  email: EmailSchema.optional(),
});

export const ReadStatusResponseSchema = z.object({
  message: z.string(),
  email: EmailSchema,
});

export const SendEmailResponseSchema = z.object({
  message: z.string(),
  email: EmailSchema,
});

export const AttachmentUploadResponseSchema = z.object({
  message: z.string(),
  attachments: z.array(AttachmentSchema),
});

export const AttachmentDeleteResponseSchema = z.object({
  message: z.string(),
});

export const UserSearchResponseSchema = z.object({
  users: z.array(UserSchema),
});

export const IdParamSchema = z.object({
  id: z.string().regex(/^\d+$/),
});

export { ErrorResponseSchema };
