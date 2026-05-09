import { z } from "zod";

// ── Common response wrappers ──────────────────────────────────────────

export function OkSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    message: z.string().optional(),
    data: dataSchema,
  });
}

export const ErrSchema = z.object({
  success: z.literal(false),
  message: z.string(),
});

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

export const AuthRegisterResponseSchema = OkSchema(z.object({
  message: z.string(),
  user: UserSchema,
  access_token: z.string(),
}));

export const AuthLoginResponseSchema = OkSchema(z.object({
  message: z.string(),
  user: UserSchema,
  access_token: z.string(),
}));

export const AuthMeResponseSchema = OkSchema(z.object({
  user: UserSchema,
}));

export const FolderQuerySchema = z.object({
  folder: z.enum(["inbox", "sent", "drafts", "trash"]).optional(),
});

export const EmailListResponseSchema = OkSchema(z.object({
  emails: z.array(EmailSchema),
  count: z.number(),
}));

export const EmailDetailResponseSchema = OkSchema(z.object({
  email: EmailSchema,
}));

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

export const CreateEmailResponseSchema = OkSchema(z.object({
  message: z.string(),
  email: EmailSchema,
}));

export const UpdateEmailResponseSchema = OkSchema(z.object({
  message: z.string(),
  email: EmailSchema,
}));

export const DeleteEmailResponseSchema = OkSchema(z.object({
  message: z.string(),
  email: EmailSchema.optional(),
}));

export const ReadStatusResponseSchema = OkSchema(z.object({
  message: z.string(),
  email: EmailSchema,
}));

export const SendEmailResponseSchema = OkSchema(z.object({
  message: z.string(),
  email: EmailSchema,
}));

export const AttachmentUploadResponseSchema = OkSchema(z.object({
  message: z.string(),
  attachments: z.array(AttachmentSchema),
}));

export const AttachmentDeleteResponseSchema = OkSchema(z.object({
  message: z.string(),
}));

export const UserSearchResponseSchema = OkSchema(z.object({
  users: z.array(UserSchema),
}));

export const IdParamSchema = z.object({
  id: z.string().regex(/^\d+$/),
});

export { ErrSchema as ErrorResponseSchema };
