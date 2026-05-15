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

// Update accepts the same shape as Create; alias to keep a single source of truth.
export const NoteUpdateSchema = NoteCreateSchema;

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

export const NoteDetailResponseSchema = NoteResponseSchema.extend({
  latest_revision: RevisionResponseSchema.nullable(),
});

export const BriefEvidenceSchema = z.object({
  text: z.string().min(1).max(500),
  source: z.enum(["user_input", "email", "meeting", "document", "system"]).optional(),
});

export const BriefActionItemSchema = z.object({
  text: z.string().min(1).max(300),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]),
  owner: z.string().max(100).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

export const BriefCitationSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url().max(2048).optional(),
  note: z.string().max(500).optional(),
});

export const BriefPayloadSchema = z.object({
  key_updates: z.string().min(1),
  evidence_bullets: z.array(BriefEvidenceSchema).default([]),
  action_items: z.array(BriefActionItemSchema).default([]),
  citations: z.array(BriefCitationSchema).default([]),
  status: z.enum(["draft", "final"]).default("draft"),
});

export const BriefResponseSchema = BriefPayloadSchema.extend({
  id: z.number(),
  note_id: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const TaskRecordPayloadSchema = z.object({
  record_type: z.enum(["communication", "summary", "tracker_update"]).optional(),
  source_channel: z.enum(["manual", "email", "meeting", "incident"]).optional(),
  summary_text: z.string().optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
});

export const TaskRecordResponseSchema = TaskRecordPayloadSchema.extend({
  id: z.number(),
  note_id: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
