import { z } from "zod";

export const LoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const NoteCreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(100_000).default(""),
  content_type: z.enum(["plain_text", "markdown", "brief"]).default("plain_text"),
});

export const NoteUpdateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(100_000).default(""),
  content_type: z.enum(["plain_text", "markdown", "brief"]).default("plain_text"),
});

export const NoteResponseSchema = z.object({
  id: z.number(),
  owner_user_id: z.number(),
  title: z.string(),
  content: z.string(),
  content_type: z.string(),
  preview_text: z.string(),
  is_seeded: z.number(),
  save_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const RevisionResponseSchema = z.object({
  id: z.number(),
  note_id: z.number(),
  revision_no: z.number(),
  content_snapshot: z.string(),
  change_summary: z.string(),
  edited_by_user_id: z.number(),
  edited_at: z.string(),
});

export const NoteDetailResponseSchema = z.object({
  id: z.number(),
  owner_user_id: z.number(),
  title: z.string(),
  content: z.string(),
  content_type: z.string(),
  preview_text: z.string(),
  is_seeded: z.number(),
  save_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  latest_revision: RevisionResponseSchema.nullable(),
});
